---
name: searching-sessions
description: Finds Claude Code session IDs by searching conversation history. Use when user wants to find old sessions, resume past work, or locate conversations about specific topics.
invocation: user
arguments: "[query]"
---

# Searching Sessions

Find session IDs from Claude Code history based on content queries.

## Quick Reference

| Source        | Location                                  | Contains                              |
| ------------- | ----------------------------------------- | ------------------------------------- |
| History index | `~/.claude/history.jsonl`                 | User prompts, timestamps, session IDs |
| Session files | `~/.claude/projects/<project>/<id>.jsonl` | Full conversations, summaries         |
| Summaries     | First lines of session JSONL              | Auto-generated topic summaries        |

## Workflow

### 1. Search History Index (Fast)

```bash
# Search user prompts in history
grep -i "query" ~/.claude/history.jsonl | jq -r '[.sessionId, .display] | @tsv' | head -20
```

### 2. Search Session Summaries

```bash
# Search summaries across all projects
for f in ~/.claude/projects/*/*.jsonl; do
  summary=$(head -1 "$f" | jq -r '.summary // empty' 2>/dev/null)
  if echo "$summary" | grep -qi "query"; then
    id=$(basename "$f" .jsonl)
    project=$(dirname "$f" | xargs basename)
    echo "$id | $project | $summary"
  fi
done
```

### 3. Deep Content Search (Slower)

```bash
# Search full conversation content
for f in ~/.claude/projects/*/*.jsonl; do
  if grep -qi "query" "$f" 2>/dev/null; then
    id=$(basename "$f" .jsonl)
    summary=$(head -1 "$f" | jq -r '.summary // empty' 2>/dev/null)
    echo "$id: $summary"
  fi
done
```

### 4. Resume Session

```bash
claude --resume <session-id>
```

## Output Format

Return results as:

```
ID: <uuid>
Last: <YYYY-MM-DD HH:MM>
Project: <project-path>
Summary: <first summary from session>
Match: <relevant excerpt if available>
```

## Search Strategy

1. **Start with history.jsonl** - Fast, contains user prompts
2. **Check summaries** - Auto-generated, good topic coverage
3. **Deep search only if needed** - Full content, but slower

## Data Structure

### history.jsonl Entry

```json
{
  "display": "user prompt text",
  "timestamp": 1767814679721,
  "project": "/Users/klabo/src/ios",
  "sessionId": "uuid-here"
}
```

### Session JSONL Entry Types

- `summary` - Auto-generated conversation summaries
- `user` - User messages
- `assistant` - Claude responses
- `file-history-snapshot` - File state snapshots

## Tips

- Use `-i` for case-insensitive grep
- Multiple summaries per session = conversation branches
- Empty sessions (0 bytes) are abandoned starts
- Large sessions (>10MB) are long conversations

## Verification

After searching:

1. **Validate session ID format:** UUID pattern (8-4-4-4-12 hex chars)
2. **Verify session exists:** `ls ~/.claude/projects/*/<session-id>.jsonl` finds file
3. **Test resume:** `claude --resume <session-id>` loads without error
4. **Confirm match:** First lines of session contain expected keywords

```bash
# Quick verification
SESSION_ID="<uuid>"
ls ~/.claude/projects/*/${SESSION_ID}.jsonl 2>/dev/null && echo "Found" || echo "Not found"
head -5 ~/.claude/projects/*/${SESSION_ID}.jsonl | jq -r '.summary // .message // empty'
```

## Reference

- [references/advanced-search.md](references/advanced-search.md) - Complex queries, jq patterns

## Related Skills

- `/creating-skills` - Document learnings from found sessions
