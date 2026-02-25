# Advanced Session Search

Complex queries and patterns for searching Claude Code session history.

## jq Patterns

### Filter by Date Range

```bash
# Sessions from last 7 days
week_ago=$(($(date +%s) * 1000 - 604800000))
cat ~/.claude/history.jsonl | jq -r --argjson cutoff "$week_ago" \
  'select(.timestamp > $cutoff) | [.sessionId, .display] | @tsv'
```

### Filter by Project

```bash
# Sessions for specific project
cat ~/.claude/history.jsonl | jq -r \
  'select(.project | contains("ios")) | [.sessionId, .display] | @tsv'
```

### Get Unique Sessions with Last Prompt

```bash
# Deduplicate sessions, show most recent prompt
cat ~/.claude/history.jsonl | jq -rs \
  'group_by(.sessionId) | map(max_by(.timestamp)) | .[] | [.sessionId, .display[:80]] | @tsv'
```

## Multi-Field Search

### Search Both Prompts and Summaries

```bash
search_all() {
  local query="$1"

  # History prompts
  grep -i "$query" ~/.claude/history.jsonl 2>/dev/null | \
    jq -r '"[history] " + .sessionId + ": " + .display[:60]'

  # Session summaries
  for f in ~/.claude/projects/*/*.jsonl; do
    summary=$(head -1 "$f" | jq -r '.summary // empty' 2>/dev/null)
    if echo "$summary" | grep -qi "$query"; then
      id=$(basename "$f" .jsonl)
      echo "[summary] $id: $summary"
    fi
  done
}
```

## Session Statistics

### Count Sessions per Project

```bash
for dir in ~/.claude/projects/*/; do
  project=$(basename "$dir")
  count=$(ls "$dir"/*.jsonl 2>/dev/null | wc -l)
  echo "$count $project"
done | sort -rn
```

### Find Largest Sessions

```bash
find ~/.claude/projects -name "*.jsonl" -size +1M -exec ls -lh {} \; | \
  awk '{print $5, $9}' | sort -hr | head -10
```

### Sessions by Conversation Length

```bash
for f in ~/.claude/projects/*/*.jsonl; do
  lines=$(wc -l < "$f")
  [[ $lines -gt 100 ]] && echo "$lines $(basename $f .jsonl)"
done | sort -rn | head -10
```

## Content Extraction

### Extract User Messages from Session

```bash
extract_user_messages() {
  local session_id="$1"
  find ~/.claude/projects -name "${session_id}.jsonl" -exec \
    jq -r 'select(.type=="user") | .message.content[0].text // .message.content' {} \;
}
```

### Get All Summaries from Session

```bash
get_summaries() {
  local session_id="$1"
  find ~/.claude/projects -name "${session_id}.jsonl" -exec \
    jq -r 'select(.type=="summary") | .summary' {} \;
}
```

### Extract Tool Usage

```bash
# Find sessions that used specific tools
grep -l "\"tool_use\"" ~/.claude/projects/*/*.jsonl | while read f; do
  if grep -q "\"name\":\"Edit\"" "$f"; then
    echo "$(basename $f .jsonl) - used Edit tool"
  fi
done
```

## Fuzzy Search with fzf

```bash
# Interactive session picker
session_picker() {
  local query="${1:-}"

  # Build list of sessions with summaries
  for f in ~/.claude/projects/*/*.jsonl; do
    [[ ! -s "$f" ]] && continue
    id=$(basename "$f" .jsonl)
    summary=$(head -1 "$f" | jq -r '.summary // "no summary"' 2>/dev/null)
    project=$(dirname "$f" | xargs basename | sed 's/-Users-[^-]*-//')
    echo "$id | $project | $summary"
  done | fzf --query="$query" --preview='
    id=$(echo {} | cut -d"|" -f1 | tr -d " ")
    find ~/.claude/projects -name "${id}.jsonl" -exec head -20 {} \;
  '
}
```

## Combining Searches

### Find Related Sessions

```bash
# Find sessions related to a topic across time
find_related() {
  local topic="$1"
  echo "=== Sessions about: $topic ==="

  # Get session IDs
  ids=$(grep -li "$topic" ~/.claude/projects/*/*.jsonl 2>/dev/null | \
    xargs -I{} basename {} .jsonl | sort -u)

  for id in $ids; do
    # Get timestamp from history
    ts=$(grep "\"sessionId\":\"$id\"" ~/.claude/history.jsonl | \
      jq -r '.timestamp' | head -1)

    # Convert to date
    if [[ -n "$ts" ]]; then
      date=$(date -r $((ts/1000)) "+%Y-%m-%d %H:%M" 2>/dev/null || echo "unknown")
    else
      date="unknown"
    fi

    # Get summary
    summary=$(find ~/.claude/projects -name "${id}.jsonl" -exec \
      head -1 {} \; | jq -r '.summary // empty' 2>/dev/null)

    echo "[$date] $id"
    echo "  $summary"
    echo ""
  done
}
```

## Third-Party Tools

Community tools for enhanced searching:

- **claude-history** (Rust): fzf-powered fuzzy finder
- **claude-conversation-extractor** (Python): Full-text search UI
- **Claude Code History Viewer** (Electron): Desktop app with search

Install via:

```bash
# Rust
cargo install claude-history

# Python
pip install claude-conversation-extractor
```
