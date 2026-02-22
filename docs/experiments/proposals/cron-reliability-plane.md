# Proposal: Cron Reliability Plane for OpenClaw Core

Author: @tkuehnl  
Date: 2026-02-22  
Status: Draft (design proposal)

## Context

This proposal is informed by operating a 5-agent OpenClaw swarm in production
(Anvil, Hammer, Forge, Chisel, Gavel) with continuous cron-driven workflows and
public output at https://labs.anvil-ai.io.

Observed recurring failure classes are consistent with active community issues:
- cron management latency/timeouts (#16199)
- duplicate/multi-fire behavior (#16094, #23302)
- schedule drift after restart/catch-up (#22895)
- session/tool availability decay in long-lived cron sessions (#23063)
- timeout/read-path regressions under load (#23376, now closed on main but still relevant for mixed-version deployments)

## Problem statement

OpenClaw cron execution generally works, but reliability under sustained
production load is limited by:
1) read/control path latency under scheduler contention
2) duplicate-fire/drift edge cases
3) session survivability and tool-availability decay
4) run success vs delivery success ambiguity

## Goals

1. Deterministic schedule semantics under load and restart.
2. Bounded-latency management APIs (`list/status/runs`).
3. Exactly-once **effect** via idempotent run-key contract.
4. Explicit and auditable run-state truth.
5. Session survivability with policy-driven rotation.

## Non-goals

- Replacing cron with an external orchestrator.
- Introducing mandatory external infra (Redis/Postgres/etc.) for baseline.

## Operator SLO targets

- `cron list/status`: p95 < 1.5s, p99 < 3s
- Schedule drift after restart/catch-up: <= 1 interval
- Duplicate effective execution rate: < 0.1%
- Delivery success for enabled channels: >= 99.9%
- Silent tool-loss in cron sessions: 0 (must surface and auto-recover)

## Proposal

### A) Non-blocking control-plane reads
- Maintain indexed job/run state optimized for read APIs.
- Keep read path independent from hot scheduler execution loops.

### B) Deterministic run planner
- Persist `next_due_at` and `last_fired_at` with monotonic planner logic.
- Add explicit per-job misfire policy:
  - `skip`
  - `fire_once`
  - `catchup_bounded(N)`

### C) Idempotent execution contract
- Deterministic `run_key = job_id + scheduled_at + sequence`.
- Enforce dedupe/lease semantics on executor path.
- Preserve run_key across retries.

### D) Session survivability
- Add per-job policies:
  - `freshSession`
  - `maxTurns`
  - `maxAgeMinutes`
  - `toolHealthProbe`
- Auto-rotate/recover on tool-loss with explicit recovery receipt.

### E) Delivery pipeline separation
- Split `run_status` from `delivery_status`.
- Delivery retries and dead-letter reasons are first-class fields.

## Phased implementation

### Phase 1 (stability unblock)
- Non-blocking list/status path
- run_key dedupe guard
- run_status vs delivery_status split
- regression tests for timeout/duplicate/drift paths

### Phase 2 (hardening)
- misfire/catch-up policy engine
- session auto-rotation and tool-health probe
- delivery retry/dead-letter pipeline
- scheduler stress and restart recovery tests

### Phase 3 (operational polish)
- built-in reliability dashboards + diagnostics receipts
- docs and migration notes

## Acceptance tests

1. 500-job same-minute due-time stress: no duplicate effective execution.
2. Restart during catch-up: bounded drift by policy.
3. list/status under run storm: SLO p95/p99 pass.
4. Channel outage simulation: run success with explicit delivery failure + retries.
5. Tool-loss simulation: auto-recycle + successful rerun receipt.

## Evidence expectations

Before release, verify via dogfooding telemetry and reproducible receipts
against the SLO targets above (including failure mode tests).

## Why now

Cron reliability is currently a high-frequency operational pain in community
reports and production usage. Solving this in core improves every OpenClaw
deployment and unlocks more reliable autonomous workflows.
