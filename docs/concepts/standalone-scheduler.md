---
summary: "Proposal: standalone task scheduler with implicit heartbeat and inter-agent messaging"
title: "Standalone Task Scheduler (RFC)"
---

# Standalone Task Scheduler

**Status:** Production (deployed, stable)
**Author:** @amittell
**Area:** Scheduling, heartbeat, inter-agent messaging, workflow orchestration

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
existing chat completions API. No gateway code changes required.

### Architecture

```
Scheduler (10s tick loop)
  1. Gateway health check
  2. Find due jobs (SQLite: next_run_at <= now, enabled=1)
  3. Resource pool concurrency check
  4. Dispatch:
     - main session → system event injection
     - isolated    → POST /v1/chat/completions
  5. Implicit heartbeat (session activity monitoring)
  6. Deliver pending inter-agent messages
  7. Process spawn messages (dynamic child job creation)
  8. Evaluate trigger conditions and fire child chains
  9. MinIO backup (5-min snapshots, hourly rollups)
  10. Prune old runs, expired messages, orphaned jobs
  11. WAL checkpoint (hourly + on shutdown)
```

All state in a single SQLite database (WAL mode, foreign keys
enforced). Dispatcher is a Node.js process managed by launchd (macOS)
or systemd (Linux). Jobs are cron-scheduled, chain-triggered, or
event-triggered.

### Core features

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
previous run is still active, skip and log), `allow` (dispatch
concurrently), or `queue` (buffer dispatches, drain on completion).
Queued dispatches are tracked via `queued_count` and consumed
one-per-tick after the current run finishes.

**Exponential backoff.** Consecutive failures delay the next run:
1 error → 30s, 2 → 1min, 3 → 5min, 4 → 15min, 5+ → 60min. Resets
on success.

**One-shot jobs.** `delete_after_run` flag for fire-once scheduling.
Cleaned up automatically after execution.

### Workflow chaining

Parent/child job relationships for multi-step workflows.

- **Trigger types:** `trigger_on` can be `success`, `failure`, or
  `complete` (fires on either outcome).
- **Trigger delay:** Optional `trigger_delay_s` to stagger child
  execution.
- **Output-based conditions:** `trigger_condition` evaluates the
  parent run's output before firing children. Supports
  `contains:<substring>` and `regex:<pattern>` matchers. A child
  with `trigger_condition: "contains:ALERT"` only fires when the
  parent's output includes "ALERT".
- **Depth limits:** `MAX_CHAIN_DEPTH = 10` prevents infinite
  recursion.
- **Cycle detection:** `detectCycle()` validates parent chains on
  job creation and update.
- **Cascade cancellation:** Cancelling a parent propagates to all
  children recursively.
- **Orphan cleanup:** Children whose parents are deleted are pruned
  automatically.

### Retry logic

Per-job configurable retry with automatic scheduling.

- `max_retries` per job (0 = no retry, default).
- Exponential retry delay: 30s × 2^(attempt-1).
- Retry lineage tracked via `retry_of` and `retry_count` on runs.
- Child chains only fire after retries are exhausted (failures don't
  cascade prematurely).
- Consecutive error counter resets after a successful retry.

### Resource pools

Concurrency control across different jobs that share a resource.

- Jobs can declare a `resource_pool` name (e.g., `"gpu"`, `"api"`).
- Before dispatch, the scheduler checks if any job in the same pool
  has a running run (`hasRunningRunForPool`).
- If the pool is busy, the job is skipped (same as overlap skip) and
  rescheduled for the next tick.
- Prevents unrelated jobs from competing for shared resources (GPU
  slots, rate-limited APIs, etc.).

### Cross-session visibility

Jobs can be configured with `payload_scope: "global"` to enable
cross-session sub-agent observation.

- Default scope (`own`) limits visibility to sub-agents spawned by
  the current scheduler session.
- Global scope injects a system note instructing the agent to use
  `sessions_list` (no filter) instead of `subagents list`, enabling
  observation of sub-agents spawned from the main Telegram session
  or any other requester session.
- Useful for monitoring/ops jobs that need to audit all running
  sub-agents across the system.

### Run-now (immediate execution)

Any existing job can be triggered for immediate execution via
`runJobNow(id)`, which sets `next_run_at` to 1 second in the past.
The job fires on the next tick. After execution, normal cron
scheduling resumes — the job's schedule is not modified.

Available via CLI: `node cli.js jobs run <id>`.

### Delivery aliases

Named targets for job output delivery, stored in the
`delivery_aliases` table.

```sql
-- Example built-in aliases
INSERT INTO delivery_aliases (alias, channel, target, description) VALUES
  ('degeneracy', 'telegram', '-5240776892', 'AI assisted degeneracy group'),
  ('alex',       'telegram', '484946046',   'Alex DM');
```

Jobs reference aliases in `delivery_to` (e.g., `@degeneracy`). The
dispatcher resolves them before delivery, decoupling job config from
channel routing. Aliases are managed via CLI:

```bash
node cli.js alias list
node cli.js alias add <name> <channel> <target> [description]
node cli.js alias remove <name>
```

### Dynamic job spawning

Running jobs can create child jobs at runtime via spawn messages.
A job writes a message with `kind: "spawn"` to the message queue
containing a JSON spec. The dispatcher's spawn handler picks it up,
creates the child job, and fires it immediately.

This enables agents to dynamically schedule follow-up work without
CLI access — useful for research pipelines, monitoring escalation,
and adaptive workflows.

### Inter-agent messaging

SQLite-backed message queue for agent coordination.

- **Priority levels:** 0 (normal), 1 (high), 2 (urgent).
- **Threading:** `reply_to` for conversation chains.
- **Message kinds:** `text`, `task`, `result`, `status`, `system`,
  `spawn`.
- **Read receipts:** `delivered_at` and `read_at` tracking.
- **TTL:** Optional `expires_at` with automatic expiration.
- **Inline delivery:** Pending messages are injected into job prompts
  via `buildJobPrompt`, giving agents awareness of inter-agent
  communication.

### Backup and durability

**MinIO snapshots.** Every 5 minutes, the scheduler copies the SQLite
database to MinIO object storage (`kebablebot-backups/scheduler/`).

- **Snapshots:** `snapshots/YYYY-MM-DD/HH-MM.db` — 5-minute
  granularity, 24-hour retention (288 files max).
- **Rollups:** `rollups/YYYY-MM-DD/HH.db` — hourly tagged snapshots,
  7-day retention (168 files max).
- **Restore:** `node backup.js restore` pulls the latest snapshot
  from MinIO.
- **Status:** `node backup.js status` shows latest snapshot, count,
  and total size.

**WAL checkpointing.** SQLite WAL is checkpointed hourly during the
prune cycle and on shutdown (SIGINT/SIGTERM). This ensures the main
database file stays current, reducing data loss window on crash or
SIGKILL.

### Database schema

Five tables, schema v2 (logical v4 — features added via column
extensions):

| Table              | Purpose                                                        |
| ------------------ | -------------------------------------------------------------- |
| `jobs`             | Schedule, payload, delivery, overlap, backoff, chains, retry, resource pools |
| `runs`             | Execution history: status, duration, heartbeat, retry lineage  |
| `messages`         | Inter-agent queue: priority, threading, read receipts, TTL     |
| `agents`           | Registry: status, last seen, capabilities                      |
| `delivery_aliases` | Named delivery targets: alias → channel + target              |
| `schema_migrations`| Migration version tracking                                    |

**Jobs table** includes: cron schedule with timezone, session target
(main/isolated), agent ID, model override, thinking mode, timeout,
delivery channel + alias support, chain config (parent_id, trigger_on,
trigger_delay_s, trigger_condition), retry config (max_retries),
overlap policy + queue count, payload scope (own/global), resource
pool, and denormalized scheduling state (next_run_at, last_run_at,
last_status, consecutive_errors).

**Runs table** tracks implicit heartbeat via `last_heartbeat`
timestamp, chain provenance via `triggered_by_run`, and retry lineage
via `retry_of` and `retry_count`.

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
# Status
node cli.js status                       # overview: jobs, running, stale, agents

# Jobs
node cli.js jobs list                    # all jobs with next run time
node cli.js jobs tree                    # parent/child tree view
node cli.js jobs get <id>                # job details
node cli.js jobs add '<json>'            # create a job
node cli.js jobs update <id> '<json>'    # update job fields
node cli.js jobs enable <id>             # enable a job
node cli.js jobs disable <id>            # disable a job
node cli.js jobs delete <id>             # delete a job
node cli.js jobs cancel <id>             # cancel job + cascade to children
node cli.js jobs run <id>                # trigger immediate run

# Runs
node cli.js runs list <job-id> [limit]   # run history
node cli.js runs running                 # currently executing
node cli.js runs stale [threshold-s]     # stuck runs

# Messages
node cli.js msg send <from> <to> <body>  # send inter-agent message
node cli.js msg inbox <agent> [limit]    # unread messages
node cli.js msg outbox <agent> [limit]   # sent messages
node cli.js msg thread <message-id>      # conversation thread
node cli.js msg read <message-id>        # mark read
node cli.js msg readall <agent>          # mark all read
node cli.js msg unread <agent>           # unread count

# Agents
node cli.js agents list                  # list registered agents
node cli.js agents get <id>              # agent details
node cli.js agents register <id> [name]  # register/update agent

# Aliases
node cli.js alias list                   # list delivery aliases
node cli.js alias add <n> <ch> <tgt>     # add alias
node cli.js alias remove <name>          # remove alias

# Backup
node backup.js snapshot                  # ship current DB to MinIO
node backup.js rollup                    # hourly rollup + prune old snapshots
node backup.js restore                   # restore from latest MinIO snapshot
node backup.js status                    # show backup stats
```

### File layout

```
~/.openclaw/scheduler/
├── dispatcher.js       # main process: tick loop, dispatch, health checks
├── db.js               # SQLite connection (WAL mode, foreign keys, checkpoint)
├── schema.sql          # table definitions (jobs, runs, messages, agents, aliases)
├── jobs.js             # job CRUD, scheduling, chains, retry, resource pools
├── runs.js             # run lifecycle, stale/timeout, heartbeat
├── messages.js         # inter-agent message queue
├── agents.js           # agent registry
├── gateway.js          # gateway health + chat completions + delivery aliases
├── backup.js           # MinIO snapshot/rollup/restore/status/prune
├── cli.js              # CLI interface (all management commands)
├── test.js             # 220 assertions (schema, cron, jobs, runs, messages,
│                       #   agents, chaining, retry, cancellation, resource pools,
│                       #   trigger conditions, delivery aliases, run-now, queue)
├── migrate.js          # schema migrations
├── migrate-v3.js       # v2→v3 migration (chains)
├── migrate-v3b.js      # v3→v3b migration (retry)
├── .backup-staging/    # temp dir for MinIO upload staging
├── secrets/            # git-crypt encrypted credentials
└── scheduler.db        # SQLite database (WAL mode)
```

## What this replaces

| Feature              | Before (built-in)       | After (standalone)                             |
| -------------------- | ----------------------- | ---------------------------------------------- |
| Job storage          | `jobs.json` (flat file) | SQLite (ACID, queryable, WAL mode)             |
| Run history          | None                    | Full history with status, duration, summary    |
| Stale detection      | None                    | Implicit heartbeat (90s, configurable)         |
| Overlap control      | None                    | skip / allow / queue per job                   |
| Failure recovery     | None                    | Exponential backoff + configurable retry       |
| Job chains           | None                    | Parent/child with depth limits + conditions    |
| Output-based triggers| None                    | contains/regex matchers on parent output       |
| Resource pools       | None                    | Cross-job concurrency control                  |
| Inter-agent comms    | None                    | Priority message queue with threading          |
| Delivery aliases     | None                    | Named targets decoupled from job config        |
| Cross-session scope  | None                    | Global sub-agent visibility for ops jobs       |
| Immediate execution  | None                    | Run-now without changing cron schedule          |
| Dynamic spawning     | None                    | Agents create child jobs at runtime             |
| Backup               | None                    | 5-min MinIO snapshots, 7-day hourly rollups    |
| WAL safety           | None                    | Hourly checkpoint + shutdown checkpoint         |
| Heartbeat            | Fixed-interval turn     | Replaced by job-driven scheduling              |

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

Working implementation deployed on two hosts (mac-mini + rh-bot.lan)
and running in production. **220 assertions** covering schema, cron
scheduling, job CRUD, run lifecycle, messages, agents, workflow
chaining, retry logic, cascade cancellation, resource pools, trigger
conditions, delivery aliases, run-now, and queue overlap.

Stable with zero missed fires and zero undetected stale runs. Survived
gateway restarts, scheduler restarts, and network blips without data
loss. MinIO backups provide 24 hours of 5-minute-granularity snapshots
and 7 days of hourly rollups.

**LaunchAgent:** `ai.openclaw.scheduler`
**Logs:** `/tmp/openclaw-scheduler.log`
**Repository:** [amittell/openclaw-scheduler](https://github.com/amittell/openclaw-scheduler) (private)

## Paths forward

Two options, not mutually exclusive:

1. **Docs/reference.** Publish as reference architecture for anyone
   who needs scheduling beyond flat-file cron. The pattern
   (SQLite + chat completions API + implicit heartbeat) is reusable
   and requires no gateway changes.

2. **Native integration.** Port the core concepts into built-in cron:
   run history, implicit heartbeat, overlap policies, exponential
   backoff, resource pools, workflow chaining. The inter-agent
   messaging could remain external or become a first-class primitive.

The key insight either way: infer agent liveness from session activity,
not wall-clock timeout. Eliminates false-positive kills on long tasks
and delayed detection of actual crashes.
