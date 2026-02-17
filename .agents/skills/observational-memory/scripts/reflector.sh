#!/usr/bin/env bash
# reflector.sh — Observational Memory Reflector for OpenClaw
# Condenses old observations when they exceed the reflection threshold.
# Merges related entries, drops irrelevant ones, and keeps observations
# under the MEMORY.md bootstrap char limit.
#
# Usage: bash reflector.sh [--workspace /data/workspace] [--dry-run]
#
# Intended to run via cron (every 4 hours) or manually via /reflect.

set -euo pipefail

WORKSPACE="${OPENCLAW_WORKSPACE:-/data/workspace}"
MEMORY_FILE="${WORKSPACE}/MEMORY.md"
OBSERVER_MODEL="${OBSERVATIONAL_MEMORY_MODEL:-minimax/MiniMax-M2.5}"
API_KEY="${OBSERVATIONAL_MEMORY_PROVIDER_API_KEY:-${MINIMAX_API_KEY:-}}"
MAX_OBSERVATION_CHARS=14000
REFLECTION_THRESHOLD_CHARS=10000
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --workspace) WORKSPACE="$2"; MEMORY_FILE="${WORKSPACE}/MEMORY.md"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

if [[ ! -f "$MEMORY_FILE" ]]; then
  echo "No MEMORY.md found at ${MEMORY_FILE}. Nothing to reflect on."
  exit 0
fi

TMPDIR_OM=$(mktemp -d)
trap 'rm -rf "$TMPDIR_OM"' EXIT

# --- Extract current observations to a temp file ---
python3 - "$MEMORY_FILE" "$TMPDIR_OM/current-obs.txt" << 'PYEOF'
import re, sys

memory_file = sys.argv[1]
out_file = sys.argv[2]

with open(memory_file, "r") as f:
    content = f.read()

match = re.search(r'## Observations\n\n(.*?)(\n## |\Z)', content, re.DOTALL)
obs = match.group(1).strip() if match else ""

with open(out_file, 'w') as f:
    f.write(obs)

print(f'{len(obs)} chars' if obs else '0 chars')
PYEOF

OBSERVATIONS=$(cat "$TMPDIR_OM/current-obs.txt")

if [[ -z "$OBSERVATIONS" ]]; then
  echo "No observations found in MEMORY.md."
  exit 0
fi

OBS_CHARS=${#OBSERVATIONS}
echo "Current observations: ${OBS_CHARS} chars"

if [[ "$OBS_CHARS" -lt "$REFLECTION_THRESHOLD_CHARS" ]]; then
  echo "Observations (${OBS_CHARS} chars) below reflection threshold (${REFLECTION_THRESHOLD_CHARS}). Skipping."
  exit 0
fi

CURRENT_DATE=$(date '+%Y-%m-%d')

# --- Build Reflector prompt in a temp file ---
cat > "$TMPDIR_OM/reflector-prompt.txt" << PROMPTEOF
You are the Reflector — a background memory maintenance agent. Your job is to condense
an observation log that has grown too large. You must reduce it while preserving all
critical information.

RULES:
1. Keep ALL 🔴 (critical) observations unless they are clearly superseded by newer ones.
2. Merge related 🟡 observations into single entries where possible.
3. Drop 🟢 (info only) observations older than 3 days unless they provide unique context.
4. Combine duplicate or near-duplicate entries.
5. If a fact was updated (e.g., deadline changed), keep only the latest version but note
   the change (e.g., "deadline moved from Feb 20 → Feb 23").
6. Preserve the date header structure (### YYYY-MM-DD).
7. Older date sections can be more aggressively condensed.
8. Target output: ${MAX_OBSERVATION_CHARS} characters or fewer.
9. Output ONLY the condensed observations. No preamble, no explanation.
10. Maintain chronological order (newest first).

Current date: ${CURRENT_DATE}

OBSERVATIONS TO CONDENSE:
PROMPTEOF

cat "$TMPDIR_OM/current-obs.txt" >> "$TMPDIR_OM/reflector-prompt.txt"
echo -e "\n\nOutput the condensed observations now:" >> "$TMPDIR_OM/reflector-prompt.txt"

echo "Running Reflector with model: ${OBSERVER_MODEL}..."

# --- Build request payload ---
python3 - "$TMPDIR_OM/reflector-prompt.txt" "$TMPDIR_OM/request.json" "$OBSERVER_MODEL" << 'PYEOF'
import json, sys

prompt_file = sys.argv[1]
out_file = sys.argv[2]
model = sys.argv[3]

with open(prompt_file, 'r') as f:
    prompt = f.read()

if model.startswith('google/') or model.startswith('gemini'):
    payload = {
        'contents': [{'parts': [{'text': prompt}]}],
        'generationConfig': {'maxOutputTokens': 8192, 'temperature': 0.1}
    }
elif model.startswith('minimax/'):
    model_name = model.replace('minimax/', '', 1)
    payload = {
        'model': model_name,
        'messages': [{'role': 'user', 'content': prompt}],
        'max_tokens': 8192,
        'temperature': 0.1
    }
elif model.startswith('openai/') or model.startswith('gpt'):
    model_name = model.replace('openai/', '', 1)
    payload = {
        'model': model_name,
        'messages': [{'role': 'user', 'content': prompt}],
        'max_tokens': 8192,
        'temperature': 0.1
    }
elif model.startswith('anthropic/') or model.startswith('claude'):
    model_name = model.replace('anthropic/', '', 1)
    payload = {
        'model': model_name,
        'messages': [{'role': 'user', 'content': prompt}],
        'max_tokens': 8192,
        'temperature': 0.1
    }
else:
    payload = {}

with open(out_file, 'w') as f:
    json.dump(payload, f)
PYEOF

# --- Call the API ---
if [[ "$OBSERVER_MODEL" == google/* || "$OBSERVER_MODEL" == gemini* ]]; then
  MODEL_NAME="${OBSERVER_MODEL#google/}"
  curl -s -X POST \
    "https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}" \
    -H "Content-Type: application/json" \
    -d @"$TMPDIR_OM/request.json" \
    -o "$TMPDIR_OM/response.json" 2>/dev/null

elif [[ "$OBSERVER_MODEL" == minimax/* ]]; then
  curl -s -X POST \
    "https://api.minimax.io/anthropic/v1/messages" \
    -H "Content-Type: application/json" \
    -H "x-api-key: ${API_KEY}" \
    -H "anthropic-version: 2023-06-01" \
    -d @"$TMPDIR_OM/request.json" \
    -o "$TMPDIR_OM/response.json" 2>/dev/null

elif [[ "$OBSERVER_MODEL" == openai/* || "$OBSERVER_MODEL" == gpt* ]]; then
  curl -s -X POST \
    "https://api.openai.com/v1/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${API_KEY}" \
    -d @"$TMPDIR_OM/request.json" \
    -o "$TMPDIR_OM/response.json" 2>/dev/null

elif [[ "$OBSERVER_MODEL" == anthropic/* || "$OBSERVER_MODEL" == claude* ]]; then
  curl -s -X POST \
    "https://api.anthropic.com/v1/messages" \
    -H "Content-Type: application/json" \
    -H "x-api-key: ${API_KEY}" \
    -H "anthropic-version: 2023-06-01" \
    -d @"$TMPDIR_OM/request.json" \
    -o "$TMPDIR_OM/response.json" 2>/dev/null

else
  echo "ERROR: Unsupported model provider for ${OBSERVER_MODEL}."
  exit 1
fi

# --- Extract condensed observations ---
python3 - "$TMPDIR_OM/response.json" "$TMPDIR_OM/condensed.txt" "$OBSERVER_MODEL" << 'PYEOF'
import json, sys

resp_file = sys.argv[1]
out_file = sys.argv[2]
model = sys.argv[3]

with open(resp_file, 'r') as f:
    data = json.load(f)

text = ''
if model.startswith('google/') or model.startswith('gemini'):
    parts = data.get('candidates', [{}])[0].get('content', {}).get('parts', [])
    text = ''.join(p.get('text', '') for p in parts)
elif model.startswith('minimax/'):
    blocks = data.get('content', [])
    text = '\n'.join(b.get('text', '') for b in blocks if b.get('type') == 'text')
elif model.startswith('openai/') or model.startswith('gpt'):
    text = data.get('choices', [{}])[0].get('message', {}).get('content', '')
elif model.startswith('anthropic/') or model.startswith('claude'):
    blocks = data.get('content', [])
    text = '\n'.join(b.get('text', '') for b in blocks if b.get('type') == 'text')

text = text.strip()
with open(out_file, 'w') as f:
    f.write(text)

if text:
    print(f'Condensed to {len(text)} chars.')
else:
    print('ERROR: No condensed output.')
    sys.exit(1)
PYEOF

CONDENSED=$(cat "$TMPDIR_OM/condensed.txt")

if [[ -z "$CONDENSED" ]]; then
  echo "Reflector failed to produce condensed observations. Keeping originals."
  exit 1
fi

CONDENSED_CHARS=${#CONDENSED}
echo "Condensed from ${OBS_CHARS} → ${CONDENSED_CHARS} chars ($(( (OBS_CHARS - CONDENSED_CHARS) * 100 / OBS_CHARS ))% reduction)"

if $DRY_RUN; then
  echo "--- DRY RUN: Would replace observations with ---"
  cat "$TMPDIR_OM/condensed.txt"
  exit 0
fi

# --- Write condensed observations back to MEMORY.md ---
python3 - "$MEMORY_FILE" "$TMPDIR_OM/condensed.txt" << 'PYEOF'
import re, sys

memory_file = sys.argv[1]
condensed_file = sys.argv[2]

with open(memory_file, 'r') as f:
    content = f.read()

with open(condensed_file, 'r') as f:
    condensed = f.read().strip()

pattern = r'(## Observations\n\n)(.*?)(\n## |\Z)'
match = re.search(pattern, content, re.DOTALL)

if match:
    suffix = match.group(3)
    if suffix.startswith('\n## '):
        updated = content[:match.start()] + f'## Observations\n\n{condensed}\n\n' + suffix.lstrip('\n') + content[match.end():]
    else:
        updated = content[:match.start()] + f'## Observations\n\n{condensed}\n'
else:
    updated = content

with open(memory_file, 'w') as f:
    f.write(updated)

print('Reflector: MEMORY.md updated with condensed observations.')
PYEOF

# --- Log reflection event ---
REFLECTION_LOG="${WORKSPACE}/.om-reflections.log"
echo "$(date -Iseconds) | ${OBS_CHARS} → ${CONDENSED_CHARS} chars | model=${OBSERVER_MODEL}" >> "$REFLECTION_LOG"

echo "Reflection complete."
