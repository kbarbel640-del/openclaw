---
id: TED-US-048
title: Role cards with governed domain IO done bans and escalation
epic: EPIC-09
job_family: GOV
priority: P0
release_target: Day-1
persona: "Operator (Clint)"
status: Proposed
created: 2026-02-20
---

## User story

As **Operator (Clint)**, I want **each role/skill to have an explicit role card (domain, inputs/outputs, definition of done, hard bans, escalation triggers)** so that **specialized behavior is consistent and auditable instead of ad hoc.**

## Acceptance criteria

- [ ] Every enabled role/skill references a role card with required sections: `domain`, `inputs`, `outputs`, `definition_of_done`, `hard_bans`, `escalation`.
- [ ] Invalid or incomplete role cards fail closed and are rejected before activation.
- [ ] Role card changes are versioned and auditable with actor, timestamp, and diff summary.

## Notes / constraints

- Role cards constrain behavior space; they are governance artifacts, not marketing personas.

## Explicit non-goals (safety / scope)

- No autonomous outbound send (email, invites, third-party messaging).
- No access to personal email/calendar unless explicitly re-scoped by governance.
- No trading/broker execution.
