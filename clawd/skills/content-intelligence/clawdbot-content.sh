#!/bin/bash
# Content Intelligence System wrapper
# Usage: clawdbot-content [command] [args...]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_SCRIPT="$SCRIPT_DIR/content-cli.py"

# Ensure Python dependencies are available
if ! python3 -c "import requests, bs4" 2>/dev/null; then
    echo "Installing required dependencies..."
    pip3 install -q requests beautifulsoup4
fi

# Run the CLI
python3 "$CLI_SCRIPT" "$@"
