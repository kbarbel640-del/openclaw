#!/usr/bin/env bash
set -euo pipefail

# gclaw setup script
# Checks for Ollama, pulls a recommended model, and generates initial config.

RECOMMENDED_MODEL="${GCLAW_MODEL:-llama3.3}"
CONFIG_DIR="${HOME}/.openclaw"
CONFIG_FILE="${CONFIG_DIR}/config.json"
EXAMPLE_CONFIG="$(dirname "$0")/../gclaw.example.json"

echo "🌿 gclaw setup"
echo "==============="
echo

# Check for Ollama
if ! command -v ollama &>/dev/null; then
  echo "❌ Ollama not found."
  echo
  echo "Install it:"
  echo "  curl -fsSL https://ollama.com/install.sh | sh"
  echo
  echo "Then re-run this script."
  exit 1
fi

echo "✅ Ollama found: $(ollama --version 2>/dev/null || echo 'installed')"

# Check if Ollama is running
if ! curl -sf http://127.0.0.1:11434/api/tags &>/dev/null; then
  echo "⚠️  Ollama doesn't seem to be running. Starting it..."
  ollama serve &>/dev/null &
  sleep 2
  if ! curl -sf http://127.0.0.1:11434/api/tags &>/dev/null; then
    echo "❌ Could not start Ollama. Please start it manually:"
    echo "  ollama serve"
    exit 1
  fi
  echo "✅ Ollama started"
fi

# Pull recommended model
echo
echo "📦 Pulling ${RECOMMENDED_MODEL}..."
echo "   (This may take a while on first run — the model is several GB)"
echo
ollama pull "${RECOMMENDED_MODEL}"
echo
echo "✅ Model ${RECOMMENDED_MODEL} ready"

# Generate config
echo
if [ -f "${CONFIG_FILE}" ]; then
  echo "⚠️  Config already exists at ${CONFIG_FILE}"
  echo "   Skipping config generation. To reset, delete it and re-run."
else
  mkdir -p "${CONFIG_DIR}"
  cp "${EXAMPLE_CONFIG}" "${CONFIG_FILE}"
  echo "✅ Config written to ${CONFIG_FILE}"
fi

echo
echo "🎉 Setup complete! Next steps:"
echo
echo "  gclaw onboard         # Interactive setup (channels, skills, etc.)"
echo "  gclaw gateway start   # Start the gateway"
echo
