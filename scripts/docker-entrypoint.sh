#!/bin/sh
set -e

# Config lives in OPENCLAW_STATE_DIR/openclaw.json or $HOME/.openclaw/openclaw.json
CONFIG_DIR="${OPENCLAW_STATE_DIR:-$HOME/.openclaw}"
CONFIG_FILE="$CONFIG_DIR/openclaw.json"
DEFAULT_CONFIG="/app/openclaw.json"

mkdir -p "$CONFIG_DIR"
if [ ! -f "$CONFIG_FILE" ] && [ -f "$DEFAULT_CONFIG" ]; then
  cp "$DEFAULT_CONFIG" "$CONFIG_FILE"
  echo "Seeded config from $DEFAULT_CONFIG to $CONFIG_FILE"
fi

exec "$@"
