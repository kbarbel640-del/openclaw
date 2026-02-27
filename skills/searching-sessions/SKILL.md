---
name: searching-sessions
description: Finds Claude Code and Codex session IDs by searching conversation history. Use when user wants to find old sessions, resume past work, or locate conversations about specific topics.
invocation: user
arguments: "[query]"
---

# Searching Sessions

Find session IDs from Claude Code and Codex history based on content queries.

## Quick Reference

| Source                 | Location                                       | Contains                                         |
| ---------------------- | ---------------------------------------------- | ------------------------------------------------ |
| History index (Claude) | `~/.claude/history.jsonl`                      | User prompts, timestamps, session IDs            |
| History index (Codex)  | `~/.codex/history.jsonl`                       | User prompts, unix timestamps, session IDs       |
| Session files (Claude) | `~/.claude/projects/<project>/<id>.jsonl`      | Full conversations, summaries                    |
| Session files (Codex)  | `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` | Full conversations (response_item), session_meta |
| Summaries (Claude)     | First lines of session JSONL                   | Auto-generated topic summaries                   |

Notes:

- Some older Codex builds also write `~/.codex/projects/<project>/<id>.jsonl`. Prefer `~/.codex/sessions` when present.

## Workflow

### 1. Search History Index (Fast)

```bash
# Claude history (sessionId + display)
if [ -f ~/.claude/history.jsonl ]; then
  rg -i "query" ~/.claude/history.jsonl \
    | jq -r '[.sessionId, .display, "claude"] | @tsv' \
    | head -20
fi

# Codex history (session_id + text + ts)
if [ -f ~/.codex/history.jsonl ]; then
  rg -i "query" ~/.codex/history.jsonl \
    | jq -r '[.session_id, .text, (.ts|tostring), "codex"] | @tsv' \
    | head -20
fi
```

### 2. Claude Session Summaries (Optional)

```bash
# Search summaries across Claude projects
if [ -d ~/.claude/projects ]; then
  for f in ~/.claude/projects/*/*.jsonl; do
    [ -e "$f" ] || continue
    summary=$(head -1 "$f" | jq -r '.summary // empty' 2>/dev/null)
    if echo "$summary" | rg -i -q "query"; then
      id=$(basename "$f" .jsonl)
      project=$(dirname "$f" | xargs basename)
      echo "$id | $project | claude | $summary"
    fi
  done
fi
```

### 3. Codex Session Content Search (Slower, Accurate)

```bash
# Search Codex sessions for user/assistant message content
python3 - <<'PY'
import json, glob, re, os
pat = re.compile("query", re.I)
for f in glob.glob(os.path.expanduser("~/.codex/sessions/**/*.jsonl"), recursive=True):
    try:
        with open(f, "r", encoding="utf-8", errors="ignore") as fh:
            sid = None
            last_ts = None
            matched = False
            for line in fh:
                if not line.strip():
                    continue
                obj = json.loads(line)
                ts = obj.get("timestamp") or obj.get("payload", {}).get("timestamp")
                if ts:
                    last_ts = ts
                if obj.get("type") == "session_meta":
                    sid = obj.get("payload", {}).get("id") or sid
                if obj.get("type") != "response_item":
                    continue
                msg = obj.get("payload", {}).get("message", {})
                content = msg.get("content")
                text = ""
                if isinstance(content, list):
                    for part in content:
                        if isinstance(part, dict) and part.get("text"):
                            text += part["text"] + "\n"
                elif isinstance(content, str):
                    text = content
                if text and pat.search(text):
                    matched = True
                    break
        if matched:
            print(f"{sid or os.path.basename(f)} | codex | {last_ts} | {f}")
    except Exception:
        continue
PY
```

### 4. Resume Session

```bash
# Use the CLI that matches the source
claude --resume <session-id>
codex --resume <session-id>
```

## Output Format

Return results as:

```
ID: <uuid>
Last: <YYYY-MM-DD HH:MM>
Project: <project-path>
Source: <claude|codex>
Summary: <first summary from session>
Match: <relevant excerpt if available>
```

## Search Strategy

1. **Start with history.jsonl** - Fast, contains user prompts (Claude + Codex)
2. **Check summaries** - Auto-generated, good topic coverage
3. **Deep search only if needed** - Full content, but slower

## Data Structure

### Claude history.jsonl Entry

```json
{
  "display": "user prompt text",
  "timestamp": 1767814679721,
  "project": "/Users/klabo/src/ios",
  "sessionId": "uuid-here"
}
```

### Codex history.jsonl Entry

```json
{
  "session_id": "uuid-here",
  "ts": 1770232043,
  "text": "user prompt text"
}
```

### Codex Session JSONL Entry Types

- `session_meta` - Contains `payload.id`, `payload.timestamp`, `payload.cwd`
- `turn_context` - Snapshot of environment/context
- `response_item` - Actual messages with `payload.message.role` + `payload.message.content`

## Tips

- Use `-i` for case-insensitive grep
- Multiple summaries per session = conversation branches
- Codex `ts` is unix seconds; convert with:
  ```bash
  python3 - <<'PY'
  import datetime
  print(datetime.datetime.fromtimestamp(1770232043).isoformat())
  PY
  ```
- Codex session files can be metadata-only; confirm a `response_item` with `role: user` exists before assuming content
- Large sessions (>10MB) are long conversations

## Verification

After searching:

1. **Validate session ID format:** UUID pattern (8-4-4-4-12 hex chars)
2. **Verify session exists:** check `~/.claude/projects` or `~/.codex/sessions` for a matching JSONL file
3. **Test resume:** use the matching CLI for the source
4. **Confirm match:** First lines of session contain expected keywords

```bash
# Quick verification (Claude)
SESSION_ID="<uuid>"
if [ -d ~/.claude/projects ]; then
  matches=("$HOME/.claude/projects"/*/"${SESSION_ID}.jsonl")
  [ -e "${matches[0]}" ] && head -5 "${matches[0]}" | jq -r '.summary // .message // empty'
fi

# Quick verification (Codex session_meta lookup)
python3 - <<'PY'
import json, glob, os
target = os.environ.get("SESSION_ID")
for f in glob.glob(os.path.expanduser("~/.codex/sessions/**/*.jsonl"), recursive=True):
    try:
        with open(f, "r", encoding="utf-8", errors="ignore") as fh:
            for line in fh:
                obj = json.loads(line)
                if obj.get("type") == "session_meta" and obj.get("payload", {}).get("id") == target:
                    print(f)
                    raise SystemExit
    except Exception:
        continue
PY
```

## Reference

- [references/advanced-search.md](references/advanced-search.md) - Complex queries, jq patterns

## Related Skills

- `/creating-skills` - Document learnings from found sessions
