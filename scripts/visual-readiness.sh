#!/usr/bin/env bash
set -euo pipefail

# Visual readiness probe for OpenClaw (macOS).
# - If Peekaboo permissions are missing, prints exact steps to fix.
# - If permissions are granted, captures a small snapshot bundle under /tmp.

if ! command -v peekaboo >/dev/null 2>&1; then
  echo "Peekaboo is not installed. Install with:"
  echo "  brew install steipete/tap/peekaboo"
  exit 1
fi

echo "== Peekaboo permissions =="
perm_out="$(peekaboo permissions 2>&1 || true)"
echo "$perm_out"

if echo "$perm_out" | grep -Fq "Screen Recording (Required): Not Granted"; then
  cat <<'EOF'

== Fix: grant Screen Recording to Terminal (exact macOS steps) ==
1) Open System Settings
2) Privacy & Security → Screen Recording
3) Enable your terminal app (Terminal or iTerm)
4) Quit & reopen the terminal app (permission is per running instance)
5) Re-run: peekaboo permissions

Once Screen Recording is enabled, Peekaboo can:
- Capture screenshots (whole screen, frontmost window)
- Generate annotated UI maps with element IDs (peekaboo see --annotate)
EOF
  exit 2
fi

if echo "$perm_out" | grep -Fq "Accessibility (Required): Not Granted"; then
  cat <<'EOF'

== Fix: grant Accessibility to Terminal (exact macOS steps) ==
1) Open System Settings
2) Privacy & Security → Accessibility
3) Enable your terminal app (Terminal or iTerm)
4) Quit & reopen the terminal app
5) Re-run: peekaboo permissions

Once Accessibility is enabled, Peekaboo can:
- Click/type/press keys reliably (click/type/press/hotkey)
- Drive menus/menubar and focus windows (menu/menubar/window)
EOF
  exit 3
fi

ts="$(date +%Y%m%d-%H%M%S)"
out="/tmp/openclaw-ui-snapshot-$ts"
mkdir -p "$out"

echo ""
echo "== Capturing snapshot bundle =="
peekaboo menubar list --json > "$out/menubar.json" || true
peekaboo list windows --json > "$out/windows.json" || true

# Fast/high-signal artifacts for debugging state.
peekaboo image --mode frontmost --retina --path "$out/frontmost.png"
peekaboo see --mode screen --screen-index 0 --annotate --path "$out/ui-map.png"

# Optional: whole screen (bigger, but sometimes useful).
peekaboo image --mode screen --screen-index 0 --retina --path "$out/screen.png" || true

echo "Saved: $out"
