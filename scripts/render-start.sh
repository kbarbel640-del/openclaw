#!/bin/sh
# Render startup script - creates config and starts gateway

# Create config directory
mkdir -p /data/.clawdbot

# Write config file with Render-specific settings
cat > /data/.clawdbot/clawdbot.json << 'EOF'
{
  "gateway": {
    "trustedProxies": ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"],
    "controlUi": {
      "allowInsecureAuth": true
    }
  }
}
EOF

# Start the gateway
exec node dist/index.js gateway \
  --port 8080 \
  --bind lan \
  --auth password \
  --allow-unconfigured
