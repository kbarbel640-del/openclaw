---
summary: "Proposal: standalone task scheduler with implicit heartbeat and inter-agent messaging"
title: "Standalone Task Scheduler (RFC)"
---

# Standalone Task Scheduler

**Status:** Proposal (working implementation exists)
**Author:** @amittell
**Area:** Scheduling, heartbeat, inter-agent messaging

## Problem

OpenClaw's built-in cron stores jobs in a flat JSON file
(`~/.openclaw/cron/jobs.json`). No run history, no stale detection,
no overlap control, no failure recovery. The heartbeat system fires
agent turns on a timer but has no concept of job lifecycle — if an
agent hangs mid-job, the only signal is silence.

1. **No run history.** A job fires and the result disappears. No way
   to know if yesterday's 6 AM audit ran, failed, or timed out.
2. **No stale detection.** If an agent hangs, you find out when you
   notice the silence. No awareness that a run never finished.
3. **No overlap control.** If a job takes 8 minutes on a 5-minute
   interval, two instances run simultaneously.
4. **No backoff on failure.** A broken job fires every cycle, burning
   tokens and producing the same error repeatedly.
5. **No inter-agent messaging.** Isolated sessions cannot coordinate
   except through the user's chat.
6. **Flat file storage.** JSON file. No transactions, no queryability,
   no crash safety beyond filesystem semantics.

## Proposed solution

A standalone scheduler that replaces both built-in cron and heartbeat.
Runs as a separate service alongside the gateway, dispatches via the
existing chat completions API. No gateway code changes.

### Architecture

```
Scheduler (10s tick loop)
  1. Gateway health check
  2. Find due jobs (SQLite: next_run_at <= now, enabled=1)
  3. Dispatch:
     - main session → system event injection
     - isolated    → POST /v1/chat/completions
  4. Implicit heartbeat (session activity monitoring)
  5. Inter-agent message delivery
  6. Prune old runs and expired messages
```

All state in a single SQLite database. Dispatcher is a Node.js process
managed by launchd (macOS) or systemd (Linux). Jobs are cron-scheduled
or chain-triggered.

### What it does

**Run history.** Every execution tracked: status (`ok`, `error`,
`timeout`, `skipped`, `cancelled`), duration, agent response summary,
error detail. Queryable via CLI or SQL.

**Implicit heartbeat.** Monitors whether an agent's session is still
active via `sessions_list` instead of using a flat timeout. If session
activity stops for 90 seconds (configurable), the run is marked stale.
A crashed 20-second job is detected in ~90s, not 5 minutes. A
legitimate 4-minute research task that's actively running tools is not
killed at the 5-minute mark.

**Overlap control.** Per-job `overlap_policy`: `skip` (default — if a
previous run is still active, skip and log), `allow`, or `queue`.

**Exponential backoff.** Consecutive failures delay the next run:
1 error → 30s, 2 → 1min, 3 → 5min, 4 → 15min, 5+ → 60min. Resets
on success.

**Job chains.** Parent/child relationships. A child job triggers on
the parent's completion (`trigger_on`: `success`, `failure`, or
`complete`). Depth limits prevent infinite recursion. Chain cancellation
propagates — killing a parent kills its children.

**Retry.** Per-job `max_retries` and `retry_delay_s`. Failed runs
retry up to N times before marking the job as failed.

**Inter-agent messaging.** SQLite-backed message queue with priority,
threading (`reply_to`), read receipts, TTL, and delivery tracking.
Messages are delivered inline with job prompts.

**One-shot jobs.** `delete_after_run` flag for fire-once scheduling.

### Database schema

Four tables, schema v4:

| Table      | Purpose                                                        |
| ---------- | -------------------------------------------------------------- |
| `jobs`     | Schedule, payload, delivery config, overlap, backoff, chains   |
| `runs`     | Execution history: status, duration, heartbeat, retry tracking |
| `messages` | Inter-agent queue: priority, threading, read receipts, TTL     |
| `agents`   | Registry: status, last seen, capabilities                      |

Jobs table includes: cron schedule with timezone, session target
(main/isolated), model override, thinking mode, timeout, delivery
channel, chain config (parent_id, trigger_on, trigger_delay_s),
retry config, and denormalized scheduling state.

Runs table tracks implicit heartbeat via `last_heartbeat` timestamp,
chain provenance via `triggered_by_run`, and retry lineage via
`retry_of` and `retry_count`.

### Dispatch via chat completions

Uses the `/v1/chat/completions` endpoint already present in the
gateway (needs `chatCompletions.enabled: true` in config). Session
isolation via unique keys (`scheduler:<job_id>:<run_id>`). The
gateway's model routing, tool execution, and channel delivery all
work without modification.

Main session jobs use `openclaw system event` CLI to inject into the
active session.

### CLI

```bash
node cli.js status              # overview: jobs, running, stale, agents
node cli.js jobs list            # all jobs with next run time
node cli.js jobs create '{...}'  # create a job
node cli.js runs list <job-id>   # run history
node cli.js runs running         # currently executing
node cli.js runs stale           # stuck runs
node cli.js msg inbox <agent>    # unread messages
node cli.js msg send <from> <to> <body>
```

### File layout

```
~/.openclaw/scheduler/
├── dispatcher.js      # main process: tick loop, dispatch, health checks
├── db.js              # SQLite connection (WAL mode, foreign keys)
├── schema.sql         # table definitions (v4)
├── jobs.js            # job CRUD, scheduling, due detection
├── runs.js            # run lifecycle, stale/timeout, heartbeat
├── messages.js        # inter-agent message queue
├── agents.js          # agent registry
├── gateway.js         # gateway health + dispatch helpers
├── cli.js             # CLI interface
├── test.js            # unit tests
├── test-dispatcher.js # integration tests
├── migrate-v3.js      # v2→v3 migration (chains)
├── migrate-v4.js      # v3→v4 migration (retry)
└── scheduler.db       # SQLite database
```

## What this replaces

| Feature           | Before (built-in)       | After (standalone)                          |
| ----------------- | ----------------------- | ------------------------------------------- |
| Job storage       | `jobs.json` (flat file) | SQLite (ACID, queryable)                    |
| Run history       | None                    | Full history with status, duration, summary |
| Stale detection   | None                    | Implicit heartbeat (90s, configurable)      |
| Overlap control   | None                    | skip / allow / queue per job                |
| Failure recovery  | None                    | Exponential backoff + configurable retry    |
| Job chains        | None                    | Parent/child with depth limits              |
| Inter-agent comms | None                    | Priority message queue with threading       |
| Heartbeat         | Fixed-interval turn     | Replaced by job-driven scheduling           |

## Integration requirements

One config change:

```json
{
  "gateway": {
    "http": {
      "endpoints": {
        "chatCompletions": { "enabled": true }
      }
    }
  }
}
```

Everything else uses existing public APIs. No monkey-patching, no
gateway forks, no internal API dependencies.

## Production status

Working implementation deployed and running. 91 unit tests (v4).
Stable with zero missed fires and zero undetected stale runs.
Survived gateway restarts, scheduler restarts, and network blips
without data loss.

## Paths forward

Two options, not mutually exclusive:

1. **Docs/reference.** Publish as reference architecture for anyone
   who needs scheduling beyond flat-file cron. The pattern
   (SQLite + chat completions API + implicit heartbeat) is reusable
   and requires no gateway changes.

2. **Native integration.** Port the core concepts into built-in cron:
   run history, implicit heartbeat, overlap policies, exponential
   backoff. The inter-agent messaging could remain external or become
   a first-class primitive.

The key insight either way: infer agent liveness from session activity,
not wall-clock timeout. Eliminates false-positive kills on long tasks
and delayed detection of actual crashes.
