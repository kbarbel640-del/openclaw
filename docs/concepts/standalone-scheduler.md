---
summary: "Proposal: standalone task scheduler with implicit heartbeat and inter-agent messaging"
read_when:
  - Scheduling beyond flat-file cron
  - Job lifecycle, run history, or failure recovery
  - Inter-agent messaging or workflow orchestration
title: "Standalone Task Scheduler (RFC)"
---

# Standalone Task Scheduler

**Status:** Production (working implementation deployed)
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
Scheduler (configurable tick loop, default 10s)
  1. Gateway health check
  2. Find due jobs (SQLite: next_run_at <= now, enabled=1)
  3. Resource pool concurrency check
  4. Check approval gates (timeout + auto-resolve)
  5. Dispatch:
     - main session → system event injection
     - isolated    → POST /v1/chat/completions
  6. Implicit heartbeat (session activity monitoring)
  7. Deliver pending inter-agent messages (typed priority ordering)
  8. Process spawn messages (dynamic child job creation)
  9. Evaluate trigger conditions and fire child chains
  10. Build and record context summaries for each run
  11. Object storage backup (optional, configurable)
  12. Prune old runs, expired messages, orphaned jobs, resolved approvals
  13. WAL checkpoint (hourly + on shutdown)
```

All state in a single SQLite database (WAL mode, foreign keys
enforced). Dispatcher is a Node.js process managed by launchd (macOS)
or systemd (Linux). Jobs are cron-scheduled, chain-triggered, or
event-triggered.

### Core features

**Run history.** Every execution tracked: status (`ok`, `error`,
`timeout`, `skipped`, `cancelled`, `awaiting_approval`), duration,
agent response summary, error detail, context summary. Queryable via
CLI or SQL.

**Implicit heartbeat.** Monitors whether an agent's session is still
active via `sessions_list` instead of using a flat timeout. If session
activity stops for a configurable threshold (default 90 seconds), the
run is marked stale. A crashed 20-second job is detected in ~90s, not
5 minutes. A legitimate 4-minute research task that's actively running
tools is not killed at the 5-minute mark.

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

### Delivery semantics contract

Jobs declare an explicit `delivery_guarantee` per job:

- **`at-most-once`** (default): Current behavior. On crash, orphaned
  runs are marked `crashed` and rescheduled. No replay. The job may
  miss a run but will never double-fire.
- **`at-least-once`**: On crash recovery (dispatcher restart),
  orphaned runs are replayed automatically. The job may fire twice
  but will never silently miss a run.

Operators choose the contract that matches their job's semantics.
Idempotent jobs (monitoring, audits) benefit from `at-least-once`.
Side-effecting jobs (notifications, deployments) should use the
default `at-most-once`.

Set via job configuration:

```json
{
  "name": "nightly-audit",
  "delivery_guarantee": "at-least-once",
  "schedule": "0 2 * * *"
}
```

### Flush-before-compaction hook

Jobs with `job_class: "pre_compaction_flush"` receive a structured
prompt before context compaction, forcing agents to write down
decisions, constraints, task owners, and open questions.

The injected system prompt:

```
[SYSTEM: Pre-compaction flush required]
Write a structured summary of: active decisions, constraints,
task owners, open questions. Format as labeled sections.
If nothing needs flushing, respond with exactly: NO_FLUSH
[END SYSTEM]
```

If the agent responds with exactly `NO_FLUSH`, delivery is skipped
and the run is logged as "nothing to flush." This prevents the
"agent forgot after compaction" class of bugs — critical context is
captured in structured form before the context window is compressed.

### Context summary and memory observability

Every run records a `context_summary` (JSON) capturing the full
context that was available to the job at execution time:

```json
{
  "messages_injected": 3,
  "scope": "own",
  "aliases_resolved": ["@ops-channel"],
  "job_class": "standard",
  "delivery_guarantee": "at-most-once",
  "context_retrieval": "hybrid",
  "retrieval_results": 5
}
```

Queryable via CLI (`runs list`, `runs get`). Operators can audit
exactly what each job saw when it ran — which messages were injected,
what scope was active, which aliases resolved, and how many retrieval
results were included. Eliminates "what did the agent see?" debugging.

### Typed message contract

The inter-agent message system supports structured message types
beyond plain text. Each typed message carries an `owner` field
identifying the originator:

| Kind         | Priority | Description                       |
| ------------ | -------- | --------------------------------- |
| `constraint` | 1 (high) | Rules that must not be violated   |
| `decision`   | 2        | Resolved choices with rationale   |
| `fact`       | 3        | Verified information              |
| `task`       | 4        | Work assignments                  |
| `preference` | 5        | Soft preferences (not hard rules) |
| `text`       | 6 (low)  | Unstructured plain text           |
| `result`     | 6        | Task completion results           |
| `status`     | 6        | Status updates                    |
| `system`     | 6        | System-generated messages         |
| `spawn`      | 6        | Dynamic job spawn requests        |

Retrieval prioritizes constraints over decisions over facts in prompt
injection. When messages are injected into a job prompt, typed
messages are displayed with their kind and owner:

```
[constraint] (owner: ops-agent) Never deploy during business hours
[decision] (owner: lead-agent) Use blue-green deployment strategy
```

Structured knowledge beats noise — agents see the most important
context first.

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
- **Depth limits:** Configurable `MAX_CHAIN_DEPTH` (default 10)
  prevents infinite recursion.
- **Cycle detection:** Validates parent chains on job creation and
  update.
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
  has a running run.
- If the pool is busy, the job is skipped and rescheduled for the
  next tick.
- Prevents unrelated jobs from competing for shared resources (GPU
  slots, rate-limited APIs, etc.).

### Cross-session visibility

Jobs can be configured with `payload_scope: "global"` to enable
cross-session sub-agent observation.

- Default scope (`own`) limits visibility to sub-agents spawned by
  the current scheduler session.
- Global scope injects a system note instructing the agent to use
  `sessions_list` (no filter) instead of `subagents list`, enabling
  observation of sub-agents spawned from any requester session.
- Useful for monitoring/ops jobs that need to audit all running
  sub-agents across the system.

### Run-now (immediate execution)

Any existing job can be triggered for immediate execution, which sets
`next_run_at` to 1 second in the past. The job fires on the next
tick. After execution, normal cron scheduling resumes — the job's
schedule is not modified.

Available via CLI: `node cli.js jobs run <id>`.

### Delivery aliases

Named targets for job output delivery, stored in the
`delivery_aliases` table. Jobs reference aliases in `delivery_to`
(e.g., `@ops-channel`). The dispatcher resolves them before delivery,
decoupling job config from channel routing.

```sql
-- Operators define their own aliases
INSERT INTO delivery_aliases (alias, channel, target, description) VALUES
  ('ops-channel', 'telegram', '<chat-id>', 'Ops notification channel'),
  ('admin',       'telegram', '<user-id>', 'Admin DM');
```

Aliases are managed via CLI:

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

### HITL approval gates

Jobs with `approval_required: true` pause after chain trigger and
wait for operator approval before executing. This adds a
human-in-the-loop checkpoint for sensitive or high-impact workflows.

**Flow:**

1. A chain-triggered job with `approval_required` fires.
2. The dispatcher creates a run with status `awaiting_approval` and
   an approval record in the `approvals` table.
3. A notification is sent: "Job 'deploy-prod' requires approval."
4. The job waits for operator action via CLI.
5. On approval, the run proceeds to dispatch. On rejection, the run
   is marked `cancelled`.

**Configuration fields:**

- `approval_required` (boolean): Enable the gate. Default `false`.
- `approval_timeout_s` (integer): Seconds before auto-resolve.
  Default `3600` (1 hour).
- `approval_auto` (`"approve"` or `"reject"`): Policy applied when
  the timeout expires. Default `"reject"`.

**Example:**

```json
{
  "name": "deploy-prod",
  "parent_id": "build-job-id",
  "trigger_on": "success",
  "approval_required": true,
  "approval_timeout_s": 1800,
  "approval_auto": "reject"
}
```

The `approvals` table tracks the full lifecycle: `pending`,
`approved`, `rejected`, `timed_out`. Each record includes
`resolved_by` (operator, timeout, or API) and optional notes.

### Run replay on startup

On dispatcher boot, orphaned runs (status still `running` from a
previous crash) are handled according to each job's delivery
guarantee:

- **`at-least-once` jobs:** The orphaned run is marked `crashed` and
  a new run is created with `replay_of` set to the original run ID.
  The replayed run is queued for immediate dispatch.
- **`at-most-once` jobs:** The orphaned run is marked `crashed` and
  the job's schedule is advanced to the next cron interval. No
  replay occurs.

This closes the crash-recovery gap. Before this feature, a scheduler
crash during job execution meant the run was silently lost. Now,
operators get explicit crash status on all orphaned runs and
automatic recovery for jobs that opt into `at-least-once` delivery.

All replay actions are logged at startup for operator visibility.

### Hybrid retrieval for job context

Jobs can opt into receiving prior run summaries as additional context
in their prompt. This gives agents continuity across runs without
requiring external memory systems.

**Retrieval modes:**

- **`none`** (default): No prior context injected.
- **`recent`**: The last N run summaries (by time) are injected.
  Simple and predictable.
- **`hybrid`**: Summaries are ranked by relevance using TF-IDF
  scoring combined with substring matching. The top N results are
  injected. Better for jobs where recent runs may not be the most
  relevant.

**Configuration:**

- `context_retrieval`: `"none"`, `"recent"`, or `"hybrid"`.
- `context_retrieval_limit`: Maximum summaries to inject (default 5).

**Example:**

```json
{
  "name": "weekly-report",
  "context_retrieval": "hybrid",
  "context_retrieval_limit": 10
}
```

Injected context appears in the prompt as:

```
--- Prior Run Context ---
[2025-01-15 02:00] Summary of previous execution...
[2025-01-08 02:00] Summary of earlier execution...
```

### Inter-agent messaging

SQLite-backed message queue for agent coordination.

- **Priority levels:** 0 (normal), 1 (high), 2 (urgent).
- **Threading:** `reply_to` for conversation chains.
- **Message kinds:** `text`, `task`, `result`, `status`, `system`,
  `spawn`, `decision`, `constraint`, `fact`, `preference`.
- **Typed priority:** Messages are sorted by kind priority
  (constraints first) when injected into job prompts.
- **Owner tracking:** Typed messages carry an `owner` field
  identifying the originator.
- **Read receipts:** `delivered_at` and `read_at` tracking.
- **TTL:** Optional `expires_at` with automatic expiration.
- **Inline delivery:** Pending messages are injected into job prompts,
  giving agents awareness of inter-agent communication.

### Object storage backup (optional)

The scheduler can optionally ship SQLite snapshots to S3-compatible
object storage (MinIO, AWS S3, etc.) on a configurable interval.

- **Disabled by default.** Set `SCHEDULER_BACKUP_ENABLED=true` to
  enable.
- **Configurable target.** Set `SCHEDULER_BACKUP_BUCKET` and
  `SCHEDULER_BACKUP_PREFIX` for the storage path.
- **Snapshots:** Copies of the database at configurable intervals
  (default 5 minutes). Retention configurable (default 24 hours).
- **Rollups:** Tagged hourly snapshots with longer retention
  (default 7 days).
- **Restore:** `node backup.js restore` pulls the latest snapshot.
- **Status:** `node backup.js status` shows latest snapshot, count,
  and total size.
- Uses the `mc` CLI (MinIO Client) for S3-compatible uploads. Any
  S3-compatible backend works — configure via the `mc` alias.

### WAL checkpointing

SQLite WAL is checkpointed hourly during the prune cycle and on
shutdown (SIGINT/SIGTERM). This ensures the main database file stays
current, reducing data loss window on crash or SIGKILL.

### Database schema

Seven tables:

| Table               | Purpose                                                                  |
| ------------------- | ------------------------------------------------------------------------ |
| `jobs`              | Schedule, payload, delivery, overlap, backoff, chains, retry, job class, |
|                     | delivery guarantee, approval config, context retrieval settings          |
| `runs`              | Execution history: status, duration, heartbeat, retry lineage, context   |
|                     | summary (JSON), replay tracking                                          |
| `messages`          | Inter-agent queue: priority, threading, read receipts, TTL, typed kinds  |
|                     | (decision, constraint, fact, preference) with owner field                |
| `agents`            | Registry: status, last seen, capabilities                                |
| `delivery_aliases`  | Named delivery targets: alias to channel + target                        |
| `approvals`         | HITL approval lifecycle: pending, approved, rejected, timed out          |
| `schema_migrations` | Migration version tracking                                               |

**Jobs table** includes: cron schedule with timezone, session target
(main/isolated), agent ID, model override, thinking mode, timeout,
delivery channel + alias support, chain config (`parent_id`,
`trigger_on`, `trigger_delay_s`, `trigger_condition`), retry config
(`max_retries`), overlap policy + queue count, payload scope
(own/global), resource pool, delivery guarantee
(`at-most-once`/`at-least-once`), job class
(`standard`/`pre_compaction_flush`), approval gate config
(`approval_required`, `approval_timeout_s`, `approval_auto`),
context retrieval config (`context_retrieval`,
`context_retrieval_limit`), and denormalized scheduling state
(`next_run_at`, `last_run_at`, `last_status`, `consecutive_errors`).

**Runs table** tracks implicit heartbeat via `last_heartbeat`
timestamp, chain provenance via `triggered_by_run`, retry lineage
via `retry_of` and `retry_count`, context summary via
`context_summary` (JSON), and crash replay tracking via `replay_of`.

**Messages table** supports typed message kinds (`decision`,
`constraint`, `fact`, `preference`) alongside the original kinds.
Each typed message carries an `owner` field. Retrieval sorts by
kind priority (constraints first).

**Approvals table** tracks the HITL approval lifecycle for gated
jobs: `job_id`, `run_id`, `status` (pending/approved/rejected/
timed_out), `requested_at`, `resolved_at`, `resolved_by`
(operator/timeout/API), and optional `notes`.

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
node cli.js jobs approve <id>            # approve a pending approval gate
node cli.js jobs reject <id> [reason]    # reject a pending approval gate

# Runs
node cli.js runs list <job-id> [limit]   # run history (includes context summary)
node cli.js runs running                 # currently executing
node cli.js runs stale [threshold-s]     # stuck runs

# Approvals
node cli.js approvals list               # all approval records
node cli.js approvals pending            # pending approvals only

# Messages
node cli.js msg send <from> <to> <body>  # send inter-agent message
node cli.js msg inbox <agent> [limit]    # unread messages (typed priority order)
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

# Backup (when enabled)
node backup.js snapshot                  # ship current DB to object storage
node backup.js rollup                    # hourly rollup + prune old snapshots
node backup.js restore                   # restore from latest snapshot
node backup.js status                    # show backup stats
```

## Configuration

All settings are configurable via environment variables. Sensible
defaults are provided for every option.

### Environment variables

| Variable                        | Default                  | Description                                     |
| ------------------------------- | ------------------------ | ----------------------------------------------- |
| `OPENCLAW_GATEWAY_URL`          | `http://127.0.0.1:18789` | Gateway URL for health checks and dispatch      |
| `OPENCLAW_GATEWAY_TOKEN`        | _(none)_                 | Bearer token for gateway auth (optional)        |
| `SCHEDULER_TICK_MS`             | `10000`                  | Main loop tick interval (ms)                    |
| `SCHEDULER_STALE_THRESHOLD_S`   | `90`                     | Seconds without heartbeat before marking stale  |
| `SCHEDULER_HEARTBEAT_CHECK_MS`  | `30000`                  | Interval between heartbeat checks (ms)          |
| `SCHEDULER_MESSAGE_DELIVERY_MS` | `15000`                  | Interval between message delivery cycles (ms)   |
| `SCHEDULER_PRUNE_MS`            | `3600000`                | Interval between prune cycles (ms, default 1hr) |
| `SCHEDULER_DEBUG`               | _(unset)_                | Set to any value to enable debug logging        |
| `SCHEDULER_BACKUP_ENABLED`      | `false`                  | Enable object storage backups                   |
| `SCHEDULER_BACKUP_MS`           | `300000`                 | Backup interval (ms, default 5min)              |
| `SCHEDULER_BACKUP_BUCKET`       | _(none)_                 | S3/MinIO bucket name for backups                |
| `SCHEDULER_BACKUP_PREFIX`       | `scheduler`              | Key prefix within the bucket                    |
| `SCHEDULER_BACKUP_MC_ALIAS`     | _(none)_                 | `mc` alias for S3-compatible storage            |
| `SCHEDULER_BACKUP_RETENTION_H`  | `24`                     | Snapshot retention in hours                     |
| `SCHEDULER_BACKUP_ROLLUP_DAYS`  | `7`                      | Rollup retention in days                        |

### Per-job configuration fields

In addition to the environment variables above, each job supports
the following configuration fields set via `jobs add` or
`jobs update`:

- `delivery_guarantee`: `"at-most-once"` (default) or
  `"at-least-once"`. Controls crash recovery behavior.
- `job_class`: `"standard"` (default) or
  `"pre_compaction_flush"`. Enables the flush-before-compaction
  hook.
- `approval_required`: `true` or `false` (default). Enables HITL
  approval gates for chain-triggered jobs.
- `approval_timeout_s`: Seconds before auto-resolve (default 3600).
- `approval_auto`: `"approve"` or `"reject"` (default). Policy
  applied on timeout.
- `context_retrieval`: `"none"` (default), `"recent"`, or
  `"hybrid"`. Controls prior run context injection.
- `context_retrieval_limit`: Maximum summaries to inject
  (default 5).

### Gateway requirement

One gateway config change is needed:

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

## What this replaces

| Feature             | Before (built-in)       | After (standalone)                              |
| ------------------- | ----------------------- | ----------------------------------------------- |
| Job storage         | `jobs.json` (flat file) | SQLite (ACID, queryable, WAL mode)              |
| Run history         | None                    | Full history with status, duration, summary     |
| Stale detection     | None                    | Implicit heartbeat (configurable threshold)     |
| Overlap control     | None                    | skip / allow / queue per job                    |
| Failure recovery    | None                    | Exponential backoff + configurable retry        |
| Job chains          | None                    | Parent/child with depth limits + conditions     |
| Output triggers     | None                    | contains/regex matchers on parent output        |
| Resource pools      | None                    | Cross-job concurrency control                   |
| Inter-agent comms   | None                    | Priority message queue with threading           |
| Delivery aliases    | None                    | Named targets decoupled from job config         |
| Cross-session scope | None                    | Global sub-agent visibility for ops jobs        |
| Immediate execution | None                    | Run-now without changing cron schedule          |
| Dynamic spawning    | None                    | Agents create child jobs at runtime             |
| Backup              | None                    | Optional S3-compatible object storage backups   |
| WAL safety          | None                    | Hourly checkpoint + shutdown checkpoint         |
| Heartbeat           | Fixed-interval turn     | Replaced by job-driven scheduling               |
| Delivery contract   | None                    | Explicit at-most-once / at-least-once per job   |
| Crash recovery      | None                    | Automatic replay for at-least-once jobs         |
| Approval gates      | None                    | HITL approval with timeout + auto-resolve       |
| Compaction safety   | None                    | Pre-compaction flush hook                       |
| Context audit       | None                    | JSON context summary per run                    |
| Typed knowledge     | None                    | Structured message types with priority ordering |

## Installation

### Prerequisites

- Node.js 20+ (uses native `fetch`, ESM)
- `better-sqlite3` and `croner` (installed via `npm install`)
- OpenClaw gateway with `chatCompletions` enabled
- Optional: `mc` CLI for S3-compatible backups

### Setup

```bash
# Clone / place the scheduler
mkdir -p ~/.openclaw/scheduler
cd ~/.openclaw/scheduler

# Install dependencies
npm install

# Initialize the database (happens automatically on first run)
# migrate-v5.js runs automatically on startup to apply the latest schema
node dispatcher.js

# Or use the CLI to verify
node cli.js status
```

Schema migrations are applied automatically. The `migrate-v5.js`
migration adds delivery guarantee, job class, approval gates,
context retrieval, typed messages, and the approvals table. It runs
on startup if the database is at an earlier schema version.

### Process management

**macOS (launchd):**

Create a plist at `~/Library/LaunchAgents/ai.openclaw.scheduler.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>ai.openclaw.scheduler</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>dispatcher.js</string>
  </array>
  <key>WorkingDirectory</key>
  <string><!-- /path/to/.openclaw/scheduler --></string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>OPENCLAW_GATEWAY_URL</key>
    <string>http://127.0.0.1:18789</string>
    <!-- Add OPENCLAW_GATEWAY_TOKEN if auth is enabled -->
    <!-- Add SCHEDULER_BACKUP_ENABLED=true for backups -->
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardErrorPath</key>
  <string>/tmp/openclaw-scheduler.log</string>
  <key>StandardOutPath</key>
  <string>/tmp/openclaw-scheduler.log</string>
</dict>
</plist>
```

```bash
launchctl load ~/Library/LaunchAgents/ai.openclaw.scheduler.plist
```

**Linux (systemd):**

Create a unit at `~/.config/systemd/user/openclaw-scheduler.service`:

```ini
[Unit]
Description=OpenClaw Standalone Scheduler
After=network.target

[Service]
Type=simple
WorkingDirectory=%h/.openclaw/scheduler
ExecStart=/usr/bin/node dispatcher.js
Restart=always
RestartSec=5
Environment=OPENCLAW_GATEWAY_URL=http://127.0.0.1:18789
# Environment=OPENCLAW_GATEWAY_TOKEN=your-token
# Environment=SCHEDULER_BACKUP_ENABLED=true

[Install]
WantedBy=default.target
```

```bash
systemctl --user daemon-reload
systemctl --user enable --now openclaw-scheduler
```

### Setting up backups (optional)

```bash
# 1. Install mc (MinIO Client)
brew install minio/stable/mc  # macOS
# or: curl -O https://dl.min.io/client/mc/release/linux-amd64/mc && chmod +x mc

# 2. Configure an alias for your S3-compatible storage
mc alias set mystore https://s3.example.com ACCESS_KEY SECRET_KEY

# 3. Create the bucket
mc mb mystore/my-backups

# 4. Set environment variables
export SCHEDULER_BACKUP_ENABLED=true
export SCHEDULER_BACKUP_MC_ALIAS=mystore
export SCHEDULER_BACKUP_BUCKET=my-backups
export SCHEDULER_BACKUP_PREFIX=scheduler

# 5. Test manually
node backup.js snapshot
node backup.js status
```

### File layout

```
~/.openclaw/scheduler/
├── dispatcher.js       # main process: tick loop, dispatch, health checks, replay
├── db.js               # SQLite connection (WAL mode, foreign keys, checkpoint)
├── schema.sql          # table definitions
├── jobs.js             # job CRUD, scheduling, chains, retry, resource pools
├── runs.js             # run lifecycle, stale/timeout, heartbeat, context summary
├── messages.js         # inter-agent message queue (typed kinds, owner, priority)
├── agents.js           # agent registry
├── approval.js         # HITL approval gates: create, resolve, timeout, prune
├── retrieval.js        # hybrid retrieval: recent summaries, TF-IDF + substring
├── gateway.js          # gateway health + chat completions + delivery aliases
├── backup.js           # optional: object storage snapshot/rollup/restore
├── cli.js              # CLI interface (all management commands)
├── test.js             # 281 assertions
├── migrate.js          # schema migrations (runner)
├── migrate-v5.js       # v5 migration: delivery, approvals, retrieval, typed msgs
├── package.json        # dependencies (better-sqlite3, croner)
└── scheduler.db        # SQLite database (created on first run)
```

## Production status

Working implementation deployed and stable. **281 test assertions**
covering schema, cron scheduling, job CRUD, run lifecycle, messages,
agents, workflow chaining, retry logic, cascade cancellation, resource
pools, trigger conditions, delivery aliases, run-now, queue overlap,
delivery semantics, flush-before-compaction, context summaries, typed
messages, approval gates, run replay, and hybrid retrieval.

Stable with zero missed fires and zero undetected stale runs. Survived
gateway restarts, scheduler restarts, and network blips without data
loss.

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
