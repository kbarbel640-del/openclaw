#!/bin/bash
# Brave Web Search CLI Wrapper
# Simple bash wrapper for the Node.js search script

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_SCRIPT="$SCRIPT_DIR/search.mjs"

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ ERROR: Node.js not found. Please install Node.js." >&2
    exit 1
fi

# Check if script exists
if [[ ! -f "$NODE_SCRIPT" ]]; then
    echo "❌ ERROR: Script not found: $NODE_SCRIPT" >&2
    exit 1
fi

# Execute with Node.js
exec node "$NODE_SCRIPT" "$@"