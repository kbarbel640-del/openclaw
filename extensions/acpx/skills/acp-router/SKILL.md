---
name: acp-router
description: Route plain-language requests for Codex, Claude Code, Gemini CLI, or ACP harness work into either OpenClaw ACP runtime sessions or direct acpx-driven sessions ("telephone game" flow).
user-invocable: false
---

# ACP Harness Router

When user intent is "run this in Codex/Claude Code/Gemini (ACP harness)", do not use subagent runtime or PTY scraping. Route through ACP-aware flows.

## Intent detection

Trigger this skill when the user asks OpenClaw to:

- run something in Codex / Claude Code / Gemini
- continue existing harness work
- relay instructions to an external coding harness
- keep an external harness conversation in a thread-like conversation

## Mode selection

Choose one of these paths:

1. OpenClaw ACP runtime path (default): use `sessions_spawn` / ACP runtime tools.
2. Direct `acpx` path (telephone game): use `acpx` CLI through `exec` to drive the harness session directly.

Use direct `acpx` when one of these is true:

- user explicitly asks for direct `acpx` driving
- ACP runtime/plugin path is unavailable or unhealthy
- the task is "just relay prompts to harness" and no OpenClaw ACP lifecycle features are needed

Do not use:

- `subagents` runtime for harness control
- `/acp` command delegation as a requirement for the user
- PTY scraping of codex/claude/gemini CLIs when `acpx` is available

## AgentId mapping

Use these defaults when user names a harness directly:

- "codex" -> `agentId: "codex"`
- "claude code" -> `agentId: "claudecode"`
- "gemini" or "gemini cli" -> `agentId: "gemini"`

If policy rejects the chosen id, report the policy error clearly and ask for the allowed ACP agent id.

## OpenClaw ACP runtime path

Required behavior:

1. Use `sessions_spawn` with:
   - `runtime: "acp"`
   - `thread: true`
   - `mode: "session"` (unless user explicitly wants one-shot)
2. Put requested work in `task` so the ACP session gets it immediately.
3. Set `agentId` explicitly unless ACP default agent is known.
4. Do not ask user to run slash commands or CLI when this path works directly.

Example:

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

## Direct acpx path ("telephone game")

Use this path to drive harness sessions without `/acp` or subagent runtime.

### Rules

1. Use `exec` commands that call `acpx` directly.
2. Reuse a stable session name per conversation so follow-up prompts stay in the same harness context.
3. Prefer `--format quiet` for clean assistant text to relay back to user.
4. Use `exec` (one-shot) only when the user wants one-shot behavior.
5. Keep working directory explicit (`--cwd`) when task scope depends on repo context.

### Session naming

Use a deterministic name, for example:

- `oc-<harness>-<conversationId>`

Where `conversationId` is thread id when available, otherwise channel/conversation id.

### Command templates

Persistent session (create if missing, then prompt):

```bash
acpx codex sessions show oc-codex-<conversationId> \
  || acpx codex sessions new --name oc-codex-<conversationId>

acpx codex -s oc-codex-<conversationId> --cwd <workspacePath> --format quiet "<prompt>"
```

One-shot:

```bash
acpx codex exec --cwd <workspacePath> --format quiet "<prompt>"
```

Cancel in-flight turn:

```bash
acpx codex cancel -s oc-codex-<conversationId>
```

Close session:

```bash
acpx codex sessions close oc-codex-<conversationId>
```

### Harness aliases in acpx

- `codex`
- `claude`
- `gemini`

### Failure handling

- `acpx: command not found`: report that acpx is missing and provide install action.
- `NO_SESSION`: run `acpx <agent> sessions new --name <sessionName>` then retry prompt.
- queue busy: either wait for completion (default) or use `--no-wait` when async behavior is explicitly desired.

### Output relay

When relaying to user, return the final assistant text output from `acpx` command result. Avoid relaying raw local tool noise unless user asked for verbose logs.
