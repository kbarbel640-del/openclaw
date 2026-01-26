#!/bin/bash
# Launch Clawdbot FORK with Ollama
# Runs the local fork on port 19001, separate from installed clawdbot (18789)
#
# SECURITY: Enforces localhost-only Ollama connections

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# =============================================================================
# SECURITY
# =============================================================================

export OLLAMA_HOST="127.0.0.1:11434"
unset OLLAMA_ORIGINS

check_ollama_security() {
    if ss -tlnp 2>/dev/null | grep -q "0.0.0.0:11434"; then
        echo "!!! WARNING: Ollama exposed to network (0.0.0.0:11434) !!!"
        read -p "Continue? (y/N): " -n 1 -r
        echo
        [[ ! $REPLY =~ ^[Yy]$ ]] && exit 1
    fi
}

# =============================================================================
# OLLAMA
# =============================================================================

start_ollama() {
    if ! pgrep -x "ollama" > /dev/null; then
        echo "Starting Ollama..."
        ollama serve &
        for i in {1..30}; do
            curl -s http://127.0.0.1:11434/api/tags > /dev/null 2>&1 && break
            sleep 1
        done
    fi
    MODEL_COUNT=$(curl -s http://127.0.0.1:11434/api/tags | grep -o '"name"' | wc -l)
    echo "Ollama: $MODEL_COUNT models available"
}

# =============================================================================
# MAIN
# =============================================================================

echo "=== Clawdbot FORK + Ollama ==="
echo "Project: $PROJECT_DIR"
echo "Profile: ollama (port 19001)"
echo ""

check_ollama_security
start_ollama

echo ""
cd "$PROJECT_DIR"

# Check if gateway already running
if ss -tlnp 2>/dev/null | grep -q ":19001"; then
    echo "Gateway already running on port 19001"
    echo "Opening dashboard..."
    pnpm clawdbot --profile ollama dashboard
    exit 0
fi

echo "Starting Clawdbot gateway..."

# Start gateway in background
pnpm clawdbot --profile ollama gateway run --dev --port 19001 --bind loopback --force &
GATEWAY_PID=$!

# Wait for gateway to be ready
echo "Waiting for gateway..."
for i in {1..30}; do
    if ss -tlnp 2>/dev/null | grep -q ":19001"; then
        echo "Gateway ready (PID: $GATEWAY_PID)"
        sleep 2

        # Open dashboard with proper auth token
        echo "Opening dashboard..."
        pnpm clawdbot --profile ollama dashboard 2>/dev/null &

        echo ""
        echo "=== Running ==="
        echo "Dashboard: http://127.0.0.1:19001/"
        echo "Default model: ollama/qwen3-coder-32k:latest"
        echo ""
        echo "Press Ctrl+C to stop gateway"
        wait $GATEWAY_PID
        exit 0
    fi
    sleep 1
done

echo "Gateway failed to start within 30 seconds"
exit 1
