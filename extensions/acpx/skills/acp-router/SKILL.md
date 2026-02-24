---
name: acp-router
description: Route plain-language requests for Codex, Claude Code, Gemini CLI, or ACP harness work into ACP runtime spawns. Use when the user asks to run, spawn, or continue work in one of these harnesses, especially on Discord where thread-bound sessions are expected.
user-invocable: false
---

# ACP Harness Thread Router

When user intent is "run this in Codex/Claude Code/Gemini (ACP harness)", use OpenClaw ACP sessions instead of local CLI PTY flows.

## Required behavior

1. Use `sessions_spawn` with:
   - `runtime: "acp"`
   - `thread: true`
   - `mode: "session"` (unless the user explicitly asks for one-shot)
2. Put the requested work in `task` so the spawned ACP session receives it immediately.
3. Set `agentId` explicitly unless ACP default agent is known to be configured.
4. Do not ask the user to run slash commands or CLI when `sessions_spawn` can perform the action directly.
5. Do not use `subagents` tool for ACP harness control; `subagents` is for runtime `"subagent"` only.
6. Do not use local `exec`/PTY Codex/Claude/Gemini commands for this intent.

## AgentId mapping

Use these defaults when user names a harness directly:

- "codex" -> `agentId: "codex"`
- "claude code" -> `agentId: "claudecode"`
- "gemini" or "gemini cli" -> `agentId: "gemini"`

If policy rejects the chosen id, report the policy error clearly and ask for the allowed ACP agent id.

## Example

User: "spawn a test codex session in thread and tell it to say hi"

Call:

```json
{
  "task": "Say hi.",
  "runtime": "acp",
  "agentId": "codex",
  "thread": true,
  "mode": "session"
}
```
