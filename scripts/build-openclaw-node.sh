#!/usr/bin/env bash
# build-openclaw-node.sh — Build a standalone OpenClawNode.app bundle.
#
# Creates ~/.openclaw/OpenClawNode.app with a self-contained copy of Node.js
# and all its shared libraries. This allows macOS Full Disk Access to be
# granted to the OpenClaw gateway without granting FDA to all of homebrew's
# /opt/homebrew/bin/node.
#
# Usage: scripts/build-openclaw-node.sh [--node-path /path/to/node]

set -euo pipefail

# Bash defaults vary across macOS versions; ensure globs that match nothing
# expand to empty (so codesign steps don't fail on an empty dylib set).
shopt -s nullglob

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

BUNDLE_DIR="${HOME}/.openclaw/OpenClawNode.app"
CONTENTS="${BUNDLE_DIR}/Contents"
MACOS_DIR="${CONTENTS}/MacOS"
LIB_DIR="${CONTENTS}/lib"
BINARY_NAME="node"
BUNDLE_ID="ai.openclaw.node"

# Parse optional --node-path
NODE_SRC=""
while [ $# -gt 0 ]; do
  case "$1" in
    --node-path) NODE_SRC="$2"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

# Default to homebrew node (not NVM) since the gateway runs under homebrew's
# node in launchd. Fall back to whatever 'node' is in PATH.
if [ -z "$NODE_SRC" ]; then
  if [ -x /opt/homebrew/bin/node ]; then
    NODE_SRC="/opt/homebrew/bin/node"
  else
    NODE_SRC="$(which node 2>/dev/null || true)"
  fi
  if [ -z "$NODE_SRC" ]; then
    echo "error: node not found. Use --node-path to specify." >&2
    exit 1
  fi
fi

# macOS doesn't support `readlink -f` by default; use `realpath` if available,
# otherwise fall back to Python.
realpath_compat() {
  if command -v realpath >/dev/null 2>&1; then
    realpath "$1"
    return
  fi
  python3 - <<'PY' "$1"
import os, sys
print(os.path.realpath(sys.argv[1]))
PY
}

NODE_SRC="$(realpath_compat "$NODE_SRC")"
NODE_VERSION="$("$NODE_SRC" --version 2>/dev/null || echo 'unknown')"
NODE_PARENT="$(dirname "$NODE_SRC")"

echo "==> Building OpenClawNode.app"
echo "    Source: ${NODE_SRC} (${NODE_VERSION})"
echo "    Target: ${BUNDLE_DIR}"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Temp dir used as a map: each file is named after a dylib basename and
# contains the real (resolved) path. Works in bash 3.x (no declare -A).
DYLIB_MAP_DIR="$(mktemp -d)"
trap 'rm -rf "$DYLIB_MAP_DIR"' EXIT

# Record a dylib in the map (skip if already present).
record_dylib() {
  local name="$1" real_path="$2"
  if [ ! -f "${DYLIB_MAP_DIR}/${name}" ]; then
    echo "$real_path" > "${DYLIB_MAP_DIR}/${name}"
  fi
}

# Collect non-system dylib paths referenced by a Mach-O binary.
brew_deps() {
  otool -L "$1" 2>/dev/null | awk 'NR>1 {print $1}' | grep -E '^(/opt/homebrew|@rpath/|@loader_path/)' || true
}

# Resolve a dylib reference to an absolute real path.
resolve_dylib() {
  local ref="$1"
  local context_dir="${2:-}"

  case "$ref" in
    @rpath/*)
      local name="${ref#@rpath/}"
      local node_lib="${NODE_PARENT}/../lib/${name}"
      if [ -f "$node_lib" ]; then
        realpath_compat "$node_lib"
        return
      fi
      # Search homebrew opt dirs
      local found
      found="$(find -L /opt/homebrew/opt -name "$name" -path "*/lib/*" -print -quit 2>/dev/null)"
      if [ -n "$found" ]; then
        realpath_compat "$found"
        return
      fi
      ;;
    @loader_path/*)
      local name="${ref#@loader_path/}"
      if [ -n "$context_dir" ] && [ -f "${context_dir}/${name}" ]; then
        realpath_compat "${context_dir}/${name}"
        return
      fi
      ;;
    /opt/homebrew/*)
      if [ -f "$ref" ]; then
        realpath_compat "$ref"
        return
      fi
      ;;
  esac
}

# Walk deps of a binary and record them in the map.
collect_deps_for() {
  local binary="$1"
  local context_dir
  context_dir="$(dirname "$(realpath_compat "$binary")")"

  for ref in $(brew_deps "$binary"); do
    local real_path
    real_path="$(resolve_dylib "$ref" "$context_dir")"
    if [ -n "$real_path" ] && [ -f "$real_path" ]; then
      local base
      base="$(basename "$ref")"
      record_dylib "$base" "$real_path"
    fi
  done
}

# ---------------------------------------------------------------------------
# Create bundle structure
# ---------------------------------------------------------------------------

rm -rf "$BUNDLE_DIR"
mkdir -p "$MACOS_DIR" "$LIB_DIR"

# Copy node binary
cp "$NODE_SRC" "${MACOS_DIR}/${BINARY_NAME}"
chmod 755 "${MACOS_DIR}/${BINARY_NAME}"

# ---------------------------------------------------------------------------
# Collect all dylibs (direct + one level of transitive)
# ---------------------------------------------------------------------------

# Pass 1: direct deps of the binary
collect_deps_for "${MACOS_DIR}/${BINARY_NAME}"

# Also collect deps from libnode (it's the 60MB core; the binary is a thin
# wrapper and libnode references all the same homebrew libs).
if [ -f "${NODE_PARENT}/../lib/libnode.141.dylib" ]; then
  collect_deps_for "${NODE_PARENT}/../lib/libnode.141.dylib"
fi

# Pass 2: transitive deps of everything collected so far
for mapfile in "${DYLIB_MAP_DIR}"/*; do
  [ -f "$mapfile" ] || continue
  real_path="$(cat "$mapfile")"
  collect_deps_for "$real_path"
done

DYLIB_COUNT="$(ls "${DYLIB_MAP_DIR}" | wc -l | tr -d ' ')"
echo "    Bundling ${DYLIB_COUNT} dylibs"

# Copy all dylibs into Contents/lib/
for mapfile in "${DYLIB_MAP_DIR}"/*; do
  [ -f "$mapfile" ] || continue
  name="$(basename "$mapfile")"
  real_path="$(cat "$mapfile")"
  cp "$real_path" "${LIB_DIR}/${name}"
  chmod 644 "${LIB_DIR}/${name}"
  echo "      ${name}  ($(du -h "${LIB_DIR}/${name}" | awk '{print $1}'))"
done

# ---------------------------------------------------------------------------
# Rewrite load paths
# ---------------------------------------------------------------------------

# Rewrite a Mach-O binary: change /opt/homebrew and @loader_path refs to @rpath.
rewrite_paths() {
  local target="$1"
  otool -L "$target" 2>/dev/null | awk 'NR>1 {print $1}' | while IFS= read -r old; do
    case "$old" in
      /opt/homebrew/*)
        install_name_tool -change "$old" "@rpath/$(basename "$old")" "$target" 2>/dev/null || true
        ;;
      @loader_path/*)
        local lib_name="${old#@loader_path/}"
        install_name_tool -change "$old" "@rpath/${lib_name}" "$target" 2>/dev/null || true
        ;;
    esac
  done
}

echo "    Rewriting load paths..."

# Main binary: replace rpaths, rewrite deps
for existing_rpath in $(otool -l "${MACOS_DIR}/${BINARY_NAME}" 2>/dev/null \
    | awk '/cmd LC_RPATH/{getline;getline;print $2}'); do
  install_name_tool -delete_rpath "$existing_rpath" "${MACOS_DIR}/${BINARY_NAME}" 2>/dev/null || true
done
install_name_tool -add_rpath "@executable_path/../lib" "${MACOS_DIR}/${BINARY_NAME}"
rewrite_paths "${MACOS_DIR}/${BINARY_NAME}"

# Each dylib: set ID, add rpath, rewrite deps
for mapfile in "${DYLIB_MAP_DIR}"/*; do
  [ -f "$mapfile" ] || continue
  name="$(basename "$mapfile")"
  local_path="${LIB_DIR}/${name}"

  # Set the dylib's install name to @rpath/<name>
  install_name_tool -id "@rpath/${name}" "$local_path" 2>/dev/null || true

  # Replace rpaths with @loader_path (so sibling dylibs resolve)
  for existing_rpath in $(otool -l "$local_path" 2>/dev/null \
      | awk '/cmd LC_RPATH/{getline;getline;print $2}'); do
    install_name_tool -delete_rpath "$existing_rpath" "$local_path" 2>/dev/null || true
  done
  install_name_tool -add_rpath "@loader_path" "$local_path" 2>/dev/null || true

  # Rewrite all references to sibling homebrew libs
  rewrite_paths "$local_path"
done

# ---------------------------------------------------------------------------
# Info.plist
# ---------------------------------------------------------------------------

cat > "${CONTENTS}/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>${BINARY_NAME}</string>
  <key>CFBundleIdentifier</key>
  <string>${BUNDLE_ID}</string>
  <key>CFBundleName</key>
  <string>OpenClawNode</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleVersion</key>
  <string>${NODE_VERSION}</string>
  <key>LSUIElement</key>
  <true/>
</dict>
</plist>
PLIST

# ---------------------------------------------------------------------------
# Codesign (ad-hoc)
# ---------------------------------------------------------------------------

echo "    Codesigning..."
codesign --force --sign - "${LIB_DIR}"/*.dylib
codesign --force --sign - "${MACOS_DIR}/${BINARY_NAME}"
codesign --force --sign - "$BUNDLE_DIR"

# ---------------------------------------------------------------------------
# Verify
# ---------------------------------------------------------------------------

echo ""
echo "==> Verifying..."
RESULT="$("${MACOS_DIR}/${BINARY_NAME}" --version 2>&1)" || true
echo "    ${MACOS_DIR}/${BINARY_NAME} --version => ${RESULT}"

# Check for unresolved homebrew references in binary and all dylibs
HAS_LEAKS=0
LEAKS="$(otool -L "${MACOS_DIR}/${BINARY_NAME}" 2>/dev/null | grep '/opt/homebrew' || true)"
if [ -n "$LEAKS" ]; then
  echo "    WARNING: binary still references homebrew paths:"
  echo "$LEAKS"
  HAS_LEAKS=1
fi

for lib in "${LIB_DIR}"/*.dylib; do
  LEAKS="$(otool -L "$lib" 2>/dev/null | grep '/opt/homebrew' || true)"
  if [ -n "$LEAKS" ]; then
    echo "    WARNING: $(basename "$lib") still references homebrew paths:"
    echo "$LEAKS"
    HAS_LEAKS=1
  fi
done

if [ "$HAS_LEAKS" -eq 0 ]; then
  echo "    All load paths are self-contained."
fi

echo ""
echo "==> Done. Grant FDA to OpenClawNode in:"
echo "    System Settings > Privacy & Security > Full Disk Access"
echo "    Then reinstall the daemon:"
echo "      node dist/index.js daemon install --force --runtime node"
echo "      node dist/index.js daemon restart"
