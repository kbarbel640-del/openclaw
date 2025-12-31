---
name: coding-supervisor
description: Monitor and supervise AI coding sessions across Claude Code, OpenCode, Codex CLI, Gemini CLI, and Cursor.
metadata: {"clawdis":{"emoji":"👁️","always":true}}
---

# Coding Supervisor

Monitor and supervise AI coding sessions across multiple tools. Ask questions like:
- "What coding sessions are active?"
- "What's happening in OpenCode?"
- "Summarize the Claude Code session in clawdis"
- "Are there any errors in my coding sessions?"
- "What did Codex do in the last hour?"

## Session Locations

| Tool | Session Data | CLI Commands |
|------|-------------|--------------|
| **Claude Code** | `~/.claude/transcripts/ses_*.jsonl` | `claude -r` (resume picker) |
| **OpenCode** | Per-project DB | `opencode session list` |
| **Codex CLI** | `~/.codex/sessions/` | `codex resume` |
| **Gemini CLI** | `~/.gemini/tmp/<hash>/` | `gemini --list-sessions` |
| **Cursor** | `~/Library/Application Support/Cursor/` | N/A (GUI only) |

## Commands to Run

### 1. Check Running Processes
```bash
pgrep -lf "claude|opencode|codex|gemini|Cursor" 2>/dev/null
```

### 2. List Claude Code Sessions (recent)
```bash
ls -lt ~/.claude/transcripts/*.jsonl 2>/dev/null | head -10
```

### 3. Read Claude Code Session (last N lines of most recent)
```bash
# Get most recent session
LATEST=$(ls -t ~/.claude/transcripts/*.jsonl 2>/dev/null | head -1)
# Read last 50 lines (recent activity)
tail -50 "$LATEST" | jq -r 'select(.type) | "\(.type): \(.message // .content // .summary // empty)"' 2>/dev/null
```

### 4. List OpenCode Sessions
```bash
opencode session list 2>/dev/null
```

### 5. List Codex Sessions
```bash
ls -lt ~/.codex/sessions/2025/*/*.json 2>/dev/null | head -10
```

### 6. List Gemini Sessions (per-project)
```bash
ls -lt ~/.gemini/tmp/*/session*.json 2>/dev/null | head -10
```

### 7. Check for Errors in Recent Sessions
```bash
# Claude Code errors
grep -l "error\|Error\|ERROR\|failed\|Failed" ~/.claude/transcripts/*.jsonl 2>/dev/null | head -5

# Look for tool failures or API errors in recent session
LATEST=$(ls -t ~/.claude/transcripts/*.jsonl 2>/dev/null | head -1)
grep -i "error\|failed\|exception" "$LATEST" | tail -10
```

### 8. Get Session Summary
For Claude Code, parse the JSONL to extract:
```bash
LATEST=$(ls -t ~/.claude/transcripts/*.jsonl 2>/dev/null | head -1)
# Count messages
wc -l "$LATEST"
# Get project path from filename or content
basename "$LATEST"
# Get last user message
grep '"role":"user"' "$LATEST" | tail -1 | jq -r '.content' 2>/dev/null
# Get last assistant message
grep '"role":"assistant"' "$LATEST" | tail -1 | jq -r '.content[:200]' 2>/dev/null
```

## Interactive Queries

When user asks about coding sessions, follow this workflow:

1. **"What sessions are active?"**
   - Run `pgrep` to find running processes
   - List recent sessions from each tool
   - Report which tools have active/recent sessions

2. **"What's happening in [tool]?"**
   - Find the most recent session for that tool
   - Read the last 20-50 messages
   - Summarize: current task, recent actions, any issues

3. **"Any errors?"**
   - Grep all recent sessions for error patterns
   - Check for stalled sessions (no recent activity)
   - Report findings with session IDs

4. **"Summarize [project] session"**
   - Find session by project name/path
   - Extract: start time, message count, last activity
   - Summarize: what was being worked on, current status

5. **"What did [tool] do recently?"**
   - Read recent session activity
   - List tool calls, file edits, commands run
   - Highlight completions or issues

## Session File Formats

### Claude Code (JSONL)
Each line is a JSON object with fields like:
- `type`: "user", "assistant", "tool_use", "tool_result"
- `content`: message content
- `timestamp`: ISO timestamp
- `tool_name`: for tool calls

### OpenCode
Uses SQLite database, query via `opencode session list`

### Codex CLI
JSON files in `~/.codex/sessions/YYYY/MM/`

### Gemini CLI
JSON session files in project-specific temp directories

## Supervisor Alerts

Watch for these patterns to alert user:
- **Error**: grep for "error", "Error", "failed", "exception"
- **Stalled**: No new lines in session file for 10+ minutes while process running
- **Approval needed**: grep for "approve", "confirm", "permission", "accept"
- **Completed**: grep for "complete", "done", "finished", "success"

## Example Interactions

**User**: "What coding sessions do I have running?"
**Action**: Run pgrep, list recent sessions, summarize status

**User**: "What's Claude Code doing in the clawdis project?"
**Action**: Find session with "clawdis" in path, read recent messages, summarize

**User**: "Are there any errors in my sessions?"
**Action**: Grep all recent sessions for errors, report findings

**User**: "Give me a status update on all coding agents"
**Action**: Check each tool, summarize activity, flag issues
