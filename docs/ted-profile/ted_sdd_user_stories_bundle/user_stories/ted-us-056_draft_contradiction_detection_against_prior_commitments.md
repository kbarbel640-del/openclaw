---
id: TED-US-056
title: Draft contradiction detection against prior commitments
epic: EPIC-03
job_family: OUT
priority: P1
release_target: Phase-1
persona: "Operator (Clint)"
status: Proposed
created: 2026-02-20
---

## User story

As **Operator (Clint)**, I want **drafts checked for contradictions against prior commitments** so that **I avoid accidental inconsistencies in dates, pricing, and obligations.**

## Acceptance criteria

- [ ] When a draft includes commitments (date, price, obligation), prior context is checked for conflicts.
- [ ] Detected conflicts are flagged with citations to source records and a suggested resolution path.
- [ ] Conflict flags are included in review output before approval decision.

## Notes / constraints

- This is a review-time safety aid and should not auto-resolve commitments without operator approval.

## Explicit non-goals (safety / scope)

- No autonomous outbound send (email, invites, third-party messaging).
- No access to personal email/calendar unless explicitly re-scoped by governance.
- No trading/broker execution.
