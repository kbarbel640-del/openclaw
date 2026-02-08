#!/usr/bin/env bash
set -euo pipefail

# OpenClaw UI snapshot bundle (macOS + Peekaboo)
#
# Captures a small, consistent set of artifacts useful for debugging UI state.
# Writes outputs under /tmp so nothing is accidentally committed.
#
# Requirements:
# - peekaboo CLI installed and permitted (Screen Recording + Accessibility)
#
# Usage:
#   ./scripts/openclaw-ui-snapshot.sh

if ! command -v peekaboo >/dev/null 2>&1; then
  echo "Error: peekaboo not found. Install with: brew install steipete/tap/peekaboo" >&2
  exit 1
fi

ts="$(date +%Y%m%d-%H%M%S)"
out="/tmp/openclaw-ui-snapshot-$ts"
mkdir -p "$out"

# Permissions + UI inventory (best-effort; don’t fail the whole snapshot if these error).
peekaboo --version > "$out/peekaboo-version.txt" 2>&1 || true
peekaboo permissions > "$out/peekaboo-permissions.txt" 2>&1 || true
peekaboo menubar list --json > "$out/menubar.json" 2>/dev/null || true
peekaboo list windows --json > "$out/windows.json" 2>/dev/null || true

# Images / UI map (these typically require Screen Recording permission).
peekaboo image --mode screen --screen-index 0 --retina --path "$out/screen.png" 2>/dev/null || true
peekaboo image --mode frontmost --retina --path "$out/frontmost.png" 2>/dev/null || true
peekaboo see --mode screen --screen-index 0 --annotate --path "$out/ui-map.png" 2>/dev/null || true

echo "Saved UI snapshot bundle: $out"

echo "Artifacts:"
for f in \
  peekaboo-version.txt \
  peekaboo-permissions.txt \
  menubar.json \
  windows.json \
  screen.png \
  frontmost.png \
  ui-map.png
do
  if [[ -f "$out/$f" ]]; then
    echo "- $out/$f"
  fi
done
