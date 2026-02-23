---
summary: "Temporary implementation plan for ACP thread-bound production hardening and operator controls"
owner: "onutc"
status: "temporary"
last_updated: "2026-02-23"
title: "ACP Thread Bound Production Hardening (Temporary)"
---

# ACP Thread Bound Production Hardening (Temporary)

## Temporary status

This is a **temporary working doc**.

- **Delete this file after implementation is complete** and after final details are merged into permanent docs/plans.
- Target deletion point: end of the ACP production-hardening rollout in this branch/PR series.

## Why this doc exists

Track focused hardening work to make ACP thread-bound sessions production ready, with clear behavior for missing `acpx`, cleaner architecture, and operator controls from inside thread workflows.

## Scope

1. Remove unnecessary code and duplicate logic.
2. Define behavior when ACP backend (`acpx`) is unavailable, including guided install/setup flow.
3. Refactor for cleaner long-term architecture.
4. Add ACP session controls in-thread (model and related settings).

## Non-goals

- Replacing ACP with a new transport.
- Full control-plane migration to SQLite in this pass.
- Reworking unrelated subagent features.

## Workstream A: Remove unnecessary code

### Goals

- Keep ACP-specific logic only for ACP event mapping and ACP lifecycle.
- Reduce complexity in `dispatch-from-config` ACP branch.

### Tasks

1. Extract ACP runtime dispatch into a dedicated module (for example `acp-dispatcher.ts`) so `dispatch-from-config.ts` only routes.
2. Keep shared chunking/coalescing/delivery via block-streaming + block-reply pipeline.
3. Remove stale ACP config keys/mentions and dead branches.
4. Remove duplicated ACP error formatting paths if any remain.

### Acceptance

- ACP branch in `dispatch-from-config.ts` is small and orchestration-only.
- No duplicate chunk/coalesce logic exists outside shared helpers.

## Workstream B: Missing `acpx` / backend unavailable behavior

### Goals

- Fail fast with actionable guidance.
- Avoid hidden retries and confusing “no output” behavior.
- Provide explicit operator setup/install path.

### Tasks

1. On ACP spawn/turn, detect backend availability through runtime registry health probe.
2. Return explicit user-facing errors:
   - backend missing (plugin not installed/enabled)
   - backend unavailable (`acpx` command missing/not executable)
3. Add operator command flow (for example `/acp doctor` and `/acp install`) that:
   - validates plugin/backend wiring
   - optionally runs configured install/setup command
   - reports next action with exact command if auto-install is disabled
4. Do **not** auto-install during normal message dispatch turns.

### Acceptance

- Missing backend cannot silently fall through to non-ACP behavior.
- User gets one clear message with exact fix path.

## Workstream C: Elegance refactors

### Goals

- Centralize ACP runtime options and error handling.
- Keep ACP code easy to reason about and test.

### Tasks

1. Introduce a canonical `AcpSessionRuntimeOptions` shape persisted with ACP session meta:
   - `model`
   - `cwd`
   - `permissionProfile`
   - `timeoutSeconds`
   - optional backend-specific extras (typed)
2. Ensure all ACP turn execution reads options from one place.
3. Centralize ACP error mapping (`AcpRuntimeError` -> user message + code).
4. Keep config resolution deterministic (single helper entrypoint per concern).

### Acceptance

- One runtime options object drives each turn.
- Error strings and codes are consistent across commands and message routing.

## Workstream D: ACP controls inside threads

### Goals

- Let operators change ACP session behavior without leaving thread workflow.
- Keep controls explicit and auditable.

### Initial command set

1. `/acp status` (shows backend, session mode, options, health)
2. `/acp model <modelId>`
3. `/acp cwd <path>`
4. `/acp permissions <profile>`
5. `/acp timeout <seconds>`
6. `/acp reset-options` (restore defaults for session)

### Tasks

1. Parse and validate each control command.
2. Persist per-session options atomically.
3. Apply updated options to next ACP turn.
4. Echo effective value and source (session override vs default).
5. Keep permission checks and allowlists enforced.

### Acceptance

- Changing model/cwd/etc. in-thread affects subsequent ACP turns.
- Controls survive restart through persisted session metadata.

## Testing plan (required)

### Unit

1. Runtime options persistence and merge precedence tests.
2. ACP error mapping tests for missing/unavailable backend.
3. ACP command parsing/validation tests for new control commands.

### Integration

1. ACP dispatch integration with tiny token deltas -> clean spaced Discord replies.
2. Missing backend path emits explicit error and no silent fallback.
3. Session option update (`/acp model ...`) changes runtime call arguments next turn.

### Manual smoke

1. Spawn ACP thread session.
2. Send normal message and verify reply.
3. Change model in-thread and verify runtime uses new model.
4. Temporarily break backend and verify actionable error path.

## Rollout order

1. Backend availability + explicit error path.
2. ACP dispatcher extraction / cleanup.
3. Runtime options plumbing.
4. In-thread control commands.
5. Final cleanup + docs consolidation.

## Cleanup checklist (end state)

1. Move lasting decisions into permanent ACP plan/docs.
2. Remove temporary notes from code comments/tests.
3. **Delete this file** `docs/experiments/plans/acp-thread-bound-production-hardening-temp.md`.
