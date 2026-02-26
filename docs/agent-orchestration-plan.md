---
summary: "Reference plan for agent orchestration using the agent loop, sub-agents, cron, heartbeat, and Lobster"
read_when:
  - Designing a multi-agent workflow (main agent + sub-agents)
  - Deciding how to schedule, isolate, or approve orchestrated work
  - Defining retry and operator recovery behavior
title: "Agent Orchestration Plan"
---

# Agent Orchestration Plan

This plan describes a practical default architecture for orchestrating work in OpenClaw using:

- the core [Agent Loop](/concepts/agent-loop)
- [Sub-agents](/tools/subagents) for parallel background work
- [Cron jobs](/automation/cron-jobs) and [Heartbeat](/gateway/heartbeat) for scheduling
- [Lobster](/tools/lobster) for deterministic multi-step workflows with approvals

Use this as a baseline for operating an "orchestrator" agent that delegates tasks, collects results, and delivers summaries safely.

## Architecture

### Core roles

- **Main agent (orchestrator)**: receives user requests, decides whether work should stay in the main session, run as an isolated cron job, or be delegated to sub-agents.
- **Sub-agents (workers)**: run isolated background tasks in `agent:<agentId>:subagent:<uuid>` sessions and announce results back to the requester channel.
- **Scheduler**: cron and heartbeat trigger background orchestration at the correct time.
- **Workflow runtime**: Lobster executes deterministic pipelines with pause/resume approval gates for side effects.
- **Queue and session lanes**: OpenClaw serializes runs per session and caps global concurrency to avoid session/tool collisions.

### Recommended topology

```text
User / Channel / CLI
        |
        v
   Main agent (orchestrator)
        |
        +--> direct tool calls (fast path)
        |
        +--> sessions_spawn -> sub-agents (parallel worker tasks)
        |
        +--> lobster tool -> deterministic pipeline + approval gate
        |
        +--> cron add / heartbeat config (scheduled follow-up)
        |
        v
  announce / channel delivery / session summaries
```

### Session and concurrency boundaries

- Keep the **main session** focused on coordination, decisions, and final summaries.
- Push expensive or noisy work into **sub-agents** or **isolated cron** sessions.
- Rely on the built-in queue model:
  - per-session serialization prevents transcript and tool races
  - global lane caps limit overall concurrent agent runs
  - separate lanes (for example `main`, `subagent`, `cron`) let background work proceed without blocking all inbound traffic

## Workflow

### Standard orchestration flow

1. **Intake**
   - Request arrives from a chat channel, `openclaw agent`, heartbeat, or cron.
2. **Classify**
   - Decide if the task is:
   - a direct main-session action
   - a delegated sub-agent task
   - a scheduled follow-up (cron/heartbeat)
   - a deterministic pipeline (Lobster)
3. **Execute**
   - Main agent runs quick steps directly.
   - Parallel/slow work goes to sub-agents (`sessions_spawn` or `/subagents spawn`).
   - Multi-step side-effect workflows go through Lobster with approval gates.
4. **Collect**
   - Sub-agents announce results back to the requester channel.
   - Main agent synthesizes worker outputs into one user-facing summary.
5. **Persist and schedule**
   - If follow-up is needed, create or update cron jobs.
   - If recurring background checks fit main context, encode them in `HEARTBEAT.md` and heartbeat config.

### Scheduling choices

- **Heartbeat** for periodic awareness in the main session (context-aware checks, batched monitoring).
- **Cron main session** for timed system events that should flow into the next or immediate heartbeat.
- **Cron isolated** for precise scheduled jobs that should not pollute the main session.

See [Cron vs Heartbeat](/automation/cron-vs-heartbeat) when deciding.

### When to use Lobster vs sub-agents

- Use **sub-agents** when the task is open-ended and agentic (research, tool-heavy exploration, long-running background work).
- Use **Lobster** when the task is a fixed pipeline with explicit approval checkpoints and resumable state.
- It is reasonable to combine them:
  - cron or heartbeat triggers the main agent
  - main agent invokes Lobster for deterministic steps
  - main agent delegates ambiguous or research steps to sub-agents

## Retries and recovery

Retry behavior should be intentional. Prefer isolation and idempotency before increasing retry counts.

### Built-in retry and resilience behavior

- **Per-session serialization** reduces collision-driven failures before retries are needed.
- **Auto-compaction retry**: the agent loop can retry after compaction; transient buffers/tool summaries are reset to avoid duplicate output.
- **Sub-agent announce delivery**:
  - manual sub-agent completion delivery tries direct `agent` delivery first
  - falls back to queue routing if direct delivery is unavailable
  - failed announces are retried with short exponential backoff
- **Announce queue drain backoff** (internal queue): exponential backoff on consecutive failures (2s, 4s, 8s, capped at 60s).
- **`agent.wait` timeout** is wait-only:
  - timing out a wait does not stop the underlying agent run
  - callers can retry the wait or inspect logs/results later

### Retry policy for orchestration plans

- Make worker tasks safe to rerun:
  - prefer read-first workflows
  - add approval gates before irreversible side effects
  - include stable identifiers in messages/jobs so duplicates are easier to detect
- Set explicit timeouts for delegated work:
  - `sessions_spawn.runTimeoutSeconds` for sub-agents
  - `timeoutSeconds` for isolated cron jobs
- Separate retry domains:
  - retry **delivery** independently from **computation**
  - do not automatically rerun the expensive model step just because a channel send failed
- Use `delivery.bestEffort` on cron announce delivery when delivery failure should not fail the job itself

### Operator recovery playbook

- **Sub-agent looks stuck**
  - `/subagents list`
  - `/subagents info <id>`
  - `/subagents log <id> [limit] [tools]`
  - `/subagents kill <id>` then respawn if needed
- **Cron job failed**
  - inspect recent runs with `openclaw cron runs --id <jobId> --limit 20`
  - fix config/target, then `openclaw cron run <jobId>`
- **Wait timed out but run may still be active**
  - retry the wait in the caller, or inspect the session/transcript and subagent logs before rerunning the task

## Daily commands

These commands are a practical daily checklist for operating an orchestrated setup.

### Daily CLI checks

```bash
# Channel connectivity and probe health
openclaw channels status --probe

# Scheduled work inventory
openclaw cron list

# Recent scheduler outcomes (global or per job)
openclaw cron runs --limit 20
# openclaw cron runs --id <jobId> --limit 20

# Hook health (if you rely on hooks during orchestration)
openclaw hooks check

# Quick direct orchestration test run
openclaw agent --agent main --message "Health check: summarize queue, cron, and sub-agent status" --json
```

### Daily in-chat operator commands

```text
/subagents list
/subagents info <id|#>
/subagents log <id|#> 100 tools
/subagents kill <id|#|all>
/queue collect
```

### Useful manual retry commands

```bash
# Rerun a scheduled job after a fix
openclaw cron run <jobId>

# Send a targeted follow-up prompt to the main agent
openclaw agent --agent main --message "Retry the failed orchestration step for job <jobId> and summarize what changed"
```

## Operating defaults for a new orchestration setup

- Start with one main orchestrator agent and one or two worker patterns.
- Use sub-agents for parallelism before increasing global concurrency.
- Keep recurring checks in heartbeat unless exact timing is required.
- Move exact-time jobs to isolated cron sessions.
- Add Lobster only for workflows that need deterministic steps and approval/resume.
- Review retry paths with a manual failure drill before enabling unattended schedules.
