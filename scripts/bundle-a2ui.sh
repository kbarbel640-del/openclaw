#!/usr/bin/env bash
set -euo pipefail

on_error() {
  echo "A2UI bundling failed. Re-run with: pnpm canvas:a2ui:bundle" >&2
  echo "If this persists, verify pnpm deps and try again." >&2
}
trap on_error ERR

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HASH_FILE="$ROOT_DIR/src/canvas-host/a2ui/.bundle.hash"
OUTPUT_FILE="$ROOT_DIR/src/canvas-host/a2ui/a2ui.bundle.js"
A2UI_RENDERER_DIR="$ROOT_DIR/vendor/a2ui/renderers/lit"
A2UI_APP_DIR="$ROOT_DIR/apps/shared/OpenClawKit/Tools/CanvasA2UI"

# Docker builds exclude vendor/apps via .dockerignore.
# In that environment we can keep a prebuilt bundle only if it exists.
if [[ ! -d "$A2UI_RENDERER_DIR" || ! -d "$A2UI_APP_DIR" ]]; then
  if [[ -f "$OUTPUT_FILE" ]]; then
    echo "A2UI sources missing; keeping prebuilt bundle."
    exit 0
  fi
  echo "A2UI sources missing and no prebuilt bundle found at: $OUTPUT_FILE" >&2
  exit 1
fi

# WSL detection: when pnpm runs "bash" on Windows it resolves to WSL
# (C:\Windows\System32\bash.exe), where native Node.js is typically absent.
# The pnpm wrappers for tsc/rolldown require node and therefore fail in WSL.
# Use the prebuilt bundle if available; otherwise guide the user to build
# outside WSL (Git Bash or cmd) where Windows node is accessible.
if grep -qi microsoft /proc/version 2>/dev/null; then
  if [[ -f "$OUTPUT_FILE" ]]; then
    echo "A2UI bundle up to date; skipping (WSL detected, using prebuilt bundle)."
    exit 0
  fi
  echo "WSL environment detected but no prebuilt bundle found at: $OUTPUT_FILE" >&2
  echo "Run outside WSL to build it: open Git Bash and run: pnpm canvas:a2ui:bundle" >&2
  exit 1
fi

INPUT_PATHS=(
  "$ROOT_DIR/package.json"
  "$ROOT_DIR/pnpm-lock.yaml"
  "$A2UI_RENDERER_DIR"
  "$A2UI_APP_DIR"
)

# Portable SHA-256: sha256sum on Linux/WSL, shasum on macOS.
_sha256() {
  if command -v sha256sum &>/dev/null; then
    sha256sum "$@"
  else
    shasum -a 256 "$@"
  fi
}

compute_hash() {
  # Pure-bash hash using _sha256 — avoids Node.js, which is absent in WSL
  # when bash is invoked from Windows (pnpm uses WSL bash via System32/bash.exe).
  # Hashes sorted relative paths + file contents for stable cache detection.
  (
    for input_path in "${INPUT_PATHS[@]}"; do
      if [[ -d "$input_path" ]]; then
        while IFS= read -r -d '' f; do
          printf '%s\0' "${f#"$ROOT_DIR/"}"
          _sha256 < "$f" | cut -d' ' -f1
          printf '\0'
        done < <(find "$input_path" -type f -print0 2>/dev/null | sort -z)
      elif [[ -f "$input_path" ]]; then
        printf '%s\0' "${input_path#"$ROOT_DIR/"}"
        _sha256 < "$input_path" | cut -d' ' -f1
        printf '\0'
      fi
    done
  ) | _sha256 | cut -d' ' -f1
}

current_hash="$(compute_hash)"
if [[ -f "$HASH_FILE" ]]; then
  previous_hash="$(cat "$HASH_FILE")"
  if [[ "$previous_hash" == "$current_hash" && -f "$OUTPUT_FILE" ]]; then
    echo "A2UI bundle up to date; skipping."
    exit 0
  fi
fi

pnpm -s exec tsc -p "$A2UI_RENDERER_DIR/tsconfig.json"
if command -v rolldown >/dev/null 2>&1; then
  rolldown -c "$A2UI_APP_DIR/rolldown.config.mjs"
else
  pnpm -s dlx rolldown -c "$A2UI_APP_DIR/rolldown.config.mjs"
fi

echo "$current_hash" > "$HASH_FILE"
