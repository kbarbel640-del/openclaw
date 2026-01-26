#!/bin/bash
# Install Clawdbot Ollama desktop launcher

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Paths
DESKTOP_FILE="$PROJECT_DIR/assets/clawdbot-ollama.desktop"
LAUNCH_SCRIPT="$PROJECT_DIR/scripts/launch-clawdbot-ollama.sh"
ICON_FILE="$PROJECT_DIR/assets/chrome-extension/icons/icon128.png"
DEST_DIR="$HOME/.local/share/applications"

# Create destination directory if it doesn't exist
mkdir -p "$DEST_DIR"

# Make launch script executable
chmod +x "$LAUNCH_SCRIPT"

# Create the desktop file with absolute paths
cat > "$DEST_DIR/clawdbot-ollama.desktop" << EOF
[Desktop Entry]
Name=Clawdbot (Ollama)
Comment=AI Assistant with local Ollama models
Exec=$LAUNCH_SCRIPT
Icon=$ICON_FILE
Terminal=true
Type=Application
Categories=Development;Utility;
Keywords=ai;chat;ollama;local;llm;
StartupNotify=true
EOF

# Make desktop file executable (required on some distros)
chmod +x "$DEST_DIR/clawdbot-ollama.desktop"

# Update desktop database
if command -v update-desktop-database &> /dev/null; then
    update-desktop-database "$DEST_DIR" 2>/dev/null || true
fi

echo "Desktop launcher installed!"
echo "Location: $DEST_DIR/clawdbot-ollama.desktop"
echo ""
echo "You can now find 'Clawdbot (Ollama)' in your application menu."
echo ""
echo "To also add it to your desktop:"
echo "  cp $DEST_DIR/clawdbot-ollama.desktop ~/Desktop/"
echo "  # Then right-click the icon and select 'Allow Launching'"
