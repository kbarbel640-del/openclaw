---
summary: "Sub-agents: spawning isolated agent runs that announce results back to the requester chat"
read_when:
  - You want background/parallel work via the agent
  - You are changing sessions_spawn or sub-agent tool policy
---

# Sub-agents

Sub-agents are background agent runs spawned from an existing agent run. They run in their own session (`agent:<agentId>:subagent:<uuid>`) and, when finished, **announce** their result back to the requester chat provider.

Primary goals:
- Parallelize “research / long task / slow tool” work without blocking the main run.
- Keep sub-agents isolated by default (session separation + optional sandboxing).
- Keep the tool surface hard to misuse: sub-agents do **not** get session tools by default.
- Avoid nested fan-out: sub-agents cannot spawn sub-agents.

## Tool

Use `sessions_spawn`:
- Starts a sub-agent run (`deliver: false`, global lane: `subagent`)
- Then runs an announce step and posts the announce reply to the requester chat provider

Tool params:
- `task` (required)
- `label?` (optional)
- `model?` (optional; overrides the sub-agent model; invalid values error)
- `timeoutSeconds?` (default `0`; `0` = fire-and-forget; when set, Clawdbot waits up to N seconds and aborts the sub-agent if it is still running)
- `cleanup?` (`delete|keep`, default `keep` when `timeoutSeconds` is 0, otherwise `delete`)

Auto-archive:
- Sub-agent sessions are automatically archived after `agent.subagents.archiveAfterMinutes` (default: 60).
- Archive uses `sessions.delete` and renames the transcript to `*.deleted.<timestamp>` (same folder).
- `cleanup: "delete"` archives immediately after announce (still keeps the transcript via rename).
- Auto-archive is best-effort; pending timers are lost if the gateway restarts.
- Timeouts do **not** auto-archive; they only stop the run. The session remains until auto-archive.

## Announce

Sub-agents report back via an announce step:
- The announce step runs inside the sub-agent session (not the requester session).
- If the sub-agent replies exactly `ANNOUNCE_SKIP`, nothing is posted.
- Otherwise the announce reply is posted to the requester chat provider via the gateway `send` method.

Announce payloads include a stats line at the end:
- Runtime (e.g., `runtime 5m12s`)
- Token usage (input/output/total)
- Estimated cost when model pricing is configured (`models.providers.*.models[].cost`)
- `sessionKey`, `sessionId`, and transcript path (so the main agent can fetch history via `sessions_history` or inspect the file on disk)

## Tool Policy (sub-agent tools)

By default, sub-agents get **all tools except session tools**:
- `sessions_list`
- `sessions_history`
- `sessions_send`
- `sessions_wait`
- `sessions_spawn`

Override via config:

```json5
{
  agent: {
    subagents: {
      maxConcurrent: 1,
      tools: {
        // deny wins
        deny: ["gateway", "cron"],
        // if allow is set, it becomes allow-only (deny still wins)
        // allow: ["read", "bash", "process"]
      }
    }
  }
}
```

## Concurrency

Sub-agents use a dedicated in-process queue lane:
- Lane name: `subagent`
- Concurrency: `agent.subagents.maxConcurrent` (default `1`)

## Limitations

- Sub-agent announce is **best-effort**. If the gateway restarts, pending “announce back” work is lost.
- Sub-agents still share the same gateway process resources; treat `maxConcurrent` as a safety valve.


## Checking Status

Use `sessions_wait` with the `runId` returned by `sessions_spawn` to get status
and the latest sub-agent messages without blocking the main run.
