# TEMP: Session Binding Service Migration Plan (ACP + Thread Focus)

Status: Draft  
Owner: OpenClaw  
Date: 2026-02-23  
Delete after: implementation is merged and follow-up cleanup PR lands

## Goal

Make `SessionBindingService` the single binding control plane for ACP/thread-bound flows, while preserving existing Discord behavior.

## Why now

Current ACP + focus paths still call Discord binding internals directly. We already have a shared binding service and Discord adapter registration, but command/runtime code is not consistently using it.

## Scope

In scope:

- Migrate ACP spawn/focus binding flows to `SessionBindingService`
- Remove direct Discord binding manager usage from those flows
- Keep behavior and UX the same on Discord
- Add tests to lock parity and prevent regressions

Out of scope (for this temp plan):

- Replacing Discord binding persistence internals
- Reworking Discord webhook/thread implementation details
- Enabling non-Discord thread-like surfaces (future adapter work)

## Current state (source of coupling)

Direct Discord binding usage still exists in:

- `src/agents/acp-spawn.ts`
- `src/auto-reply/reply/commands-acp/lifecycle.ts`
- `src/auto-reply/reply/commands-subagents/action-focus.ts`
- `src/discord/monitor/message-handler.preflight.ts` (routing override path)

Shared service already exists at:

- `src/infra/outbound/session-binding-service.ts`

Discord adapter registration already exists at:

- `src/discord/monitor/thread-bindings.manager.ts`

## Design principles

1. ACP remains channel-agnostic.
2. Commands call binding service APIs, not channel internals.
3. Channel-specific logic stays inside adapters.
4. Migration is incremental, behavior-preserving, and test-driven.

## Phase plan

## Phase 1: Strengthen binding service contract

### Changes

- Extend service bind input to express placement intent without Discord terms.
  - Example: `placement: "current" | "child"`.
- Add structured error surface from service/adapters.
  - Example codes: `BINDING_ADAPTER_UNAVAILABLE`, `BINDING_CAPABILITY_UNSUPPORTED`, `BINDING_CREATE_FAILED`.
- Add capability probe helper so command layer can report clear user-facing messages.

### Files

- `src/infra/outbound/session-binding-service.ts`
- `src/infra/outbound/session-binding-service.test.ts` (new or expanded)

### Result

Command layer can request binding intent generically and handle failure consistently.

## Phase 2: Migrate ACP spawn paths to service

### Changes

- Replace direct `getThreadBindingManager` / `parseDiscordTarget` usage in ACP spawn flows with service bind calls based on normalized conversation context.
- Keep existing intro text and session ID lines.
- Keep existing config gating behavior (including current Discord-only limitation wording), but route bind through service.

### Files

- `src/agents/acp-spawn.ts`
- `src/auto-reply/reply/commands-acp/lifecycle.ts`
- `src/auto-reply/reply/commands-acp/diagnostics.ts` (if it introspects bindings directly)
- `src/auto-reply/reply/commands-acp/targets.ts` (if thread resolution bypasses service)

### Result

ACP spawn logic no longer imports Discord binding manager directly.

## Phase 3: Migrate /focus path to service

### Changes

- Update `/focus` binding to use service bind calls.
- Keep current user authorization checks and intro formatting behavior.
- Preserve ACP metadata-derived session detail lines.

### Files

- `src/auto-reply/reply/commands-subagents/action-focus.ts`
- `src/auto-reply/reply/commands-subagents-focus.test.ts`

### Result

`/focus` stops depending on Discord binding internals.

## Phase 4: Route inbound binding lookup through service

### Changes

- In Discord preflight/routing path, replace direct thread manager lookup with `service.resolveByConversation(...)`.
- Keep fallback behavior and existing policy checks unchanged.

### Files

- `src/discord/monitor/message-handler.preflight.ts`
- `src/discord/monitor/message-handler.process.ts` (if required for context plumbing)
- `src/infra/outbound/bound-delivery-router.ts` (if helper reuse is needed)

### Result

Inbound override path matches outbound/control-plane model.

## Phase 5: Cleanup + guardrails

### Changes

- Remove no-longer-needed direct imports from ACP/focus flows.
- Add lint-level architectural guardrails (or code comments/tests) to prevent reintroduction of direct Discord binding dependencies in ACP command/runtime modules.

### Files

- ACP/focus files touched above
- Optional: `eslint` boundaries rule config (if repo policy allows)

### Result

Architecture is enforced, not just documented.

## Testing plan

Unit tests:

- `session-binding-service` behavior for:
  - bind current vs child placement
  - adapter unavailable
  - capability unsupported
  - deterministic error mapping

Command tests:

- ACP spawn tests still pass and verify thread binding behavior through service.
- `/focus` tests still pass and verify intro text/session details.

Integration tests:

- Discord thread-bound ACP spawn still:
  - creates/binds thread
  - routes follow-up messages correctly
  - returns output in thread only (no parent-channel duplicate)

Regression checks:

- `pnpm check`
- Targeted vitest suites:
  - `src/agents/acp-spawn.test.ts`
  - `src/auto-reply/reply/commands-acp.test.ts`
  - `src/auto-reply/reply/commands-subagents-focus.test.ts`
  - Discord monitor preflight/process tests impacted by routing changes

## Risks and mitigations

Risk: subtle behavior drift in thread creation/rebinding rules.  
Mitigation: keep Discord adapter as source of thread behavior; migration only changes call path.

Risk: command error text drift.  
Mitigation: centralize service error-to-user mapping and snapshot key messages in tests.

Risk: partial migration leaves mixed API usage.  
Mitigation: phase gate + “no direct Discord binding imports” check for ACP/focus modules.

## Acceptance criteria

1. ACP spawn/focus flows do not import Discord thread-binding manager APIs directly.
2. Behavior is unchanged for Discord thread-bound workflows.
3. Inbound routing can resolve bindings via service conversation lookup.
4. All targeted tests and `pnpm check` pass.
5. Follow-up channels can integrate by implementing adapter only (no ACP core changes).
