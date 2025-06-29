// server.js (Render-ready version)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from root and /videos
app.use(express.static(path.join(__dirname)));
app.use('/videos', express.static(path.join(__dirname, 'videos')));

// Global video state
let currentVideoState = {
  type: 'seek',
  time: 1  // start at 25:55
};

let userCounter = 0;
const users = {};

function generateUserID() {
  return String(++userCounter).padStart(3, '0');
}

io.on('connection', socket => {
  const userID = generateUserID();
  users[userID] = { id: userID };
  console.log(`User (${userID}) connected`);

  socket.emit('video-event', currentVideoState);
  socket.emit('user-assigned', { id: userID });

  socket.on('video-event', data => {
    console.log(`Video event from ${userID}: ${data.type} @ ${data.time}`);
    currentVideoState = data;
    socket.broadcast.emit('video-event', data);
  });

  socket.on('disconnect', () => {
    console.log(`User (${userID}) disconnected`);
    delete users[userID];
  });
});

// Use environment variable PORT if available (Render sets this)
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
