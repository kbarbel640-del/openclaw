#!/usr/bin/env bash
set -euo pipefail

echo "=== OpenClaw Disk Space Cleanup Script ==="
echo ""

# Function to show size before and after
show_cleanup() {
  local name=$1
  local path=$2
  if [ -e "$path" ]; then
    local before=$(du -sh "$path" 2>/dev/null | cut -f1)
    echo "Cleaning $name ($before)..."
    return 0
  else
    echo "Skipping $name (not found)"
    return 1
  fi
}

# Clean npm cache (safe)
if show_cleanup "npm cache" ~/.npm; then
  npm cache clean --force
  echo "  ✓ npm cache cleaned"
fi

# Clean yarn cache (safe)
if show_cleanup "Yarn cache" ~/Library/Caches/Yarn; then
  yarn cache clean --all 2>/dev/null || rm -rf ~/Library/Caches/Yarn
  echo "  ✓ Yarn cache cleaned"
fi

# Clean pnpm store (safe, will re-download)
if [ -d ~/.pnpm-store ]; then
  show_cleanup "pnpm store" ~/.pnpm-store
  pnpm store prune || rm -rf ~/.pnpm-store
  echo "  ✓ pnpm store cleaned"
fi

# Clean Homebrew cache (safe)
if show_cleanup "Homebrew cache" ~/Library/Caches/Homebrew; then
  brew cleanup -s 2>/dev/null || rm -rf ~/Library/Caches/Homebrew
  echo "  ✓ Homebrew cache cleaned"
fi

# Clean Docker (if installed)
if command -v docker &> /dev/null; then
  echo "Cleaning Docker..."
  docker system prune -af --volumes || true
  echo "  ✓ Docker cleaned"
fi

# Clean browser caches (optional - will log you out)
read -p "Clean browser caches? (Arc, Google, Firefox) [y/N]: " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  rm -rf ~/Library/Caches/Arc 2>/dev/null || true
  rm -rf ~/Library/Caches/Google 2>/dev/null || true
  rm -rf ~/Library/Caches/Firefox 2>/dev/null || true
  echo "  ✓ Browser caches cleaned"
fi

# Clean OpenClaw browser cache (safe)
if show_cleanup "OpenClaw browser cache" ~/.openclaw/browser; then
  rm -rf ~/.openclaw/browser/*
  echo "  ✓ OpenClaw browser cache cleaned"
fi

# Clean old OpenClaw session logs (keep last 7 days)
echo "Cleaning old OpenClaw session logs (>7 days)..."
find ~/.openclaw/agents/*/sessions -name "*.jsonl" -mtime +7 -delete 2>/dev/null || true
echo "  ✓ Old session logs cleaned"

# Clean OpenClaw memory snapshots (keep last 10)
if [ -d ~/.openclaw/memory ]; then
  echo "Cleaning old OpenClaw memory snapshots (keep last 10)..."
  cd ~/.openclaw/memory
  ls -t snapshot-*.json 2>/dev/null | tail -n +11 | xargs rm -f || true
  echo "  ✓ Old memory snapshots cleaned"
fi

echo ""
echo "=== Cleanup Complete ==="
echo ""
echo "Disk usage after cleanup:"
df -h /
echo ""
echo "OpenClaw directory size:"
du -sh ~/.openclaw
