---
title: Scaffolds RFC (Phase 0/1)
description: Phase 0 plumbing for deterministic scaffolded execution; Phase 1 introduces generate-verify-patch.
---

# Scaffolds RFC (Phase 0/1)

## Why this exists

We need a **deterministic** and **testable** mechanism to interpose “scaffolds” (generate → verify → patch loops, etc.) between a tool/skill request and the underlying model call.

Phase 0 intentionally ships **plumbing only**: wiring, config parsing, and tests that prove the adapter is a **no-op passthrough**.

## Goals

- Provide a stable interface for future scaffold executors.
- Keep Phase 0 behavior _zero_ (no output changes).
- Make Phase 1+ behavior deterministic (ordering, budgets, error templates) to avoid flaky tests and nondeterministic prompts.

## Non-goals (Phase 0)

- No generate/verify/patch loop.
- No retries/budgets enforcement.
- No manifest loading.

## Phase 0 behavior (truth table)

**In Phase 0, the scaffold adapter is always passthrough.**

| Condition              | Result                       |
| ---------------------- | ---------------------------- |
| Any config value       | Output is unchanged          |
| Any skill/tool request | Output is unchanged          |
| Any scaffold id        | Ignored; output is unchanged |

More explicitly:

- The config field is parsed and validated.
- The adapter is invoked.
- The adapter returns the original text unchanged.

This PR is therefore **pure plumbing** for Phase 1.

## Architecture sketch

- **Adapter** (Phase 0): thin wrapper that can be called by the runtime; returns input unchanged.
- **Executor** (Phase 1+): orchestration layer that can run a scaffold loop and return the final text.

## Related work

- See the Phase 0 scaffolds wiring/tests in `src/scaffolds/**`.
