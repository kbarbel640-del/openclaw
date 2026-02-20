---
id: TED-US-055
title: Global pause and resume control with catch-up summary
epic: EPIC-02
job_family: MNT
priority: P1
release_target: Phase-1
persona: "Operator (Clint)"
status: Proposed
created: 2026-02-20
---

## User story

As **Operator (Clint)**, I want **a global pause/resume control** so that **automation can be halted safely during critical periods without losing context.**

## Acceptance criteria

- [ ] When global pause is active, non-critical automation does not execute and pending work is queued.
- [ ] On resume, system provides a catch-up summary of deferred items and their priorities.
- [ ] Pause/resume actions are auditable with actor and timestamp.

## Notes / constraints

- Critical health/safety checks may continue in read-only mode where necessary.

## Explicit non-goals (safety / scope)

- No autonomous outbound send (email, invites, third-party messaging).
- No access to personal email/calendar unless explicitly re-scoped by governance.
- No trading/broker execution.
