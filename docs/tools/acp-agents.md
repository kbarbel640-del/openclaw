---
summary: "Use ACP runtime sessions for Codex, Claude Code, Gemini CLI, and other harness agents"
read_when:
  - Running coding harnesses through ACP
  - Setting up thread-bound ACP sessions on Discord
  - Troubleshooting ACP backend and plugin wiring
title: "ACP Agents"
---

# ACP agents

ACP sessions run external coding harnesses through an ACP runtime backend. Common backends include Codex, Claude Code, Gemini CLI, and other ACP-compatible adapters.

In OpenClaw, ACP is a separate runtime from OpenClaw sub-agents.

## ACP versus sub-agents

Use ACP when you want an external harness runtime. Use sub-agents when you want OpenClaw native delegated runs.

| Area          | ACP session                           | Sub-agent run                      |
| ------------- | ------------------------------------- | ---------------------------------- |
| Runtime       | ACP backend plugin (for example acpx) | OpenClaw native sub-agent runtime  |
| Session key   | `agent:<agentId>:acp:<uuid>`          | `agent:<agentId>:subagent:<uuid>`  |
| Main commands | `/acp ...`                            | `/subagents ...`                   |
| Spawn tool    | `sessions_spawn` with `runtime:"acp"` | `sessions_spawn` (default runtime) |

See also [Sub-agents](/tools/subagents).

## Start ACP sessions

### From `sessions_spawn`

Use `runtime: "acp"` to start an ACP session from an agent turn.

```json
{
  "task": "Open the repo and summarize failing tests",
  "runtime": "acp",
  "agentId": "codex",
  "thread": true,
  "mode": "session"
}
```

Notes:

- `runtime` defaults to `subagent`, so set `runtime: "acp"` explicitly for ACP sessions.
- If `agentId` is omitted, OpenClaw uses `acp.defaultAgent` when configured.
- `mode: "session"` requires `thread: true`.

### From `/acp` command

Use `/acp spawn` for explicit operator control from chat.

```text
/acp spawn codex --mode persistent --thread auto
/acp spawn codex --mode oneshot --thread off
/acp spawn codex --thread here
```

Key flags:

- `--mode persistent|oneshot`
- `--thread auto|here|off`
- `--cwd <absolute-path>`
- `--label <name>`

See [Slash Commands](/tools/slash-commands).

## Thread-bound behavior on Discord

When thread binding is enabled, ACP sessions can be bound to Discord threads:

- Spawn creates or binds a thread.
- Follow-up user messages in that thread route to the bound ACP session.
- Output is delivered back in the same thread.
- `/focus <target>` and `/unfocus` also work with ACP session keys.

Thread-bound ACP spawn on Discord requires:

- `channels.discord.threadBindings.enabled=true` (or global `session.threadBindings.enabled=true`)
- `channels.discord.threadBindings.spawnAcpSessions=true`

## ACP controls

Available command family:

- `/acp spawn`
- `/acp cancel`
- `/acp steer`
- `/acp close`
- `/acp status`
- `/acp set-mode`
- `/acp set`
- `/acp cwd`
- `/acp permissions`
- `/acp timeout`
- `/acp model`
- `/acp reset-options`
- `/acp sessions`
- `/acp doctor`
- `/acp install`

`/acp status` shows the effective runtime options and, when available, both runtime-level and backend-level session identifiers.

Some controls depend on backend capabilities. If a backend does not support a control, OpenClaw returns a clear unsupported-control error.

## Required config

Example baseline:

```json5
{
  acp: {
    enabled: true,
    dispatch: { enabled: true },
    backend: "acpx",
    defaultAgent: "codex",
    allowedAgents: ["codex", "claude", "gemini"],
    maxConcurrentSessions: 8,
    stream: {
      coalesceIdleMs: 300,
      maxChunkChars: 1200,
    },
    runtime: {
      ttlMinutes: 120,
    },
  },
  channels: {
    discord: {
      threadBindings: {
        enabled: true,
        spawnAcpSessions: true,
      },
    },
  },
}
```

See [Configuration Reference](/gateway/configuration-reference).

## Plugin setup for acpx backend

Install and enable plugin:

```bash
openclaw plugins install @openclaw/acpx
openclaw config set plugins.entries.acpx.enabled true
```

Local workspace install during development:

```bash
openclaw plugins install ./extensions/acpx
```

Then verify backend health:

```text
/acp doctor
```

See [Plugins](/tools/plugin).

## Troubleshooting

- Error: `ACP runtime backend is not configured`  
  Install and enable the configured backend plugin, then run `/acp doctor`.

- Error: ACP dispatch disabled  
  Enable `acp.dispatch.enabled=true`.

- Error: target agent not allowed  
  Pass an allowed `agentId` or update `acp.allowedAgents`.

- Error: missing ACP metadata for a bound session  
  Recreate the session with `/acp spawn` and rebind the thread.
