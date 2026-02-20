---
id: TED-US-054
title: Cross-entity output guardrails block by default
epic: EPIC-01
job_family: GOV
priority: P1
release_target: Phase-1
persona: "Operator (Clint)"
status: Proposed
created: 2026-02-20
---

## User story

As **Operator (Clint)**, I want **cross-entity data mixing blocked by default in drafts/reports** so that **audience outputs do not leak the wrong entity context.**

## Acceptance criteria

- [ ] When output audience/context is scoped to one entity, inclusion of other-entity data is blocked by default.
- [ ] Blocked output includes clear explanation and a list of offending objects for remediation.
- [ ] Explicit override (if enabled later) is auditable and approval-gated.

## Notes / constraints

- Day-1 behavior should prefer strict block over silent filtering when ambiguity exists.

## Explicit non-goals (safety / scope)

- No autonomous outbound send (email, invites, third-party messaging).
- No access to personal email/calendar unless explicitly re-scoped by governance.
- No trading/broker execution.
