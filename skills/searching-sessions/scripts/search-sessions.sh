#!/usr/bin/env bash
# search-sessions.sh - Find Claude Code sessions by query
# Usage: search-sessions.sh "query" [--deep] [--limit N]

set -euo pipefail

QUERY="${1:-}"
DEEP=false
LIMIT=10

# Parse arguments
shift || true
while [[ $# -gt 0 ]]; do
  case $1 in
    --deep) DEEP=true; shift ;;
    --limit) LIMIT="$2"; shift 2 ;;
    *) shift ;;
  esac
done

if [[ -z "$QUERY" ]]; then
  echo "Usage: search-sessions.sh \"query\" [--deep] [--limit N]"
  exit 1
fi

CLAUDE_DIR="${HOME}/.claude"
HISTORY_FILE="${CLAUDE_DIR}/history.jsonl"
PROJECTS_DIR="${CLAUDE_DIR}/projects"

# Track seen sessions in temp file (POSIX compatible)
SEEN_FILE=$(mktemp)
trap "rm -f $SEEN_FILE" EXIT

is_seen() {
  grep -qx "$1" "$SEEN_FILE" 2>/dev/null
}

mark_seen() {
  echo "$1" >> "$SEEN_FILE"
}

# Get last timestamp from a session file (ISO format -> human readable)
get_last_timestamp() {
  local file="$1"
  local ts=$(tac "$file" 2>/dev/null | jq -r 'select(.timestamp) | .timestamp' 2>/dev/null | head -1)
  if [[ -n "$ts" && "$ts" != "null" ]]; then
    # Convert ISO timestamp to readable format
    # Handle both ISO format (2026-01-16T05:58:03.092Z) and epoch ms
    if [[ "$ts" =~ ^[0-9]+$ ]]; then
      # Epoch milliseconds
      date -r $((ts/1000)) "+%Y-%m-%d %H:%M" 2>/dev/null || echo "$ts"
    else
      # ISO format - extract date and time
      echo "$ts" | sed 's/T/ /; s/\.[0-9]*Z$//' | cut -c1-16
    fi
  else
    echo "unknown"
  fi
}

echo "=== Searching for: $QUERY ==="
echo ""

# Phase 1: Search history.jsonl (user prompts)
echo "--- History Index Matches ---"
count=0
while IFS=$'\t' read -r session_id display; do
  if [[ -n "$session_id" ]] && ! is_seen "$session_id"; then
    mark_seen "$session_id"

    # Find session file to get timestamp
    session_file=$(find "$PROJECTS_DIR" -name "${session_id}.jsonl" 2>/dev/null | head -1)
    if [[ -n "$session_file" && -f "$session_file" ]]; then
      last_ts=$(get_last_timestamp "$session_file")
    else
      last_ts="unknown"
    fi

    # Truncate display to 80 chars
    short_display="${display:0:80}"
    [[ ${#display} -gt 80 ]] && short_display="${short_display}..."
    echo "ID: $session_id"
    echo "Last: $last_ts"
    echo "Prompt: $short_display"
    echo ""
    count=$((count + 1))
    [[ $count -ge $LIMIT ]] && break
  fi
done < <(grep -i "$QUERY" "$HISTORY_FILE" 2>/dev/null | jq -r '[.sessionId, .display] | @tsv' || true)

[[ $count -eq 0 ]] && echo "(no matches in history)"
echo ""

# Phase 2: Search session summaries
echo "--- Session Summary Matches ---"
count=0
for f in "$PROJECTS_DIR"/*/*.jsonl; do
  [[ ! -f "$f" ]] && continue
  [[ ! -s "$f" ]] && continue  # Skip empty files

  session_id=$(basename "$f" .jsonl)
  is_seen "$session_id" && continue

  summary=$(head -1 "$f" | jq -r '.summary // empty' 2>/dev/null || true)

  if echo "$summary" | grep -qi "$QUERY" 2>/dev/null; then
    mark_seen "$session_id"
    project=$(dirname "$f" | xargs basename | sed 's/-Users-[^-]*-/~\//')
    last_ts=$(get_last_timestamp "$f")
    echo "ID: $session_id"
    echo "Last: $last_ts"
    echo "Project: $project"
    echo "Summary: $summary"
    echo ""
    count=$((count + 1))
    [[ $count -ge $LIMIT ]] && break
  fi
done

[[ $count -eq 0 ]] && echo "(no matches in summaries)"
echo ""

# Phase 3: Deep content search (optional)
if $DEEP; then
  echo "--- Deep Content Matches ---"
  count=0
  for f in "$PROJECTS_DIR"/*/*.jsonl; do
    [[ ! -f "$f" ]] && continue
    [[ ! -s "$f" ]] && continue

    session_id=$(basename "$f" .jsonl)
    is_seen "$session_id" && continue

    if grep -qi "$QUERY" "$f" 2>/dev/null; then
      mark_seen "$session_id"
      project=$(dirname "$f" | xargs basename | sed 's/-Users-[^-]*-/~\//')
      summary=$(head -1 "$f" | jq -r '.summary // empty' 2>/dev/null || true)
      last_ts=$(get_last_timestamp "$f")

      echo "ID: $session_id"
      echo "Last: $last_ts"
      echo "Project: $project"
      echo "Summary: ${summary:-<no summary>}"

      # Extract first matching line for context
      match=$(grep -i -m1 "$QUERY" "$f" 2>/dev/null | head -c 200 || true)
      if [[ -n "$match" ]]; then
        echo "Match: ${match}..."
      fi
      echo ""
      count=$((count + 1))
      [[ $count -ge $LIMIT ]] && break
    fi
  done

  [[ $count -eq 0 ]] && echo "(no additional matches in content)"
fi

echo "=== Done ==="
echo "Resume a session with: claude --resume <session-id>"
