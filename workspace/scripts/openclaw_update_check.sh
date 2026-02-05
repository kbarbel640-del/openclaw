#!/usr/bin/env bash
set -euo pipefail

now="$(date '+%Y-%m-%d %H:%M:%S')"

local_ver=""
if command -v openclaw >/dev/null 2>&1; then
  local_ver="$(openclaw --version 2>/dev/null | head -n1 | tr -d '\r')"
elif command -v moltbot >/dev/null 2>&1; then
  local_ver="$(moltbot --version 2>/dev/null | head -n1 | tr -d '\r')"
fi

remote_ver=""
remote_url=""
api_json="$(curl -fsSL https://api.github.com/repos/openclaw/openclaw/releases/latest 2>/dev/null || true)"
if [ -n "$api_json" ]; then
  remote_ver="$(python3 - <<'PY'
import json,sys
j=json.loads(sys.stdin.read())
print(j.get('tag_name','') or j.get('name',''))
PY
<<< "$api_json")"
  remote_url="$(python3 - <<'PY'
import json,sys
j=json.loads(sys.stdin.read())
print(j.get('html_url',''))
PY
<<< "$api_json")"
fi

echo "[${now}] local=${local_ver:-unknown} remote=${remote_ver:-unknown} ${remote_url}" 
