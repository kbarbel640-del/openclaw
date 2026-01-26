#!/bin/bash
# Launch script for Clawdbot with Ollama
# Starts Ollama if not running, then launches Clawdbot
#
# SECURITY: This script enforces localhost-only Ollama connections

set -e

# =============================================================================
# SECURITY CONFIGURATION
# =============================================================================

# Force Ollama to bind to localhost only (prevents network exposure)
export OLLAMA_HOST="127.0.0.1:11434"

# Never allow these dangerous configurations
unset OLLAMA_ORIGINS  # Prevents CORS bypass

# =============================================================================
# SECURITY CHECKS
# =============================================================================

check_ollama_security() {
    echo "[Security] Checking Ollama configuration..."

    # Check if Ollama is listening on 0.0.0.0 (dangerous!)
    if ss -tlnp 2>/dev/null | grep -q "0.0.0.0:11434"; then
        echo ""
        echo "!!! SECURITY WARNING !!!"
        echo "Ollama is exposed to ALL network interfaces (0.0.0.0:11434)"
        echo "This allows anyone on your network to use your Ollama instance!"
        echo ""
        echo "To fix this:"
        echo "  1. Stop Ollama: systemctl --user stop ollama (or pkill ollama)"
        echo "  2. Edit config: Remove OLLAMA_HOST=0.0.0.0 from your environment"
        echo "  3. Restart Ollama (this script will bind it to localhost)"
        echo ""
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Aborted for security reasons."
            exit 1
        fi
    fi

    # Check if Ollama is listening on [::] (IPv6 all interfaces - also dangerous)
    if ss -tlnp 2>/dev/null | grep -q "\[::\]:11434"; then
        echo ""
        echo "!!! SECURITY WARNING !!!"
        echo "Ollama is exposed on IPv6 all interfaces ([::]:11434)"
        echo ""
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Aborted for security reasons."
            exit 1
        fi
    fi

    # Check for dangerous environment variables in user's environment
    if [ -f "$HOME/.bashrc" ] && grep -q "OLLAMA_HOST=0.0.0.0" "$HOME/.bashrc" 2>/dev/null; then
        echo ""
        echo "[Warning] Found OLLAMA_HOST=0.0.0.0 in ~/.bashrc"
        echo "Consider removing this to prevent network exposure."
        echo ""
    fi

    if [ -f "$HOME/.profile" ] && grep -q "OLLAMA_HOST=0.0.0.0" "$HOME/.profile" 2>/dev/null; then
        echo ""
        echo "[Warning] Found OLLAMA_HOST=0.0.0.0 in ~/.profile"
        echo "Consider removing this to prevent network exposure."
        echo ""
    fi

    # Check systemd service if it exists
    if [ -f "/etc/systemd/system/ollama.service" ]; then
        if grep -q "OLLAMA_HOST=0.0.0.0" /etc/systemd/system/ollama.service 2>/dev/null; then
            echo ""
            echo "[Warning] System Ollama service is configured to bind to 0.0.0.0"
            echo "Edit /etc/systemd/system/ollama.service to fix this."
            echo ""
        fi
    fi

    echo "[Security] Checks complete."
}

check_firewall() {
    # Informational: Check if firewall is active
    if command -v ufw &> /dev/null; then
        if ufw status 2>/dev/null | grep -q "Status: active"; then
            echo "[Security] UFW firewall is active (good!)"
        else
            echo "[Info] UFW firewall is not active. Consider enabling it:"
            echo "  sudo ufw enable"
        fi
    elif command -v firewall-cmd &> /dev/null; then
        if firewall-cmd --state 2>/dev/null | grep -q "running"; then
            echo "[Security] Firewalld is active (good!)"
        fi
    fi
}

# =============================================================================
# MAIN SCRIPT
# =============================================================================

echo "=== Clawdbot + Ollama Launcher ==="
echo ""

# Run security checks
check_ollama_security
check_firewall

# Check if Ollama is running
if ! pgrep -x "ollama" > /dev/null; then
    echo ""
    echo "Starting Ollama (localhost only)..."

    # Start Ollama with secure settings
    ollama serve &
    OLLAMA_PID=$!

    # Wait for Ollama to be ready
    echo "Waiting for Ollama to start..."
    for i in {1..30}; do
        if curl -s http://127.0.0.1:11434/api/tags > /dev/null 2>&1; then
            echo "Ollama is ready (PID: $OLLAMA_PID)"
            break
        fi
        if [ $i -eq 30 ]; then
            echo "Error: Ollama failed to start within 30 seconds"
            exit 1
        fi
        sleep 1
    done
else
    echo "Ollama is already running"
fi

# Verify we're connecting to localhost only
echo ""
echo "[Security] Connecting to: http://127.0.0.1:11434 (localhost only)"

# Check if any models are available
MODELS_JSON=$(curl -s http://127.0.0.1:11434/api/tags 2>/dev/null)
MODEL_COUNT=$(echo "$MODELS_JSON" | grep -o '"name"' | wc -l)

if [ "$MODEL_COUNT" -eq 0 ]; then
    echo ""
    echo "No Ollama models found. You need to pull a model first."
    echo ""
    echo "Recommended models for coding:"
    echo "  ollama pull qwen3-coder      # Fast, good for code"
    echo "  ollama pull deepseek-r1:8b   # Reasoning model"
    echo "  ollama pull llama3.3         # General purpose"
    echo ""

    # Open terminal to let user pull a model
    if command -v gnome-terminal &> /dev/null; then
        gnome-terminal -- bash -c "echo 'Pull a model with: ollama pull <model-name>'; echo ''; ollama list; exec bash"
    elif command -v konsole &> /dev/null; then
        konsole -e bash -c "echo 'Pull a model with: ollama pull <model-name>'; echo ''; ollama list; exec bash"
    elif command -v xterm &> /dev/null; then
        xterm -e "echo 'Pull a model with: ollama pull <model-name>'; ollama list; exec bash"
    fi
    exit 1
fi

echo "Found $MODEL_COUNT Ollama model(s)"
echo ""
echo "Starting Clawdbot..."
echo ""

# Launch Clawdbot
if command -v clawdbot &> /dev/null; then
    exec clawdbot
elif [ -f "$HOME/.local/bin/clawdbot" ]; then
    exec "$HOME/.local/bin/clawdbot"
elif [ -f "/usr/local/bin/clawdbot" ]; then
    exec /usr/local/bin/clawdbot
else
    # Run from source
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
    cd "$PROJECT_DIR"
    exec pnpm clawdbot
fi
