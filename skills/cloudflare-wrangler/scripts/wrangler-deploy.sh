#!/usr/bin/env bash
set -euo pipefail

# Convenience wrapper around satsmax repo ./scripts/wrangler.sh.
# Usage:
#   bash wrangler-deploy.sh --config ./wrangler.toml

SATMAX_DIR="${SATMAX_DIR:-$HOME/OneDrive/satsmax}"
exec "${SATMAX_DIR}/scripts/wrangler.sh" "$@"
