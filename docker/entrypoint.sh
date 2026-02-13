#!/bin/bash
set -e

# Auto-detect Docker network subnets and configure trustedProxies
echo "Detecting Docker networks..."
SUBNETS=$(ip -o -f inet addr show | grep -v "127.0.0.1" | awk '{print $4}' | paste -sd ',' -)

if [ -n "$SUBNETS" ]; then
    echo "Detected Docker networks: $SUBNETS"
    
    # Generate proper JSON array using jq
    JSON_ARRAY=$(echo "$SUBNETS" | jq -R 'split(",") | map(select(length > 0))')
    
    echo "Setting trustedProxies to: $JSON_ARRAY"
    
    # Ensure proper ownership BEFORE running config commands
    chown -R claw:claw /claw
    
    # Update gateway.trustedProxies with proper JSON array
    su - claw -c "openclaw config set gateway.trustedProxies \"$JSON_ARRAY\" --json" || \
        echo "Warning: Could not set trustedProxies (config may not exist yet)"
    
    echo "Updated gateway.trustedProxies. Restart the gateway to apply."
fi

# Auto-configure Control UI allowed origins from Pomerium domain
if [ -n "$POMERIUM_CLUSTER_DOMAIN" ]; then
    echo "Configuring Control UI allowed origins for Pomerium cluster: $POMERIUM_CLUSTER_DOMAIN"
    ALLOWED_ORIGINS="[\"https://$POMERIUM_CLUSTER_DOMAIN\"]"
    su - claw -c "openclaw config set gateway.controlUi.allowedOrigins \"$ALLOWED_ORIGINS\" --json" || \
        echo "Warning: Could not set allowedOrigins"
fi

# Start the gateway as claw user
echo "Starting OpenClaw Gateway..."
exec su - claw -c "cd /claw/workspace && openclaw gateway"
