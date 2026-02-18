#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "node is required"
  exit 1
fi

echo "Disabling ted-sidecar autostart and plugin..."
node scripts/run-node.mjs config set plugins.entries.ted-sidecar.config.autostart false
node scripts/run-node.mjs config set plugins.entries.ted-sidecar.enabled false

echo "Removing gateway autostart service..."
node scripts/run-node.mjs gateway stop || true
node scripts/run-node.mjs gateway uninstall || true

echo "JC-002 uninstall complete"
