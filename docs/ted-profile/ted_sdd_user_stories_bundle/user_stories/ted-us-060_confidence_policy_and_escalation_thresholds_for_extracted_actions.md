---
id: TED-US-060
title: Confidence policy and escalation thresholds for extracted actions
epic: EPIC-04
job_family: LED
priority: P1
release_target: Phase-1
persona: "Operator (Clint)"
status: Proposed
created: 2026-02-20
---

## User story

As **Operator (Clint)**, I want **confidence-scored extraction outcomes to follow explicit thresholds** so that **uncertain items are escalated instead of silently applied.**

## Acceptance criteria

- [ ] Extracted items include confidence scores and source references.
- [ ] Actions below configured confidence threshold are surfaced as questions for operator confirmation.
- [ ] Threshold-based decisions (auto-internal task vs escalate) are logged with policy reason codes.

## Notes / constraints

- Confidence thresholds must not bypass approval-first requirements for risky writes.

## Explicit non-goals (safety / scope)

- No autonomous outbound send (email, invites, third-party messaging).
- No access to personal email/calendar unless explicitly re-scoped by governance.
- No trading/broker execution.
