#!/usr/bin/env bash
set -euo pipefail

# Check if dist folder exists
if [ ! -d "dist" ]; then
  echo "Error: dist folder not found. Please build OpenClaw first:"
  echo "  bash scripts/docker-build-openclaw-minimal.sh"
  echo ""
  echo "(This builds OpenClaw in Docker - no local Node/pnpm needed!)"
  exit 1
fi

# Build Docker image
echo "Building Docker test image..."

# Use custom dockerignore for this build
if [ -f .dockerignore.asksage-test ]; then
  cp .dockerignore .dockerignore.bak 2>/dev/null || true
  cp .dockerignore.asksage-test .dockerignore
  trap "mv .dockerignore.bak .dockerignore 2>/dev/null || true" EXIT
fi

docker build -f Dockerfile.asksage-test -t openclaw-asksage-test .

# Check API key
if [ -z "${ASKSAGE_API_KEY:-}" ]; then
  echo "Error: ASKSAGE_API_KEY not set"
  echo "Set it with: export ASKSAGE_API_KEY='your-key-here'"
  exit 1
fi

# Resolve Ask Sage IP
ASKSAGE_IP=$(dig +short api.asksage.ai | head -1)
if [ -z "$ASKSAGE_IP" ]; then
  echo "Error: Could not resolve api.asksage.ai"
  exit 1
fi

# Run container with restricted network
# Only DNS resolution works, but you can add specific IPs
echo "Starting container..."
echo "Ask Sage IP: $ASKSAGE_IP"
echo ""
docker run --rm \
  --add-host=api.asksage.ai:$ASKSAGE_IP \
  -e ASKSAGE_API_KEY="$ASKSAGE_API_KEY" \
  -e NODE_OPTIONS="--dns-result-order=ipv4first" \
  openclaw-asksage-test bash -c "
    echo '=== Testing Ask Sage Integration ==='
    echo ''
    echo 'Step 1: Onboarding'
    node openclaw.mjs onboard --auth-choice asksage-api-key --non-interactive --accept-risk --token '$ASKSAGE_API_KEY' --token-provider asksage
    echo ''
    echo 'Step 2: List models'
    node openclaw.mjs models list --provider asksage
    echo ''
    echo 'Step 3: Test chat'
    echo 'Creating agent...'
    node openclaw.mjs agents add asksage-test --workspace /tmp/asksage-workspace --model asksage/google-claude-45-sonnet || echo 'Agent creation failed or already exists'
    echo 'Running agent...'
    node openclaw.mjs agent --agent asksage-test --to +15555550123 --message 'Say hello and confirm you are working through Ask Sage. Say which model is currently running' --local --json
  "