#!/usr/bin/env bash
# om-status.sh — Show Observational Memory status
# Usage: bash om-status.sh [--workspace ~/clawd]

set -euo pipefail

WORKSPACE="${OPENCLAW_WORKSPACE:-${HOME}/clawd}"
MEMORY_FILE="${WORKSPACE}/MEMORY.md"
STATE_FILE="${WORKSPACE}/.om-state.json"
REFLECTION_LOG="${WORKSPACE}/.om-reflections.log"

echo "=== Observational Memory Status ==="
echo ""

# --- Observation State ---
if [[ -f "$STATE_FILE" ]]; then
  echo "📊 Observer State:"
  python3 -c "
import json
with open('${STATE_FILE}') as f:
    state = json.load(f)
print(f'  Last observed line: {state.get(\"lastObservedLine\", \"unknown\")}')
print(f'  Last observed at:   {state.get(\"lastObservedAt\", \"never\")}')
print(f'  Observations made:  {state.get(\"observationCount\", 0)}')
"
else
  echo "📊 Observer State: No observations yet (${STATE_FILE} not found)"
fi

echo ""

# --- MEMORY.md Observations ---
if [[ -f "$MEMORY_FILE" ]]; then
  OBS_SECTION=$(python3 -c "
import re
with open('${MEMORY_FILE}', 'r') as f:
    content = f.read()
match = re.search(r'## Observations\n\n(.*?)(\n## |\Z)', content, re.DOTALL)
if match:
    obs = match.group(1).strip()
    lines = obs.split('\n')
    obs_lines = [l for l in lines if l.strip().startswith('- ')]
    critical = len([l for l in obs_lines if '🔴' in l])
    relevant = len([l for l in obs_lines if '🟡' in l])
    info = len([l for l in obs_lines if '🟢' in l])
    print(f'  Total observations: {len(obs_lines)}')
    print(f'  🔴 Critical:  {critical}')
    print(f'  🟡 Relevant:  {relevant}')
    print(f'  🟢 Info only: {info}')
    print(f'  Section size:  {len(obs)} chars / 14000 max ({len(obs)*100//14000}% used)')
else:
    print('  No ## Observations section found in MEMORY.md')
")
  echo "📝 Observations in MEMORY.md:"
  echo "$OBS_SECTION"
else
  echo "📝 MEMORY.md: Not found at ${MEMORY_FILE}"
fi

echo ""

# --- MEMORY.md total size ---
if [[ -f "$MEMORY_FILE" ]]; then
  TOTAL_CHARS=$(wc -c < "$MEMORY_FILE")
  echo "📏 MEMORY.md total size: ${TOTAL_CHARS} chars / 20000 bootstrap limit ($(( TOTAL_CHARS * 100 / 20000 ))% used)"
fi

echo ""

# --- Reflection History ---
if [[ -f "$REFLECTION_LOG" ]]; then
  REFLECTION_COUNT=$(wc -l < "$REFLECTION_LOG")
  LAST_REFLECTION=$(tail -1 "$REFLECTION_LOG")
  echo "🔄 Reflections: ${REFLECTION_COUNT} total"
  echo "  Last: ${LAST_REFLECTION}"
else
  echo "🔄 Reflections: None yet"
fi

echo ""
echo "=== End Status ==="
