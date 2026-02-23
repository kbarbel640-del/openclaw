#!/bin/bash
set -e

# Define paths
OPENCLAW_BIN="$HOME/.openclaw/bin"
FFMPEG_PATH="$OPENCLAW_BIN/ffmpeg"
FFPROBE_PATH="$OPENCLAW_BIN/ffprobe"

# Ensure bin directory exists
mkdir -p "$OPENCLAW_BIN"

# Add to PATH for this session
export PATH="$OPENCLAW_BIN:$PATH"

echo "Checking for ffmpeg..."
if ! command -v ffmpeg &> /dev/null; then
  echo "ffmpeg not found. Downloading static build..."
  # Download static ffmpeg build (Linux amd64)
  curl -L -o ffmpeg.tar.xz https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz
  
  echo "Extracting ffmpeg..."
  tar -xf ffmpeg.tar.xz
  
  # Find the extracted directory (it usually has a versioned name)
  EXTRACTED_DIR=$(find . -maxdepth 1 -type d -name "ffmpeg-*-amd64-static" | head -n 1)
  
  if [ -d "$EXTRACTED_DIR" ]; then
    cp "$EXTRACTED_DIR/ffmpeg" "$FFMPEG_PATH"
    cp "$EXTRACTED_DIR/ffprobe" "$FFPROBE_PATH"
    chmod +x "$FFMPEG_PATH" "$FFPROBE_PATH"
    echo "ffmpeg installed to $OPENCLAW_BIN"
    
    # Cleanup
    rm -rf ffmpeg.tar.xz "$EXTRACTED_DIR"
  else
    echo "Error: Failed to extract ffmpeg directory."
    rm -f ffmpeg.tar.xz
    exit 1
  fi
else
  echo "ffmpeg is already installed: $(command -v ffmpeg)"
fi

echo "Checking for openai-whisper..."
if ! python3 -c "import whisper" &> /dev/null; then
  echo "openai-whisper not found. Installing via pip..."
  # Install openai-whisper in user mode with break-system-packages (necessary for some environments)
  pip install --user openai-whisper --break-system-packages
  
  # Ensure ~/.local/bin is in PATH for the whisper CLI
  if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
      export PATH="$HOME/.local/bin:$PATH"
      echo "Added $HOME/.local/bin to PATH"
  fi
else
  echo "openai-whisper is already installed."
fi

# Verify installation
echo "Verifying installation..."
echo "ffmpeg version: $(ffmpeg -version | head -n 1)"
if command -v whisper &> /dev/null; then
    echo "whisper CLI found at $(command -v whisper)"
    whisper --help | head -n 5
else
    echo "Warning: whisper CLI not found in PATH. It may be installed in ~/.local/bin but not in current PATH."
    echo "You can run it with: python3 -m whisper"
fi

echo "Setup complete! Please ensure '$OPENCLAW_BIN' and '$HOME/.local/bin' are in your PATH."
