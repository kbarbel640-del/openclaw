---
id: TED-US-058
title: Meeting summary and action capture with explicit exclusions
epic: EPIC-05
job_family: LED
priority: P1
release_target: Phase-2
persona: "Operator (Clint)"
status: Proposed
created: 2026-02-20
---

## User story

As **Operator (Clint)**, I want **meeting summaries and action capture with explicit exclusion controls** so that **follow-ups are captured while sensitive meetings stay out of automation.**

## Acceptance criteria

- [ ] Eligible meetings produce summary, action items, and linkage to deal/task context.
- [ ] Meetings marked excluded/sensitive are not processed by automation.
- [ ] Exclusions and generated outputs are auditable.

## Notes / constraints

- Exclusion controls should be easy to review and override intentionally.

## Explicit non-goals (safety / scope)

- No autonomous outbound send (email, invites, third-party messaging).
- No access to personal email/calendar unless explicitly re-scoped by governance.
- No trading/broker execution.
