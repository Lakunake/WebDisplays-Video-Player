#!/bin/bash

# =================================================================
# Get script location and set working directory
# =================================================================
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"
echo "Running from: $(pwd)"

# =================================================================
# Check Node.js installation
# =================================================================
echo "Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    echo -e "\nERROR: Node.js is not installed or not in PATH!"
    echo "Please install Node.js using your package manager or from:"
    echo "https://nodejs.org/"
    echo ""
    read -p "Press enter to exit"
    exit 1
fi

# =================================================================
# Initialize configuration
# =================================================================
if [ ! -f "config.txt" ]; then
    echo "Creating default configuration..."
    cat > config.txt <<EOL
max_clients: 4
video_file: filmeva.mp4
chunk_size: 10
port: 3000
volume_step: 5
skip_seconds: 10
EOL
    echo "Default config created"
fi

# =================================================================
# Create folders if needed
# =================================================================
if [ ! -d "videos" ]; then
    mkdir videos
    echo "Created videos directory"
fi

# =================================================================
# Install dependencies
# =================================================================
if [ ! -d "node_modules" ]; then
    echo "Installing Node.js dependencies..."
    npm install
    echo "Dependencies installed"
fi

# =================================================================
# Read configuration
# =================================================================
MAX_CLIENTS=4
VIDEO_FILE="filmeva.mp4"
CHUNK_SIZE=10
PORT=3000
VOLUME_STEP=5
SKIP_SECONDS=10

while IFS=": " read -r key value; do
    case "$key" in
        "max_clients") MAX_CLIENTS="$value" ;;
        "video_file") VIDEO_FILE="$value" ;;
        "chunk_size") CHUNK_SIZE="$value" ;;
        "port") PORT="$value" ;;
        "volume_step") VOLUME_STEP="$value" ;;
        "skip_seconds") SKIP_SECONDS="$value" ;;
    esac
done < <(grep -v '^#' config.txt)

# =================================================================
# Check FFmpeg installation
# =================================================================
echo "Checking FFmpeg installation..."
if ! command -v ffmpeg &> /dev/null; then
    echo -e "\n[WARNING]: FFMPEG IS NOT INSTALLED!"
    echo "Some video formats may not play correctly."
    echo "Install FFmpeg with: sudo apt install ffmpeg"
    echo "or from: https://ffmpeg.org/"
    echo ""
    sleep 5
fi

# =================================================================
# Firewall check (informational only)
# =================================================================
echo "Firewall status for port $PORT:"
if command -v ufw &> /dev/null && ufw status | grep -q "$PORT/tcp"; then
    echo "UFW firewall rule exists for port $PORT"
elif command -v iptables &> /dev/null && sudo iptables -L -n | grep -q ":$PORT"; then
    echo "iptables rule exists for port $PORT"
else
    echo -e "\n[WARNING]: NO FIREWALL RULE DETECTED FOR PORT $PORT"
    echo "Server may not be accessible from other devices"
    echo "To allow access: sudo ufw allow $PORT/tcp"
    echo ""
    sleep 5
fi

# =================================================================
# Verify video file exists
# =================================================================
if [ ! -f "videos/$VIDEO_FILE" ]; then
    echo -e "\nERROR: Video file not found!"
    echo "Expected: videos/$VIDEO_FILE"
    echo "Found in videos/:"
    ls videos/
    echo ""
    read -p "Press enter to exit"
    exit 1
fi

# =================================================================
# Get local IP address
# =================================================================
echo "Getting local IP address..."
LOCAL_IP=$(hostname -I | awk '{print $1}')
if [ -z "$LOCAL_IP" ]; then
    LOCAL_IP="localhost"
fi

# =================================================================
# Display server information
# =================================================================
echo -e "\nMinecraft Video Sync Server"
echo "=========================="
echo -e "\nSettings:"
echo "- Max Clients: $MAX_CLIENTS"
echo "- Video File: videos/$VIDEO_FILE"
echo "- Chunk Size: $CHUNK_SIZE MB"
echo "- Server Port: $PORT"
echo "- Volume Step: $VOLUME_STEP%"
echo "- Skip Seconds: ${SKIP_SECONDS}s"
echo -e "\nAccess URLs:"
echo "- This computer: http://localhost:$PORT"
echo "- Your network: http://$LOCAL_IP:$PORT"
echo -e "\nStarting Server..."
node server.js "$MAX_CLIENTS" "$CHUNK_SIZE" "$PORT" "$VOLUME_STEP" "$SKIP_SECONDS" "$VIDEO_FILE"
