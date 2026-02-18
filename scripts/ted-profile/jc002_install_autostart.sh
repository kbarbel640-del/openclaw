#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "node is required"
  exit 1
fi

echo "Enabling ted-sidecar plugin and autostart config..."
node scripts/run-node.mjs config set gateway.mode local
node scripts/run-node.mjs config set plugins.entries.ted-sidecar.enabled true
node scripts/run-node.mjs config set plugins.entries.ted-sidecar.config.sidecarPath "$ROOT_DIR/sidecars/ted-engine/server.mjs"
node scripts/run-node.mjs config set plugins.entries.ted-sidecar.config.autostart true

echo "Installing gateway autostart service (single orchestrator)..."
node scripts/run-node.mjs gateway install --force --runtime node
node scripts/run-node.mjs gateway stop || true
node scripts/run-node.mjs gateway start

echo "Gateway service status:"
node scripts/run-node.mjs gateway status --no-probe

echo "JC-002 install complete"
