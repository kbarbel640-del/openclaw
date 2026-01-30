#!/usr/bin/env bash
set -euo pipefail

: "${OPENCLAW_CONFIG_PATH:=/data/.openclaw/openclaw.json}"

# Create minimal config if missing (Railway fresh volume)
# Run as root to handle volume permissions, then exec as node
if [ ! -f "$OPENCLAW_CONFIG_PATH" ]; then
  echo "No config found at $OPENCLAW_CONFIG_PATH, creating minimal config..."
  mkdir -p "$(dirname "$OPENCLAW_CONFIG_PATH")"
  cat > "$OPENCLAW_CONFIG_PATH" <<'JSON'
{
  "gateway": {
    "mode": "local"
  }
}
JSON
fi

# Ensure node user can write to data dir (Railway mounts volume with root ownership)
chown -R node:node /data

# Railway sets PORT, but openclaw expects OPENCLAW_GATEWAY_PORT or CLAWDBOT_GATEWAY_PORT
# Map Railway's PORT to OPENCLAW_GATEWAY_PORT if not already set
if [ -n "${PORT:-}" ] && [ -z "${OPENCLAW_GATEWAY_PORT:-}" ] && [ -z "${CLAWDBOT_GATEWAY_PORT:-}" ]; then
  export OPENCLAW_GATEWAY_PORT="$PORT"
fi

# Default to 8080 if no port is set
: "${OPENCLAW_GATEWAY_PORT:=8080}"

# Run the gateway server as node user with --allow-unconfigured for Railway deployments
exec su node -c "node openclaw.mjs gateway run --bind 0.0.0.0 --port $OPENCLAW_GATEWAY_PORT --allow-unconfigured"
