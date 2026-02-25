# TEMP: ACP Session Identity Stabilization Plan

Status: Draft  
Owner: OpenClaw  
Date: 2026-02-25  
Delete after: implementation is merged and verified in production-like Discord testing

## Goal

Make ACP session identity stable and trustworthy across spawn, thread messaging, `/acp status`, and `codex resume`.

## Problem statement

Current behavior can show an ID that does not work with `codex resume`.

Observed pattern:

- thread banner prints ID `A`
- real Codex resumable session ends up as ID `B`
- `codex resume A` fails
- `codex resume B` works

## Root causes

1. Identity is eventually consistent.
   - `acpx` has local bookkeeping identity and agent/backend identity, and they can diverge.
2. OpenClaw surfaces IDs too early.
   - identity shown at spawn can be provisional before first real turn/status reconciliation.
3. Identity ingest is split across multiple paths.
   - ensure/status/metadata projection paths can drift.
4. Deployment drift can reintroduce old behavior.
   - gateway runs `dist/`; source fixes do nothing until rebuild + restart.

## Scope

In scope:

- Canonical ACP identity model and lifecycle (`pending` -> `resolved`)
- Single identity ingest path in ACP manager
- Deterministic user-facing rendering rules
- Tests that lock the behavior

Out of scope:

- Full ACP control-plane redesign
- Non-ACP session identity changes
- New Discord UX beyond identity correctness

## Target invariants

1. ACP metadata uses one canonical identity object.
   - `acpxRecordId`
   - `acpxSessionId`
   - `agentSessionId`
2. Identity has explicit state.
   - `pending`: not safe to display as resumable
   - `resolved`: safe to display and use
3. Spawn banner never prints concrete IDs while `pending`.
4. Once `resolved`, identity does not silently regress to placeholder values.
5. Any identity change after resolution requires an explicit backend signal and is logged.

## Design

### 1) Canonical identity type

Add a single type in ACP runtime/control-plane:

- `AcpSessionIdentity`
  - `state: "pending" | "resolved"`
  - `acpxRecordId?: string`
  - `acpxSessionId?: string`
  - `agentSessionId?: string`
  - `lastUpdatedAt: number`
  - `source: "ensure" | "status" | "event"`

Replace ad-hoc top-level identity fields in ACP session meta with this object.

### 2) Single ingest path

Identity writes happen through one manager function:

- `reconcileSessionIdentity(sessionKey, incomingIdentity, source)`

Rules:

- never overwrite resolved `agentSessionId` with empty/placeholder values
- allow updates only when incoming data is strictly better
- emit structured log when identity changes

### 3) User-facing rendering rules

Centralize identity text formatting in one helper used by:

- ACP spawn intro
- `/acp status`
- `/focus` ACP detail lines

Rendering behavior:

- `pending`: show `session ids: pending (available after the first reply)`
- `resolved`: show canonical IDs
- always label resumable ID explicitly as `agent session id`

### 4) Startup reconciliation

On gateway startup:

- scan ACP sessions with identity `pending`
- run lightweight status reconciliation for each
- resolve to `resolved` when backend provides stable IDs
- keep `pending` if unavailable, with timestamped warning

### 5) Build/runtime guardrail

Add a lightweight startup log line including app revision and identity renderer version string to quickly detect stale `dist` vs source expectations during incidents.

## File map (planned)

Core ACP types/manager:

- `src/config/sessions/types.ts`
- `src/acp/control-plane/manager.ts`
- `src/acp/runtime/session-identifiers.ts`
- `src/acp/runtime/types.ts`

Command surfaces:

- `src/agents/acp-spawn.ts`
- `src/auto-reply/reply/commands-acp/runtime-options.ts`
- `src/auto-reply/reply/commands-subagents/action-focus.ts`

Tests:

- `src/acp/control-plane/manager.test.ts`
- `src/agents/acp-spawn.test.ts`
- `src/auto-reply/reply/commands-acp.test.ts`
- `src/auto-reply/reply/commands-subagents-focus.test.ts`

## Phased implementation

## Phase 1: Type and state machine

- Introduce canonical identity object in ACP metadata
- Add reconcile helper and unit tests for transitions

## Phase 2: Wire manager ingest

- Route ensure/status identity updates through reconcile helper only
- Remove duplicate write paths

## Phase 3: Unify rendering

- Update all ACP-facing intro/status formatters to use one helper
- Ensure pending behavior is consistent everywhere

## Phase 4: Startup reconcile + observability

- Reconcile pending sessions on startup
- Add structured logs for identity transitions and unresolved sessions

## Phase 5: Regression tests

- Add e2e-style test:
  - spawn ACP thread
  - banner shows pending
  - first reply resolves identity
  - status exposes resumable `agentSessionId`

## Acceptance criteria

1. New ACP thread spawn never shows unusable IDs.
2. After first successful turn, `agentSessionId` is available and works with `codex resume`.
3. No code path writes ACP identity outside reconcile helper.
4. Existing ACP command and spawn tests pass, plus new identity lifecycle tests.
5. Manual Discord smoke confirms:
   - banner pending state
   - resolved ID after first reply
   - no ID mismatch in user-facing output
