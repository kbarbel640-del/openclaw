#!/bin/bash
# Reapply Control UI patches after OpenClaw updates
# Run this after: npm update -g openclaw
#
# Supports both macOS (Homebrew) and Linux (nvm/global npm)
# Page title is auto-detected from hostname

# --- Auto-detect platform and paths ---
if [ -d "/opt/homebrew/lib/node_modules/openclaw" ]; then
  OC_DIR="/opt/homebrew/lib/node_modules/openclaw"
elif [ -n "$NVM_DIR" ]; then
  OC_DIR="$(dirname $(which openclaw 2>/dev/null) 2>/dev/null)/../lib/node_modules/openclaw"
  [ ! -d "$OC_DIR" ] && OC_DIR="$NVM_DIR/versions/node/$(node -v)/lib/node_modules/openclaw"
else
  OC_DIR="$(npm root -g)/openclaw"
fi

UI_DIR="$OC_DIR/dist/control-ui"
UI_HTML="$UI_DIR/index.html"
JS_FILE=$(ls "$UI_DIR/assets/index-"*.js 2>/dev/null | head -1)

# --- Detect OS for sed compatibility ---
if [[ "$OSTYPE" == "darwin"* ]]; then
  SED_I="sed -i ''"
else
  SED_I="sed -i"
fi

# --- Page title from hostname (fallback: OpenClaw Control) ---
PAGE_TITLE="${OPENCLAW_TITLE:-$(hostname)} - OpenClaw Control"

echo "🔧 Reapplying Control UI patches..."
echo "📁 OpenClaw dir: $OC_DIR"

if [ -z "$JS_FILE" ]; then
  echo "❌ Could not find Control UI JS file at $UI_DIR/assets/"
  exit 1
fi

echo "📁 JS file: $JS_FILE"

# --- Backup ---
cp "$JS_FILE" "$JS_FILE.backup-$(date +%Y%m%d-%H%M%S)"
cp "$UI_HTML" "$UI_HTML.backup-$(date +%Y%m%d-%H%M%S)"
echo "📦 Created backups"

# --- Patch 1: Thinking toggle bug fix ---
if grep -q '!e.showThinking&&l.role.toLowerCase()==="toolresult"' "$JS_FILE"; then
  $SED_I 's/!e\.showThinking&&l\.role\.toLowerCase()==="toolresult"/!e.showThinking\&\&(l.role.toLowerCase()==="toolresult"||l.role==="assistant"\&\&Array.isArray(o.content)\&\&o.content.length>0\&\&o.content.every(function(cc){var ct=(typeof cc.type==="string"?cc.type:"").toLowerCase();return ct==="toolcall"||ct==="tool_call"||ct==="tooluse"||ct==="tool_use"||ct==="thinking"}))/' "$JS_FILE"
  echo "✅ Patch 1: Thinking toggle bug fix"
else
  echo "⚠️  Patch 1: Already applied or pattern changed"
fi

# --- Patch 2: Hide tool cards when thinking off ---
echo "⚠️  Patch 2 (hide tool cards): Manual verification needed"

# --- Patch 3: Enter-to-connect + auto-switch to Chat ---
if grep -q '@keydown.*preventDefault.*onConnect\(\)}}' "$JS_FILE"; then
  $SED_I 's/@keydown=\${o=>{if(o\.key==="Enter"){o\.preventDefault();e\.onConnect()}}}/@keydown=\${o=>{if(o.key==="Enter"){o.preventDefault();e.onConnect();e.setTab("chat")}}}/' "$JS_FILE"
  echo "✅ Patch 3: Enter-to-connect + Chat switch"
else
  echo "⚠️  Patch 3: Already applied or pattern changed"
fi

# --- Patch 4: Page title ---
if grep -q '<title>OpenClaw Control</title>' "$UI_HTML"; then
  $SED_I "s/<title>OpenClaw Control<\/title>/<title>$PAGE_TITLE<\/title>/" "$UI_HTML"
  echo "✅ Patch 4: Page title → $PAGE_TITLE"
elif grep -q '<title>.*- OpenClaw Control</title>' "$UI_HTML"; then
  $SED_I "s/<title>.*- OpenClaw Control<\/title>/<title>$PAGE_TITLE<\/title>/" "$UI_HTML"
  echo "✅ Patch 4: Page title updated → $PAGE_TITLE"
else
  echo "⚠️  Patch 4: Title pattern not found"
fi

echo "✨ Patch application complete!"
echo "🔄 Restart the gateway: openclaw gateway restart"
