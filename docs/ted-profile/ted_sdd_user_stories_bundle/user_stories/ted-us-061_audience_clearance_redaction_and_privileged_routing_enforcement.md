---
id: TED-US-061
title: Audience clearance redaction and privileged routing enforcement
epic: EPIC-01
job_family: GOV
priority: P1
release_target: Phase-1
persona: "Operator (Clint)"
status: Proposed
created: 2026-02-20
---

## User story

As **Operator (Clint)**, I want **audience-based redaction and privileged-routing enforcement** so that **sensitive content is blocked or redacted when recipients are not cleared.**

## Acceptance criteria

- [ ] When sensitive categories are detected and audience clearance is insufficient, output is redacted or blocked by policy.
- [ ] Redaction report records category-level information without exposing redacted sensitive values.
- [ ] Privileged routing violations are blocked with auditable reason codes.

## Notes / constraints

- On uncertainty, policy chooses block-and-review over permissive delivery.

## Explicit non-goals (safety / scope)

- No autonomous outbound send (email, invites, third-party messaging).
- No access to personal email/calendar unless explicitly re-scoped by governance.
- No trading/broker execution.
