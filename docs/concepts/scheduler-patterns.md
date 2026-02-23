---
summary: "Application-layer patterns for the standalone task scheduler"
read_when:
  - Building domain-specific pipelines on the scheduler
  - Designing event-driven workflows with job chains
  - Implementing betting, trading, or data pipelines
title: "Scheduler Patterns & Recipes"
---

# Scheduler Patterns & Recipes

This guide shows how to compose the
[standalone scheduler's](standalone-scheduler.md) primitives into
real-world pipelines. Read the RFC first for the full feature set;
this document focuses on application-layer patterns.

## Core principle

**The scheduler is the control plane.** It orchestrates when jobs
run, enforces concurrency, gates approvals, and chains steps
together. Your data files (JSON, SQLite, a database) are the source
of truth. Markdown is an optional derived view for human
consumption. Never store authoritative state in markdown.

## 1. Event-driven pipelines

The fundamental pattern is a multi-step chain where each job
produces a signal that triggers the next:

```
capture --> analyze --> decide --> act --> verify
```

Each step is a job with:

- `trigger_on: "success"` (or `"failure"` for error handlers).
- `trigger_condition: "contains:SIGNAL"` for content gating.
- `resource_pool` for shared API rate limits.
- `delivery_guarantee` matched to the step's idempotency.

### How it works

1. The **capture** job runs on a cron schedule and writes raw data
   to a file or database. Its output includes a signal string (e.g.,
   `NEW_DATA`) when new data arrives.
2. The **analyze** job has `trigger_on: "success"` and
   `trigger_condition: "contains:NEW_DATA"`. It only fires when the
   capture step actually found something new.
3. The **decide** job evaluates the analysis and emits a decision.
   It uses typed messages with `kind: "decision"` for audit trails.
4. The **act** job executes the decision. It has
   `approval_required: true` for high-impact actions and
   `delivery_guarantee: "at-least-once"` with an idempotency key.
5. The **verify** job confirms the action succeeded. It fires on
   `trigger_on: "complete"` so it runs whether the act step
   succeeded or failed.

### Choosing delivery guarantees

| Step type     | Guarantee       | Rationale                                    |
| ------------- | --------------- | -------------------------------------------- |
| Data capture  | `at-most-once`  | Missing a capture is fine; duplicates waste  |
| Pure analysis | `at-most-once`  | Idempotent by nature, safe to skip           |
| Decisions     | `at-most-once`  | Re-running produces the same result          |
| Side effects  | `at-least-once` | Must not silently miss; use idempotency keys |
| Notifications | `at-most-once`  | Duplicate alerts are noisy; one miss is fine |

### Choosing overlap policies

| Scenario                   | Policy  | Why                              |
| -------------------------- | ------- | -------------------------------- |
| Data capture (frequent)    | `skip`  | Next run will catch up           |
| Long analysis              | `queue` | Buffer work, drain when ready    |
| Independent notifications  | `allow` | No shared state, safe to overlap |
| Anything with shared state | `skip`  | Prevent race conditions          |

## 2. Betting pipeline

A complete sports betting pipeline using job chains:

```
odds.capture --> edge.scan --> risk.check --> ticket.emit --> grade.settle --> report.export
```

### odds.capture

Scrapes odds from sportsbook APIs. Writes to `odds.json` or a
database table. The output includes `NEW_ODDS` when fresh lines
are found.

```json
{
  "name": "odds.capture",
  "schedule": "*/5 * * * *",
  "session": "isolated",
  "resource_pool": "sportsbook-api",
  "delivery_guarantee": "at-most-once",
  "overlap_policy": "skip",
  "payload": "Fetch current odds from configured sportsbook APIs. Write results to data/odds.json. If any lines changed since last capture, include NEW_ODDS in your response. If nothing changed, respond with NO_CHANGE.",
  "delivery_to": "@ops-channel"
}
```

- `resource_pool: "sportsbook-api"` prevents concurrent API calls
  that would trigger rate limits.
- `overlap_policy: "skip"` because the next capture will catch
  anything missed.
- `delivery_guarantee: "at-most-once"` because missing a single
  capture is acceptable; the next run fills the gap.

### edge.scan

Reads captured odds, runs the edge-detection model, identifies
profitable opportunities. Pure computation, idempotent by nature.

```json
{
  "name": "edge.scan",
  "parent_id": "<odds.capture job ID>",
  "trigger_on": "success",
  "trigger_condition": "contains:NEW_ODDS",
  "session": "isolated",
  "delivery_guarantee": "at-most-once",
  "context_retrieval": "recent",
  "context_retrieval_limit": 3,
  "payload": "Read data/odds.json. Run the edge model against current lines. Write identified edges to data/edges.json with timestamp, market, line, fair value, and edge percentage. If any edges exceed the threshold, include EDGE_FOUND in your response."
}
```

- Fires only when `odds.capture` succeeds AND its output contains
  `NEW_ODDS`.
- `context_retrieval: "recent"` gives the model awareness of recent
  edge scans for trend detection.

### risk.check

Validates edges against bankroll constraints, position limits, and
correlation rules. This is the decision gate.

```json
{
  "name": "risk.check",
  "parent_id": "<edge.scan job ID>",
  "trigger_on": "success",
  "trigger_condition": "contains:EDGE_FOUND",
  "session": "isolated",
  "delivery_guarantee": "at-most-once",
  "payload": "Read data/edges.json and data/bankroll.json. For each edge: check bankroll constraints (max bet size, daily loss limit), position limits (max correlated exposure), and correlation rules. Write approved tickets to data/tickets.json. Include TICKET_READY for each approved ticket. Use kind:decision typed messages for audit trail."
}
```

- Decision step: the agent writes typed messages with
  `kind: "decision"` and `owner: "risk-model"` to create an audit
  trail of what was approved and why.

### ticket.emit

Places the actual bet. This is where real money moves, so it has
the strongest safety controls.

- `approval_required: true` creates a HITL gate. The operator must
  explicitly approve before execution.
- `delivery_guarantee: "at-least-once"` with idempotency keys
  ensures the bet is never silently lost. The idempotency key
  prevents double-betting on replay.
- `resource_pool: "sportsbook-api"` prevents concurrent placement
  attempts.

### grade.settle

After the game completes, grades the bet result. Must check if the
bet is already settled before acting (idempotent by design).

- `delivery_guarantee: "at-least-once"` because missing a
  settlement means the bankroll drifts from reality.
- The job reads game results, compares to the ticket, and updates
  `bets.json` or the database.

### report.export

Optional tail job that generates a markdown summary and sends it to
chat.

- `trigger_on: "success"` from `grade.settle`.
- `delivery_guarantee: "at-most-once"` because if this fails, no
  data is lost. The source of truth is in the database, not the
  report.

## 3. Trading pipeline

A stock and options trading pipeline:

```
market.scan --> signal.detect --> risk.assess --> order.stage --> order.execute --> position.track
```

Key differences from the betting pipeline:

- `order.execute` needs both `approval_required: true` and
  `resource_pool: "broker-api"`.
- `position.track` is a recurring job (not chain-triggered) that
  independently monitors open positions.
- `signal.detect` uses `context_retrieval: "hybrid"` to reference
  prior signals by relevance, not just recency.

### market.scan

```json
{
  "name": "market.scan",
  "schedule": "*/10 6-20 * * 1-5",
  "session": "isolated",
  "resource_pool": "market-data-api",
  "delivery_guarantee": "at-most-once",
  "overlap_policy": "skip",
  "payload": "Fetch current market data for watchlist symbols. Write to data/market-snapshot.json. If any symbols hit scan criteria (volume spike, price breakout, IV rank change), include SCAN_HIT in your response."
}
```

- Runs every 10 minutes during market hours (weekdays, 6 AM to
  8 PM).
- `overlap_policy: "skip"` because market data is time-sensitive;
  stale scans are worthless.

### signal.detect

```json
{
  "name": "signal.detect",
  "parent_id": "<market.scan job ID>",
  "trigger_on": "success",
  "trigger_condition": "contains:SCAN_HIT",
  "session": "isolated",
  "context_retrieval": "hybrid",
  "context_retrieval_limit": 10,
  "payload": "Read data/market-snapshot.json. Analyze scan hits against the signal model. Cross-reference with prior signals from context. Write actionable signals to data/signals.json. Include SIGNAL_DETECTED for each confirmed signal."
}
```

- `context_retrieval: "hybrid"` uses TF-IDF scoring to surface the
  most relevant prior signals, not just the most recent ones. This
  helps detect recurring patterns across different time periods.

### order.execute

```json
{
  "name": "order.execute",
  "parent_id": "<order.stage job ID>",
  "trigger_on": "success",
  "trigger_condition": "contains:ORDER_STAGED",
  "session": "isolated",
  "approval_required": true,
  "approval_timeout_s": 900,
  "approval_auto": "reject",
  "resource_pool": "broker-api",
  "delivery_guarantee": "at-least-once",
  "payload": "Read data/staged-orders.json. For each approved order: submit to the broker API. Record confirmation in data/executions.json. Include ORDER_FILLED for each successful fill."
}
```

- `approval_timeout_s: 900` (15 minutes) because market conditions
  change fast. If the operator does not approve within 15 minutes,
  the order is automatically rejected.
- `delivery_guarantee: "at-least-once"` with idempotency keys to
  ensure fills are never silently lost. The idempotency key prevents
  duplicate order submissions on replay.

### position.track

Unlike other steps, this is a standalone recurring job:

```json
{
  "name": "position.track",
  "schedule": "*/15 6-20 * * 1-5",
  "session": "isolated",
  "overlap_policy": "skip",
  "context_retrieval": "recent",
  "context_retrieval_limit": 5,
  "payload": "Read data/executions.json for open positions. Check current prices. If any position hits stop-loss or profit target, include POSITION_ALERT in your response. Write position status to data/positions.json."
}
```

- Not chain-triggered; runs independently on its own schedule.
- `context_retrieval: "recent"` lets it see recent position changes
  for trend awareness.

## 4. Monitoring and ops pipeline

```
health.check --> alert.triage --> escalate.notify --> incident.track
```

### health.check

```json
{
  "name": "health.check",
  "schedule": "*/5 * * * *",
  "session": "isolated",
  "overlap_policy": "skip",
  "delivery_guarantee": "at-most-once",
  "payload": "Check health of all configured services (gateway, scheduler, database, external APIs). Write status to data/health.json. If any service is down, include UNHEALTHY:<service-name> in your response. If a critical service is down, also include CRITICAL."
}
```

- `overlap_policy: "skip"` prevents health checks from piling up if
  one takes longer than 5 minutes.

### alert.triage

- `trigger_condition: "contains:UNHEALTHY"` filters out healthy
  check results.
- Correlates with recent alerts to suppress flapping (a service
  that bounces up and down).

### escalate.notify

- `trigger_condition: "contains:CRITICAL"` only fires for critical
  issues, not routine degradation.
- `approval_required: false` because critical alerts should not wait
  for human approval.

### incident.track

Creates a task tracker group for the incident response. Multiple
sub-agents can be spawned to handle different aspects of the
incident, and the tracker monitors their progress with dead-man's
switch timeouts.

## 5. Data processing pipeline

```
ingest.raw --> transform.clean --> validate.check --> load.store --> export.report
```

### ingest.raw

```json
{
  "name": "ingest.raw",
  "schedule": "0 * * * *",
  "session": "isolated",
  "resource_pool": "data-source-api",
  "delivery_guarantee": "at-most-once",
  "overlap_policy": "queue",
  "payload": "Fetch new records from the data source API. Append to data/raw-ingest.json. Include INGESTED:<count> in your response with the number of new records."
}
```

- `overlap_policy: "queue"` handles backpressure. If ingestion takes
  longer than an hour, the next run queues instead of being
  skipped. Data is never silently dropped.
- `resource_pool: "data-source-api"` prevents concurrent API calls
  that would exceed rate limits.

### transform.clean

```json
{
  "name": "transform.clean",
  "parent_id": "<ingest.raw job ID>",
  "trigger_on": "success",
  "trigger_condition": "contains:INGESTED",
  "session": "isolated",
  "context_retrieval": "recent",
  "context_retrieval_limit": 3,
  "payload": "Read data/raw-ingest.json. Apply cleaning rules: normalize formats, deduplicate, handle missing values. Write cleaned records to data/clean.json. Include CLEANED:<count> in your response."
}
```

- `context_retrieval: "recent"` gives the transform step awareness
  of prior runs, enabling it to detect schema drift or anomalies
  compared to previous ingestions.

### validate.check

- Validates cleaned data against schema and business rules.
- Includes `VALID` or `INVALID:<reason>` in output.
- On failure, the chain stops here. No bad data reaches storage.

### load.store

- Loads validated data into the target database or data warehouse.
- `delivery_guarantee: "at-least-once"` because missing a load
  creates data gaps. Uses idempotency keys to prevent duplicate
  inserts.
- `resource_pool: "database"` prevents concurrent writes that could
  cause contention.

### export.report

- `delivery_guarantee: "at-most-once"` because the data is safely
  stored. The report is a derived view.

## 6. Domain-specific typed messages

The scheduler's typed message system supports structured
communication between pipeline steps. Messages are sorted by kind
priority when injected into job prompts: constraints first, then
decisions, then facts.

### Betting domain

| Kind         | Owner          | Example                                |
| ------------ | -------------- | -------------------------------------- |
| `constraint` | `bankroll`     | Max bet $50, current exposure $180     |
| `decision`   | `risk-model`   | Approved: BUF -3.5 at +105, edge 2.1%  |
| `fact`       | `odds-capture` | Line moved: BUF -3.5 to -4.0 in 15 min |

### Trading domain

| Kind         | Owner           | Example                                    |
| ------------ | --------------- | ------------------------------------------ |
| `constraint` | `risk-mgmt`     | Max position size 2% of portfolio          |
| `decision`   | `signal-engine` | BUY AAPL 180C 03/21, IV rank 15            |
| `fact`       | `market-data`   | AAPL earnings in 3 days, IV crush expected |

### How typed messages flow through prompts

When the scheduler builds a job prompt via `buildJobPrompt`, typed
messages are injected in priority order:

```
--- Messages ---
[constraint] (owner: bankroll) Max bet $50, current exposure $180
[constraint] (owner: risk-mgmt) No new positions in correlated markets
[decision] (owner: risk-model) Approved: BUF -3.5 at +105, edge 2.1%
[fact] (owner: odds-capture) Line moved: BUF -3.5 to -4.0 in 15 min
[fact] (owner: market-data) NFL Week 12 lines are final
[text] (owner: operator) Remember to check the weather impact model
```

Constraints appear first because they are rules that must not be
violated. Decisions appear next because they represent resolved
choices. Facts provide context. This ordering ensures the agent
sees the most critical information first, even if the context
window is limited.

## 7. Anti-patterns

### Do not store state in markdown

Use JSON, SQLite, or a database. Markdown is a derived view for
human consumption. If the report job fails, data should still be
safe in the source of truth.

### Do not use at-least-once for non-idempotent side effects

Without idempotency keys, replayed jobs will double-execute.
Settling a bet twice or sending duplicate notifications is worse
than missing one. Use `at-most-once` for non-idempotent jobs, or
add idempotency keys and verify them in the job logic.

### Do not chain more than 5-7 steps deep

Deep chains are hard to debug and fragile. If you need more steps,
break the pipeline into sub-pipelines with separate root jobs. Use
typed messages to pass context between pipelines instead of relying
on chain depth.

### Do not skip resource pools for external APIs

Rate limits are real. Every job that calls an external API should
declare a `resource_pool`. Without it, concurrent jobs will compete
for the same API and trigger rate limiting, causing cascading
failures.

### Do not use overlap allow on jobs with shared state

If two instances of a job run simultaneously and both read-modify-
write the same file, data is lost. Use `overlap_policy: "skip"` (if
the next run can catch up) or `"queue"` (if every run matters).
Reserve `"allow"` for stateless jobs like notifications.

### Do not hardcode delivery targets

Use delivery aliases for portability. A job configured with
`delivery_to: "@ops-channel"` works across environments. A job
hardcoded to a specific Telegram chat ID breaks when you move to a
new channel.

## 8. Composing patterns

### Recurring monitoring with event-triggered response

Combine a cron-scheduled health check with an event-driven
escalation chain:

```
health.check (every 5 min, cron)
  --> alert.triage (chain: on UNHEALTHY)
    --> escalate.notify (chain: on CRITICAL)
      --> incident.track (chain: on success)
```

The health check runs regardless of alerts. The escalation chain
only fires when problems are detected. This separates routine
monitoring from incident response.

### Parallel fan-out with fan-in monitoring

A single parent job triggers multiple children that run in
parallel. A task tracker monitors all of them:

1. Create a task tracker group listing expected agents.
2. The parent job completes and triggers N child jobs
   simultaneously (all share the same `parent_id` and
   `trigger_on: "success"`).
3. Each child job reports its status to the task tracker on start
   and completion.
4. The tracker's dead-man's switch detects any child that stops
   responding.
5. When all children finish (or are marked dead), the tracker
   delivers a summary.

This pattern is useful for research pipelines where you fan out
across multiple data sources and need to know when everything is
done.

### Scheduled pipeline with manual override

Combine cron scheduling with run-now and approval gates:

1. The pipeline normally runs on a cron schedule (e.g., daily at
   2 AM).
2. An operator can trigger an immediate run with
   `node cli.js jobs run <id>`.
3. The critical action step has `approval_required: true`, so even
   a manual trigger must be approved before execution.
4. `approval_timeout_s` with `approval_auto: "reject"` ensures
   unattended manual triggers do not execute dangerous actions
   indefinitely.

This gives operators the flexibility to run pipelines on-demand
while maintaining safety gates for high-impact steps.

### Error recovery with failure chains

Add error-handling jobs that trigger on failure:

```
data.process (main job)
  --> data.verify (chain: on success)
  --> error.handler (chain: on failure)
    --> error.notify (chain: on success)
```

The `error.handler` job fires when `data.process` fails. It can
inspect the error, attempt recovery (e.g., retry with different
parameters), and log the incident. The `error.notify` job alerts
the operator about the failure and recovery attempt.

Use `trigger_on: "failure"` for error handlers and
`trigger_on: "complete"` for cleanup jobs that must run regardless
of outcome.
