---
summary: "Sub-agents: spawning isolated agent runs that report results back to the main session"
read_when:
  - You want background/parallel work via the agent
  - You are changing sessions_spawn or sub-agent tool policy
---

# Sub-agents

Sub-agents are background agent runs spawned from an existing agent run. They run in their own session (`agent:<agentId>:subagent:<uuid>`) and use the `report_back` tool to send results to the main session.

Primary goals:
- Parallelize "research / long task / slow tool" work without blocking the main run.
- Keep sub-agents isolated by default (session separation + optional sandboxing).
- Avoid nested fan-out: sub-agents cannot spawn sub-agents.

## Tool

Use `sessions_spawn`:
- Starts a sub-agent run (`deliver: false`, global lane: `subagent`)
- Sub-agent uses `report_back` tool to send results back when done
- Default model: inherits the caller unless you set `agents.defaults.subagents.model` (or per-agent `agents.list[].subagents.model`); an explicit `sessions_spawn.model` still wins.

Tool params:
- `task` (required)
- `label?` (optional)
- `agentId?` (optional; spawn under another agent id if allowed)
- `model?` (optional; overrides the sub-agent model; invalid values are skipped and the sub-agent runs on the default model with a warning in the tool result)
- `runTimeoutSeconds?` (default `0`; when set, the sub-agent run is aborted after N seconds)
- `cleanup?` (`delete|keep`, default `keep`)

Allowlist:
- `agents.list[].subagents.allowAgents`: list of agent ids that can be targeted via `agentId` (`["*"]` to allow any). Default: only the requester agent.

Discovery:
- Use `agents_list` to see which agent ids are currently allowed for `sessions_spawn`.

Auto-archive:
- Sub-agent sessions are automatically archived after `agents.defaults.subagents.archiveAfterMinutes` (default: 60).
- Archive uses `sessions.delete` and renames the transcript to `*.deleted.<timestamp>` (same folder).
- `cleanup: "delete"` archives immediately after completion (still keeps the transcript via rename).
- Auto-archive is best-effort; pending timers are lost if the gateway restarts.
- `runTimeoutSeconds` does **not** auto-archive; it only stops the run. The session remains until auto-archive.

## Reporting Results

Sub-agents use `report_back` to send results to the main session:
- Injects message into main session transcript (so main agent has context)
- Sends to messaging channels (Telegram, WhatsApp, etc.) if main session has one
- `internalOnly: true` injects to transcript only (no external send)

Behavior is task-driven:
- Default: report once when task completes
- Can report multiple times if task says so ("report progress")
- Can skip if task says "no report" or task failed completely

## Tool Policy (sub-agent tools)

By default, sub-agents get **all tools except**:
- `sessions_send` (use `report_back` instead)
- `sessions_spawn` (prevents infinite loops)
- `message` (use `report_back` instead)

Sub-agents **can** use:
- `sessions_list`, `sessions_history` (read-only)
- `gateway`, `cron`, `browser`, file tools, etc.

Override via config:

```json5
{
  agents: {
    defaults: {
      subagents: {
        maxConcurrent: 1
      }
    }
  },
  tools: {
    subagents: {
      tools: {
        // deny wins
        deny: ["gateway", "cron"],
        // if allow is set, it becomes allow-only (deny still wins)
        // allow: ["read", "exec", "process"]
      }
    }
  }
}
```

## Sub-agent Context

Sub-agents receive the same context as the main agent:
- Workspace files (`AGENTS.md`, `TOOLS.md`, `SOUL.md`, `IDENTITY.md`, `USER.md`, `MEMORY.md`)
- Tool summaries and availability
- Model aliases, user timezone, skills, runtime info

The sub-agent system prompt adds:
- Stay focused on assigned task
- Use `report_back` to communicate results
- No heartbeats or proactive actions
- Report back if blocked or confused

## Concurrency

Sub-agents use a dedicated in-process queue lane:
- Lane name: `subagent`
- Concurrency: `agents.defaults.subagents.maxConcurrent` (default `1`)

## Limitations

- Cleanup is **best-effort**; pending work may be lost if gateway restarts.
- Sub-agents share gateway process resources; treat `maxConcurrent` as a safety valve.
- `sessions_spawn` is always non-blocking: returns `{ status: "accepted", runId, childSessionKey }` immediately.
