---
id: TED-US-049
title: Hard-bans policy enforcement with fail-closed execution
epic: EPIC-09
job_family: GOV
priority: P0
release_target: Day-1
persona: "Operator (Clint)"
status: Proposed
created: 2026-02-20
---

## User story

As **Operator (Clint)**, I want **hard bans to be enforceable policy rules (not prompt suggestions)** so that **risky behavior is blocked reliably before execution.**

## Acceptance criteria

- [ ] Every role card hard ban is checked in policy before tool or external action execution.
- [ ] Violations fail closed with a safe next-step response and auditable redacted event.
- [ ] Day-1 banned actions include direct send/invite/share and any unapproved risky write paths.

## Notes / constraints

- Bans are written from worst-case failure modes and mapped to policy checks.

## Explicit non-goals (safety / scope)

- No autonomous outbound send (email, invites, third-party messaging).
- No access to personal email/calendar unless explicitly re-scoped by governance.
- No trading/broker execution.
