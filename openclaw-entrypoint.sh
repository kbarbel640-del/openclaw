#!/usr/bin/env bash
# OpenClaw container entrypoint with auto-update
set -e

echo "🔄 Updating OpenClaw to latest version..."
node /app/openclaw.mjs update --yes --no-restart || {
    echo "⚠️  Update failed, starting with current version"
}

echo "🚀 Starting OpenClaw Gateway..."
exec node /app/openclaw.mjs gateway "$@"
