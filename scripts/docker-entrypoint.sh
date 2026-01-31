#!/bin/sh
# Docker/Podman entrypoint script for OpenClaw gateway
# Creates minimal config on first run, then starts the gateway

set -e

STATE_DIR="${OPENCLAW_STATE_DIR:-/home/node/.openclaw}"
CONFIG_FILE="$STATE_DIR/openclaw.json"

# Create state directory if it doesn't exist
mkdir -p "$STATE_DIR"

# Create minimal config if it doesn't exist
if [ ! -f "$CONFIG_FILE" ]; then
  echo "Creating initial config at $CONFIG_FILE"
  cat > "$CONFIG_FILE" << 'EOF'
{
  "gateway": {
    "mode": "local",
    "trustedProxies": ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"],
    "controlUi": {
      "dangerouslyDisableDeviceAuth": true
    }
  },
  "plugins": {
    "slots": {
      "memory": "none"
    }
  }
}
EOF
  echo "Initial config created. Configure via:"
  echo "  - Web UI at your gateway URL"
  echo "  - Remote CLI: openclaw config set gateway.mode remote && openclaw config set gateway.remote.url wss://YOUR_DOMAIN/ws"
fi

# Run the gateway
exec node dist/index.js gateway --bind lan --port 18789 "$@"
