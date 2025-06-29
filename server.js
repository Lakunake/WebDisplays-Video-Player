const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

// Read configuration from command line
const MAX_CLIENTS = parseInt(process.argv[2]) || 4;
const CHUNK_SIZE_MB = parseInt(process.argv[3]) || 10;
const PORT = parseInt(process.argv[4]) || 3000;
const VOLUME_STEP = parseFloat(process.argv[5]) || 5;
const SKIP_SECONDS = parseInt(process.argv[6]) || 10;
const VIDEO_FILE = process.argv[7] || 'filmeva.mp4';

console.log('Starting Minecraft Video Sync Server');
console.log(`- Max Clients: ${MAX_CLIENTS}`);
console.log(`- Video File: ${VIDEO_FILE}`);
console.log(`- Chunk Size: ${CHUNK_SIZE_MB}MB`);
console.log(`- Volume Step: ${VOLUME_STEP}%`);
console.log(`- Skip Seconds: ${SKIP_SECONDS}s`);
console.log(`- Port: ${PORT}`);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: Math.min(MAX_CLIENTS * 5e6, 2e7),
  pingTimeout: 60000,
  pingInterval: 10000
});

// Video file path
const videoPath = path.join(__dirname, 'videos', VIDEO_FILE);

// FIXED VIDEO STREAMING HANDLER
app.get(`/videos/${VIDEO_FILE}`, (req, res) => {
  try {
    const range = req.headers.range;
    if (!range) return res.status(400).send('Requires Range header');
    
    const videoSize = fs.statSync(videoPath).size;
    const CHUNK_SIZE = CHUNK_SIZE_MB * 1024 * 1024;
    const start = Number(range.replace(/\D/g, ''));
    
    // Validate range - FIX FOR OUT OF RANGE ERROR
    if (start >= videoSize) {
      return res.status(416).header({
        'Content-Range': `bytes */${videoSize}`
      }).end();
    }
    
    const end = Math.min(start + CHUNK_SIZE, videoSize - 1);
    const contentLength = end - start + 1;

    // Send headers only once - FIX FOR HEADERS SENT ERROR
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${videoSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': contentLength,
      'Content-Type': 'video/mp4',
      'Cache-Control': 'public, max-age=604800'
    });

    const videoStream = fs.createReadStream(videoPath, { start, end });
    
    // Handle stream errors
    videoStream.on('error', (err) => {
      console.error('Stream error:', err);
      if (!res.headersSent) {
        res.status(500).end();
      }
    });
    
    videoStream.pipe(res);
  } catch (err) {
    console.error('Video streaming error:', err);
    // Only send error if headers haven't been sent
    if (!res.headersSent) {
      res.status(500).send('Video file error');
    }
  }
});

// Serve static files
app.use(express.static(__dirname));

// Global video state
let videoState = {
  isPlaying: true,
  currentTime: 1,
  lastUpdate: Date.now()
};

// Socket.io handling
io.on('connection', (socket) => {
  if (io.engine.clientsCount > MAX_CLIENTS) {
    socket.emit('error', 'Server full (max clients reached)');
    socket.disconnect(true);
    return;
  }

  socket.emit('config', {
    volumeStep: VOLUME_STEP,
    skipSeconds: SKIP_SECONDS
  });

  socket.emit('sync', videoState);
  
  socket.on('control', (data) => {
    videoState = {
      isPlaying: data.isPlaying,
      currentTime: data.currentTime,
      lastUpdate: Date.now()
    };
    socket.broadcast.emit('sync', videoState);
  });

  const driftInterval = setInterval(() => {
    if (videoState.isPlaying) {
      const now = Date.now();
      const elapsed = (now - videoState.lastUpdate) / 1000;
      videoState.currentTime += elapsed;
      videoState.lastUpdate = now;
    }
  }, 5000);

  socket.on('disconnect', () => clearInterval(driftInterval));
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log('Waiting for connections...');
});
