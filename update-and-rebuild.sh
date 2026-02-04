#!/usr/bin/env bash
set -euo pipefail

# OpenClaw one-click update script
# Features: Pull code + Build + Package + Restart

cd "$(dirname "$0")"

echo "🔄 Step 1: Fetching latest code..."
git fetch origin
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [[ "$LOCAL" == "$REMOTE" ]]; then
  echo "✅ Already up to date, no update needed"
  exit 0
fi

echo "📥 Step 2: Pulling latest code..."
git pull origin main

echo "📦 Step 3: Installing dependencies..."
pnpm install --no-frozen-lockfile --config.node-linker=hoisted

echo "🏗  Step 4: Building TypeScript..."
pnpm build

echo "🖥  Step 5: Building Control UI..."
pnpm ui:build

echo "📱 Step 6: Packaging macOS app..."
pnpm mac:package

echo "🔏 Step 7: Signing app..."
"$PWD/scripts/codesign-mac-app.sh" "$PWD/dist/OpenClaw.app"

echo "⏹  Step 8: Stopping old version..."
killall -q OpenClaw 2>/dev/null || true
sleep 1

echo "🚀 Step 9: Launching new version..."
open "$PWD/dist/OpenClaw.app"

echo "✅ Update complete!"
