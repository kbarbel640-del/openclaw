---
name: session-manager
description: Manage and inspect Moltbot sessions. Use when the user says /sessions, /session peek, /session tell, or asks about active sessions, what other sessions are doing, or wants to send instructions to another session.
---

# Session Manager

Unified interface for inspecting and directing Moltbot sessions.

## Commands

### `/sessions` — List active sessions with summaries

1. Call `sessions_list` with `messageLimit: 1` to get all sessions + last message
2. Format as a compact list:

```
📋 Active Sessions

🟢 <label/kind> (key: <sessionKey>)
   └─ <last message snippet, ≤80 chars>

🟢 <label/kind> (key: <sessionKey>)
   └─ <last message snippet>
...
```

- Show `label` if available, otherwise `kind`
- Mark sessions with recent activity (< 30 min) as 🟢, older as ⚪
- Show total count at the bottom

### `/session peek <identifier>` — View recent context

1. Identify the session by label or sessionKey (fuzzy match on label)
2. Call `sessions_history` with `sessionKey`, `limit: 15`, `includeTools: false`
3. Format as a readable conversation:

```
👁️ Peeking: <label> (key: <sessionKey>)

[HH:MM] 👤 User: <message snippet>
[HH:MM] 🤖 Assistant: <message snippet>
...
```

- Truncate each message to ~200 chars
- Show timestamps if available
- Summarize tool calls as `[used: toolName]` instead of showing full content

### `/session tell <identifier> <message>` — Send instruction to a session

1. Identify the session by label or sessionKey
2. Call `sessions_send` with `sessionKey` and `message`
3. Confirm:

```
📨 Sent to <label>:
"<message>"
```

### `/session spawn <task>` — Spawn isolated sub-agent

1. Call `sessions_spawn` with `task`
2. Confirm with the returned session info

## Matching Logic

When `<identifier>` is provided:
- Try exact match on `sessionKey` first
- Then fuzzy match on `label` (case-insensitive, partial match OK)
- If ambiguous, show candidates and ask user to clarify

## Notes

- This skill wraps `sessions_list`, `sessions_history`, `sessions_send`, and `sessions_spawn`
- No new infrastructure needed — pure workflow on existing Moltbot tools
- Keep output concise for Telegram (no markdown tables, use emoji + indentation)
