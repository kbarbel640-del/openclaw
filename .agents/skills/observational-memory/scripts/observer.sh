#!/usr/bin/env bash
# observer.sh — Observational Memory Observer for OpenClaw
# Reads unobserved session messages, compresses them into dated observations,
# and writes them to the ## Observations section of MEMORY.md.
#
# Usage: bash observer.sh [--workspace /data/workspace] [--session-id <id>] [--dry-run]
#
# Environment:
#   OBSERVATIONAL_MEMORY_MODEL            - Model to use (default: google/gemini-2.5-flash)
#   OBSERVATIONAL_MEMORY_PROVIDER_API_KEY - API key for the model provider
#   OPENCLAW_WORKSPACE                    - Workspace directory (default: /data/workspace)

set -euo pipefail

# --- Configuration ---
WORKSPACE="${OPENCLAW_WORKSPACE:-/data/workspace}"
MEMORY_FILE="${WORKSPACE}/MEMORY.md"
STATE_FILE="${WORKSPACE}/.om-state.json"
OBSERVER_MODEL="${OBSERVATIONAL_MEMORY_MODEL:-minimax/MiniMax-M2.5}"
API_KEY="${OBSERVATIONAL_MEMORY_PROVIDER_API_KEY:-${MINIMAX_API_KEY:-}}"
MAX_OBSERVATION_CHARS=14000
DRY_RUN=false
SESSION_ID=""

# --- Parse Args ---
while [[ $# -gt 0 ]]; do
  case $1 in
    --workspace) WORKSPACE="$2"; MEMORY_FILE="${WORKSPACE}/MEMORY.md"; STATE_FILE="${WORKSPACE}/.om-state.json"; shift 2 ;;
    --session-id) SESSION_ID="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# --- Resolve session transcript ---
OPENCLAW_STATE="${HOME}/.openclaw"
if [[ -d "${HOME}/.clawdbot" ]]; then
  OPENCLAW_STATE="${HOME}/.clawdbot"
fi

find_latest_session() {
  local agents_dir="${OPENCLAW_STATE}/agents"
  if [[ ! -d "$agents_dir" ]]; then
    echo ""
    return
  fi
  # Find the most recently modified .jsonl session file (GNU find)
  find "$agents_dir" -name "*.jsonl" -type f -printf '%T@ %p\n' 2>/dev/null \
    | sort -rn \
    | head -1 \
    | cut -d' ' -f2-
}

if [[ -n "$SESSION_ID" ]]; then
  SESSION_FILE="$SESSION_ID"
else
  SESSION_FILE="$(find_latest_session)"
fi

if [[ -z "$SESSION_FILE" || ! -f "$SESSION_FILE" ]]; then
  echo "No session transcript found. Nothing to observe."
  exit 0
fi

# --- Load state ---
LAST_OBSERVED_LINE=0
if [[ -f "$STATE_FILE" ]]; then
  LAST_OBSERVED_LINE=$(python3 -c "
import json
try:
    with open('${STATE_FILE}') as f:
        state = json.load(f)
    print(state.get('lastObservedLine', 0))
except Exception:
    print(0)
" 2>/dev/null || echo "0")
fi

# --- Extract unobserved messages via temp file (avoids shell injection) ---
TOTAL_LINES=$(wc -l < "$SESSION_FILE")
if [[ "$TOTAL_LINES" -le "$LAST_OBSERVED_LINE" ]]; then
  echo "No new messages to observe (${TOTAL_LINES} lines, last observed: ${LAST_OBSERVED_LINE})."
  exit 0
fi

TMPDIR_OM=$(mktemp -d)
trap 'rm -rf "$TMPDIR_OM"' EXIT

# Extract messages to a temp file — no shell variable interpolation of LLM content
python3 - "$SESSION_FILE" "$LAST_OBSERVED_LINE" "$TMPDIR_OM/messages.txt" << 'PYEOF'
import json, sys

session_file = sys.argv[1]
last_line = int(sys.argv[2])
out_file = sys.argv[3]

messages = []
with open(session_file, 'r') as f:
    for i, line in enumerate(f):
        if i < last_line:
            continue
        line = line.strip()
        if not line:
            continue
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            continue

        role = entry.get('role', '')
        entry_type = entry.get('type', '')

        if role in ('user', 'assistant'):
            content = entry.get('content', '')
            if isinstance(content, list):
                text_parts = [b.get('text', '') for b in content
                              if isinstance(b, dict) and b.get('type') == 'text']
                content = '\n'.join(text_parts)
            content = str(content).strip()
            if content:
                if len(content) > 2000:
                    content = content[:2000] + '\n[...truncated]'
                messages.append(f'[{role}]: {content}')
        elif entry_type == 'tool_use':
            tool_name = entry.get('name', 'unknown')
            messages.append(f'[tool_call]: {tool_name}')

with open(out_file, 'w') as f:
    f.write('\n'.join(messages))

if messages:
    print(f'Extracted {len(messages)} message lines.')
else:
    print('')
PYEOF

UNOBSERVED_MESSAGES=$(cat "$TMPDIR_OM/messages.txt")

if [[ -z "$UNOBSERVED_MESSAGES" ]]; then
  echo "No meaningful messages to observe."
  exit 0
fi

MSG_LINES=$(echo "$UNOBSERVED_MESSAGES" | wc -l)
echo "Found ${MSG_LINES} unobserved message lines."

# --- Get current date/time ---
CURRENT_DATE=$(date '+%Y-%m-%d')
CURRENT_TIME=$(date '+%H:%M')
DAY_OF_WEEK=$(date '+%A')

# --- Build Observer prompt in a temp file (avoids shell quoting issues) ---
cat > "$TMPDIR_OM/observer-prompt.txt" << PROMPTEOF
You are the Observer — a background memory agent. Your job is to compress raw conversation
messages into dense, dated observations. You act as the subconscious memory of the main agent.

RULES:
1. Create observations in this EXACT format (one per line):
   - 🔴 HH:MM <observation>    (critical: facts, decisions, deadlines, names, preferences)
   - 🟡 HH:MM <observation>    (relevant: questions, options considered, useful context)
   - 🟢 HH:MM <observation>    (info only: background details, low priority)

2. Group observations under a date header: ### YYYY-MM-DD (context)
3. Use the three-date model when applicable:
   - Observation date: when this was observed (today)
   - Referenced date: when the event actually happened or will happen
   - Relative date: human-readable relative time ("today", "yesterday", "in 3 days")
4. Compress aggressively. Target 5-40x reduction. Drop noise, keep signal.
5. Tool calls and results should be summarized, not reproduced.
6. Never include raw code blocks — summarize what the code does.
7. If the user stated a preference, deadline, name, or decision, mark it 🔴.
8. Combine related observations. Don't create one observation per message.
9. Output ONLY the observations block. No preamble, no explanation.

Current date: ${CURRENT_DATE} (${DAY_OF_WEEK})
Current time: ${CURRENT_TIME}

RAW MESSAGES TO OBSERVE:
PROMPTEOF

# Append raw messages to prompt file (never interpolated through shell)
cat "$TMPDIR_OM/messages.txt" >> "$TMPDIR_OM/observer-prompt.txt"
echo -e "\n\nOutput the observations now:" >> "$TMPDIR_OM/observer-prompt.txt"

# --- Call the Observer LLM ---
echo "Running Observer with model: ${OBSERVER_MODEL}..."

# Build API request payload via Python (reads prompt from file, writes payload to file)
python3 - "$TMPDIR_OM/observer-prompt.txt" "$TMPDIR_OM/request.json" "$OBSERVER_MODEL" << 'PYEOF'
import json, sys

prompt_file = sys.argv[1]
out_file = sys.argv[2]
model = sys.argv[3]

with open(prompt_file, 'r') as f:
    prompt = f.read()

if model.startswith('google/') or model.startswith('gemini'):
    payload = {
        'contents': [{'parts': [{'text': prompt}]}],
        'generationConfig': {'maxOutputTokens': 4096, 'temperature': 0.1}
    }
elif model.startswith('minimax/'):
    model_name = model.replace('minimax/', '', 1)
    payload = {
        'model': model_name,
        'messages': [{'role': 'user', 'content': prompt}],
        'max_tokens': 4096,
        'temperature': 0.1
    }
elif model.startswith('openai/') or model.startswith('gpt'):
    model_name = model.replace('openai/', '', 1)
    payload = {
        'model': model_name,
        'messages': [{'role': 'user', 'content': prompt}],
        'max_tokens': 4096,
        'temperature': 0.1
    }
elif model.startswith('anthropic/') or model.startswith('claude'):
    model_name = model.replace('anthropic/', '', 1)
    payload = {
        'model': model_name,
        'messages': [{'role': 'user', 'content': prompt}],
        'max_tokens': 4096,
        'temperature': 0.1
    }
else:
    payload = {}

with open(out_file, 'w') as f:
    json.dump(payload, f)
PYEOF

# Route to the correct API
if [[ "$OBSERVER_MODEL" == google/* || "$OBSERVER_MODEL" == gemini* ]]; then
  MODEL_NAME="${OBSERVER_MODEL#google/}"
  curl -s -X POST \
    "https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}" \
    -H "Content-Type: application/json" \
    -d @"$TMPDIR_OM/request.json" \
    -o "$TMPDIR_OM/response.json" 2>/dev/null

elif [[ "$OBSERVER_MODEL" == minimax/* ]]; then
  # MiniMax uses Anthropic-compatible messages API
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
  echo "ERROR: Unsupported model provider for ${OBSERVER_MODEL}. Use google/, openai/, minimax/, or anthropic/ prefix."
  exit 1
fi

# Extract observations from response (reads from file, writes to file — no shell interpolation)
python3 - "$TMPDIR_OM/response.json" "$TMPDIR_OM/observations.txt" "$OBSERVER_MODEL" << 'PYEOF'
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
    # MiniMax returns Anthropic-format responses
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
    lines = [l for l in text.split('\n') if l.strip()]
    print(f'Observer produced {len(lines)} lines.')
else:
    print('ERROR: No observations produced.')
    sys.exit(1)
PYEOF

OBSERVATIONS=$(cat "$TMPDIR_OM/observations.txt")

if [[ -z "$OBSERVATIONS" ]]; then
  echo "Observer failed to produce observations. Skipping."
  exit 1
fi

if $DRY_RUN; then
  echo "--- DRY RUN: Would write these observations ---"
  cat "$TMPDIR_OM/observations.txt"
  exit 0
fi

# --- Write observations to MEMORY.md (all file I/O in Python, no shell interpolation) ---
python3 - "$MEMORY_FILE" "$TMPDIR_OM/observations.txt" "$MAX_OBSERVATION_CHARS" << 'PYEOF'
import os, re, sys

memory_file = sys.argv[1]
obs_file = sys.argv[2]
max_chars = int(sys.argv[3])

with open(obs_file, 'r') as f:
    observations = f.read().strip()

existing = ""
if os.path.exists(memory_file):
    with open(memory_file, "r") as f:
        existing = f.read()

obs_pattern = r'(## Observations\n)(.*?)(\n## |\Z)'
match = re.search(obs_pattern, existing, re.DOTALL)

if match:
    existing_obs = match.group(2).strip()
    combined = f"{observations}\n\n{existing_obs}" if existing_obs else observations

    # Truncate if over budget (keep newest observations)
    if len(combined) > max_chars:
        lines = combined.split("\n")
        truncated = []
        total = 0
        for line in lines:
            if total + len(line) + 1 > max_chars:
                break
            truncated.append(line)
            total += len(line) + 1
        combined = "\n".join(truncated)

    before = existing[:match.start()]
    after_text = existing[match.end():]
    suffix = match.group(3)
    if suffix.startswith("\n## "):
        updated = f"{before}## Observations\n\n{combined}\n\n{suffix.lstrip(chr(10))}{after_text}"
    else:
        updated = f"{before}## Observations\n\n{combined}\n"
else:
    new_section = f"\n\n## Observations\n\n{observations}\n"
    if existing.strip():
        updated = existing.rstrip() + new_section
    else:
        updated = f"# Memory\n{new_section}"

with open(memory_file, "w") as f:
    f.write(updated)

print(f"Observations written to {memory_file}")
PYEOF

# --- Update state ---
OBS_COUNT=$(grep -c '^\- ' "$TMPDIR_OM/observations.txt" || echo 0)
python3 - "$STATE_FILE" "$TOTAL_LINES" "$OBS_COUNT" << 'PYEOF'
import json, sys
from datetime import datetime

state_file = sys.argv[1]
total_lines = int(sys.argv[2])
obs_count = int(sys.argv[3])

state = {
    'lastObservedLine': total_lines,
    'lastObservedAt': datetime.now().isoformat(),
    'observationCount': obs_count
}
with open(state_file, 'w') as f:
    json.dump(state, f, indent=2)
print('State updated.')
PYEOF

echo "Observer complete. ${TOTAL_LINES} lines marked as observed."
