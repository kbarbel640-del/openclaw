#!/usr/bin/env bash
set -euo pipefail

# Visual readiness + UI map helper for OpenClaw debugging.
#
# Usage:
#   1) Bring the OpenClaw dashboard/control UI to the front (browser or app).
#   2) Run: scripts/visual-readiness.sh
#
# Output:
#   - Screenshot of the frontmost window
#   - Annotated UI map (element IDs)
#   - Permission status checks (Screen Recording + Accessibility)

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="${OUT_DIR:-/tmp}"
SHOT_PATH="$OUT_DIR/openclaw-frontmost-$STAMP.png"
MAP_PATH="$OUT_DIR/openclaw-ui-map-$STAMP.png"

say_block() {
  printf "%s\n" "$1"
}

say_block "Visual readiness probe (OpenClaw)"
say_block "- timestamp: $(date)"
say_block "- output dir: $OUT_DIR"

if ! command -v peekaboo >/dev/null 2>&1; then
  say_block ""
  say_block "Peekaboo not found in PATH."
  say_block "Install (macOS):"
  say_block "  $ brew install steipete/tap/peekaboo"
  say_block ""
  say_block "If Peekaboo is installed but screenshots fail, grant permissions:"
  say_block "  1) System Settings -> Privacy & Security -> Screen Recording"
  say_block "     - enable: Terminal (or iTerm)"
  say_block "     - quit and reopen Terminal"
  say_block "  2) System Settings -> Privacy & Security -> Accessibility"
  say_block "     - enable: Terminal (or iTerm)"
  say_block "     - quit and reopen Terminal"
  say_block ""
  say_block "Once enabled, this script can:"
  say_block "- capture the frontmost OpenClaw dashboard/control UI screenshot"
  say_block "- generate an annotated UI map (stable element IDs)"
  say_block "- list apps/windows/menubar extras for debugging"
  exit 2
fi

say_block ""
say_block "Peekaboo detected: $(command -v peekaboo)"
say_block ""

# Permission status (prints what is missing).
peekaboo permissions || true

say_block ""
say_block "Capturing frontmost window -> $SHOT_PATH"
peekaboo image --mode frontmost --retina --path "$SHOT_PATH"

say_block "Generating annotated UI map -> $MAP_PATH"
peekaboo see --mode frontmost --annotate --path "$MAP_PATH" >/dev/null

say_block ""
say_block "Done. Files:"
say_block "- $SHOT_PATH"
say_block "- $MAP_PATH"
