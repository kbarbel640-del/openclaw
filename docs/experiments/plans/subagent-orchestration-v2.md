---
summary: "Current subagent orchestration flow and a v2 plan for clearer state transitions, delivery invariants, and recovery"
status: "draft"
last_updated: "2026-02-26"
title: "Subagent Orchestration V2"
---

# Subagent Orchestration V2

## Overview

This document explains how OpenClaw subagent orchestration works today and proposes a v2 plan that keeps the current behavior while making lifecycle state, delivery decisions, and recovery easier to reason about.

Scope:

- `sessions_spawn` with `runtime: "subagent"`
- nested subagent orchestration (main -> orchestrator -> worker)
- completion announce delivery (direct, queued, or internal injection)
- registry persistence, retry, and cleanup behavior

Out of scope:

- ACP runtime internals (`runtime: "acp"`) beyond shared spawn surface
- channel-specific UI details (Discord thread UX, slash command UX)

## Current Logic (How It Works)

### Entry points

Primary entry point:

- `src/agents/tools/sessions-spawn-tool.ts`
  - validates tool params
  - routes to `spawnSubagentDirect(...)` for `runtime: "subagent"`

Core orchestration functions:

- `src/agents/subagent-spawn.ts` -> spawn + register run
- `src/agents/subagent-registry.ts` -> track run lifecycle, wait/resume/retry, cleanup
- `src/agents/subagent-announce.ts` -> synthesize announce payload and deliver it
- `src/agents/subagent-announce-dispatch.ts` -> direct-vs-queue dispatch ordering

### End-to-end flow

1. Caller invokes `sessions_spawn`.
2. `spawnSubagentDirect(...)` validates depth, per-session fanout, and `agentId` allowlist.
3. Child session key is created (`agent:<id>:subagent:<uuid>`), and session metadata is patched (spawn depth, model, thinking).
4. Optional thread binding is prepared through `subagent_spawning` hooks when `thread: true`.
5. Child run is started via gateway `agent` RPC with `deliver: false` and lane `subagent`.
6. `registerSubagentRun(...)` stores a `SubagentRunRecord`, persists it, starts wait/listener/sweeper helpers.
7. Completion is detected through `agent.wait` (primary path) and lifecycle events (embedded/fallback path).
8. `completeSubagentRun(...)` marks outcome and starts announce+cleanup flow.
9. `runSubagentAnnounceFlow(...)` reads child output, resolves announce target, and delivers:
   - internal injection to requester subagent session, or
   - external completion/direct send to user channel, or
   - queued/steered follow-up when requester is busy
10. Registry finalizes cleanup and retries if announce is deferred or transiently blocked.

### Spawn-time invariants

`spawnSubagentDirect(...)` enforces the key orchestration guardrails:

- spawn depth limit from `agents.defaults.subagents.maxSpawnDepth`
- per-session active child limit from `maxChildrenPerAgent`
- target agent allowlist (`agents.list[].subagents.allowAgents`)
- `mode: "session"` requires `thread: true`
- per-run model/thinking overrides are normalized before launch

It also injects a subagent system prompt via `buildSubagentSystemPrompt(...)` so child agents understand:

- they are task-scoped
- results auto-announce back to the requester
- nested spawning is only allowed when depth permits

### Registry model and lifecycle ownership

The registry (`src/agents/subagent-registry.ts`) is the control plane for active/pending subagent runs.

It stores `SubagentRunRecord` entries keyed by `runId` with:

- child session identity
- requester session/origin routing hints
- task and cleanup mode
- timing/outcome fields
- announce retry bookkeeping
- suppression flags (`steer-restart`, `killed`)

Lifecycle ownership is intentionally redundant:

- `agent.wait` is the primary completion signal (cross-process safe)
- lifecycle event listener (`onAgentEvent`) is a fallback/secondary source (especially embedded runs)

This is why the registry can recover after restarts and still resume pending announce/cleanup work.

### Completion and announce logic

`completeSubagentRun(...)` records terminal state, then triggers announce cleanup unless announce is suppressed (for example, steer restart).

`runSubagentAnnounceFlow(...)` performs the orchestration-sensitive logic:

- waits for embedded runs to fully settle before reading output
- reads latest assistant/tool output from child session history
- defers announce if the child still has active descendants
- bubbles nested completion to grandparent when parent subagent session is gone
- builds a structured internal completion message plus conversion instruction
- resolves delivery target using bound-thread routing and optional hooks
- uses deterministic idempotency keys for duplicate suppression

Important nested behavior:

- if requester is another subagent, completion is injected internally (`deliver: false`) so the parent orchestrator can synthesize results
- if requester is main/user-facing, completion may be delivered directly to the channel (`send`) or through a requester-session agent turn

### Delivery arbitration (direct vs queue)

Dispatch ordering is centralized in `runSubagentAnnounceDispatch(...)`:

- `expectsCompletionMessage = true` (default subagent completion UX)
  - direct first
  - queue fallback
- `expectsCompletionMessage = false`
  - queue/steer first
  - direct fallback

Queue path behavior (`maybeQueueSubagentAnnounce(...)`):

- may steer into an active embedded requester run
- may enqueue follow-up/collect announce messages per queue settings
- preserves per-origin queue keys to avoid cross-channel mixing

Direct path behavior (`sendSubagentAnnounceDirectly(...)`):

- can send final completion text directly to the requester channel (`send`)
- otherwise injects an `agent` turn into requester session (internal or external)
- retries transient delivery failures with bounded backoff

### Cleanup, retries, and recovery

The registry handles durability and retries after announce failures/defer conditions:

- persisted run registry is restored on startup (`restoreSubagentRunsOnce`)
- unfinished announce/cleanup work is resumed (`resumeSubagentRun`)
- deferred announces use retry backoff (`announceRetryCount`, `lastAnnounceRetryAt`)
- retries are capped and old pending announces expire (prevents infinite loops)
- non-session-mode child sessions are auto-archived by sweeper after configured TTL

This means orchestration is not just "spawn + wait"; it is a resumable lifecycle with delivery retry semantics.

## V2 Plan (Recommended)

### Goals

- make orchestration state transitions explicit and auditable
- reduce duplicated completion detection paths
- make announce deferral reasons first-class (not only implicit `false` returns)
- improve observability for nested orchestration and delivery path selection
- preserve current user-visible behavior and tool API

### Proposed architecture changes

### 1. Introduce explicit subagent run state machine

Replace implicit field combinations with an explicit phase enum in the registry record, for example:

- `spawning`
- `running`
- `ending`
- `announcing`
- `announce_deferred`
- `cleanup_pending`
- `completed`
- `completed_giveup`

Keep existing fields for compatibility during migration, but make transitions go through one reducer-like function.

### 2. Make announce result typed (not just boolean)

Today `runSubagentAnnounceFlow(...)` returns `boolean` (`didAnnounce`) and overloads `false` for multiple defer/failure cases.

Introduce a structured result:

```ts
type SubagentAnnounceOutcome =
  | { kind: "delivered"; path: "direct" | "queued" | "steered" }
  | {
      kind: "deferred";
      reason: "child-active" | "descendants-active" | "missing-requester" | "requester-busy";
    }
  | { kind: "skipped"; reason: "announce-skip" | "silent" }
  | { kind: "failed"; retryable: boolean; error: string };
```

Benefits:

- clearer cleanup decisions
- better logs/metrics
- fewer hidden semantics in `finalizeSubagentCleanup(...)`

### 3. Centralize completion signal reconciliation

Create a small reconciler that merges:

- `agent.wait` results
- lifecycle events (`start`, `end`, `error`)
- embedded-run settle checks

into one terminal decision per `runId`.

This reduces duplication between:

- `waitForSubagentCompletion(...)`
- lifecycle listener path in `ensureListener()`
- announce-time embedded settle checks

### 4. Promote delivery decision tracing

Add a structured trace object to announce delivery attempts, persisted in memory/logs:

- chosen target requester session
- requester depth / nested vs main
- route mode (`bound`/`hook`/`fallback`)
- dispatch phases attempted (`direct-primary`, `queue-fallback`, etc.)
- final path and idempotency key

This will make debugging nested orchestration and duplicate suppression much faster.

### 5. Separate cleanup policy from transport outcomes

Move retry/give-up/defer policy into a dedicated policy helper that consumes typed announce outcomes and registry state.

This makes it easier to test:

- descendant deferrals
- retry limits
- expiry behavior
- session delete vs keep cleanup decisions

### Implementation plan

#### Phase 1 (no behavior change): document and instrument

- Add internal docs (this file)
- Add debug logs/structured tracing for announce dispatch phases and deferral reasons
- Add tests around nested fallback/bubble behavior if gaps remain

Exit criteria:

- no user-visible behavior changes
- better logs explain why an announce was deferred, queued, or sent directly

#### Phase 2 (behavior-preserving refactor): typed outcomes + state transitions

- Add `SubagentAnnounceOutcome` result type
- Wrap existing `runSubagentAnnounceFlow(...)` logic to return typed outcomes
- Introduce explicit registry phase updates while preserving current persisted fields
- Update cleanup finalization to consume typed outcomes

Exit criteria:

- existing subagent tests pass unchanged (or with only assertion updates for richer traces)
- no regression in direct/queue fallback ordering

#### Phase 3 (reconciliation cleanup): unified terminal signal handling

- Add completion reconciler per `runId`
- Route `agent.wait` and lifecycle listener through shared reconciliation logic
- Keep embedded settle checks, but emit explicit `deferred` reasons

Exit criteria:

- fewer duplicate code paths for terminal handling
- deterministic terminal state transitions in tests

#### Phase 4 (optional): shared orchestration core for subagent + ACP

If we want ACP and subagent orchestration to converge further, extract a shared orchestration interface for:

- run registry lifecycle
- announce/delivery dispatch policy
- retry/cleanup state transitions

Keep runtime-specific execution logic separate:

- subagent runtime uses gateway `agent` + sessions
- ACP runtime uses ACP control plane/runtime adapter

## Risks and constraints

- Nested orchestration behavior is subtle; refactors can easily break bubble-up delivery.
- Queue behavior is channel/session-state dependent, so tests must cover both active and idle requester sessions.
- Restart recovery and orphan pruning must remain best-effort and fail-safe (do not silently drop deliverable results).
- Backward compatibility matters for existing registry persistence format and hook expectations.

## Acceptance criteria for V2

- A maintainer can trace any subagent run from spawn to cleanup using one consistent state timeline.
- Announce outcomes are explicit (delivered/deferred/skipped/failed) with reasons.
- Direct-vs-queue dispatch ordering remains unchanged unless intentionally modified.
- Restart recovery still resumes pending announce/cleanup work.
- Nested subagent completion bubbling remains covered by tests.

## Code references

- `src/agents/tools/sessions-spawn-tool.ts`
- `src/agents/subagent-spawn.ts`
- `src/agents/subagent-registry.ts`
- `src/agents/subagent-registry.types.ts`
- `src/agents/subagent-announce.ts`
- `src/agents/subagent-announce-dispatch.ts`
- `src/agents/subagent-announce-queue.ts`
- `docs/tools/subagents.md`
