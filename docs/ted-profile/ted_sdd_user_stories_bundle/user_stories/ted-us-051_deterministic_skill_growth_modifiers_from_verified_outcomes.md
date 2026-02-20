---
id: TED-US-051
title: Deterministic skill growth modifiers from verified outcomes
epic: EPIC-09
job_family: GOV
priority: P1
release_target: Phase-1
persona: "Operator (Clint)"
status: Proposed
created: 2026-02-20
---

## User story

As **Operator (Clint)**, I want **role behavior to improve from verified outcomes using deterministic growth rules** so that **the system gets smarter without unpredictable jumps or hidden autonomy.**

## Acceptance criteria

- [ ] Growth modifiers are derived from verified metrics (for example: draft acceptance, triage reduction, error recurrence) using deterministic thresholds.
- [ ] Modifiers are bounded, auditable, and reversible.
- [ ] Growth never overrides hard bans, approval requirements, or draft-only boundaries.

## Notes / constraints

- Preference is rule-based growth first; no opaque self-rewriting role logic in Day-1.

## Explicit non-goals (safety / scope)

- No autonomous outbound send (email, invites, third-party messaging).
- No access to personal email/calendar unless explicitly re-scoped by governance.
- No trading/broker execution.
