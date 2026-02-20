---
id: TED-US-050
title: Role escalation protocol to approval surface
epic: EPIC-09
job_family: GOV
priority: P0
release_target: Phase-1
persona: "Operator (Clint)"
status: Proposed
created: 2026-02-20
---

## User story

As **Operator (Clint)**, I want **role escalation triggers to route proposals into the approval surface with clear reason codes** so that **high-risk and ambiguous work is reviewed deliberately.**

## Acceptance criteria

- [ ] Role cards can declare escalation triggers (risk tier, missing evidence, numeric claim uncertainty, policy ambiguity).
- [ ] Escalated actions are routed to approval queue with proposal, rationale, and required decision.
- [ ] No escalated action executes unless explicitly approved; rejected actions remain auditable.

## Notes / constraints

- Escalation is a control path, not a fallback for bypassing policy.

## Explicit non-goals (safety / scope)

- No autonomous outbound send (email, invites, third-party messaging).
- No access to personal email/calendar unless explicitly re-scoped by governance.
- No trading/broker execution.
