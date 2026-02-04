#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ASSETS_DIR="$ROOT_DIR/src/main/assets/oww"
mkdir -p "$ASSETS_DIR"

BASE_URL="https://github.com/dscripka/openWakeWord/releases/download/v0.5.1"

# Download ONNX models (works with ONNX Runtime on Android)
echo "Downloading ONNX models..."
curl -fL "$BASE_URL/melspectrogram.onnx" -o "$ASSETS_DIR/melspectrogram.onnx"
curl -fL "$BASE_URL/embedding_model.onnx" -o "$ASSETS_DIR/embedding_model.onnx"

# Wake word models (ONNX format)
curl -fL "$BASE_URL/hey_jarvis_v0.1.onnx" -o "$ASSETS_DIR/hey_jarvis_v0.1.onnx"
curl -fL "$BASE_URL/alexa_v0.1.onnx" -o "$ASSETS_DIR/alexa_v0.1.onnx"

echo "Downloaded openWakeWord ONNX models to $ASSETS_DIR"
ls -la "$ASSETS_DIR"
