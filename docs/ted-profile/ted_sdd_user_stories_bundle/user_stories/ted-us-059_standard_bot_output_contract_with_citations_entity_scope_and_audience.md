---
id: TED-US-059
title: Standard bot output contract with citations entity scope and audience
epic: EPIC-01
job_family: GOV
priority: P1
release_target: Phase-1
persona: "Operator (Clint)"
status: Proposed
created: 2026-02-20
---

## User story

As **Operator (Clint)**, I want **all bot outputs to follow a standard contract** so that **review quality, governance checks, and downstream automation remain consistent.**

## Acceptance criteria

- [ ] Every governed output includes: title, summary, recommended actions, open questions, citations, entity scope, and audience scope.
- [ ] Outputs missing required sections fail validation before delivery and are returned for correction.
- [ ] Output contract validation is auditable with reason codes on failures.

## Notes / constraints

- This is a schema and governance contract, not a visual formatting requirement.

## Explicit non-goals (safety / scope)

- No autonomous outbound send (email, invites, third-party messaging).
- No access to personal email/calendar unless explicitly re-scoped by governance.
- No trading/broker execution.
