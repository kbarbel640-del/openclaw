---
id: TED-US-052
title: Relationship affinity routing as a bounded internal signal
epic: EPIC-09
job_family: GOV
priority: P2
release_target: Phase-2
persona: "Operator (Clint)"
status: Proposed
created: 2026-02-20
---

## User story

As **Operator (Clint)**, I want **affinity-style relationship signals to influence internal role routing only** so that **collaboration patterns can improve while governance controls remain dominant.**

## Acceptance criteria

- [ ] Affinity/routing signals are bounded and cannot override policy gates, hard bans, or approval requirements.
- [ ] Affinity drift is rate-limited and auditable with reason metadata.
- [ ] Routing signal behavior can be disabled globally without breaking core workflows.

## Notes / constraints

- This is optional optimization and should not be treated as Day-1 requirement.

## Explicit non-goals (safety / scope)

- No autonomous outbound send (email, invites, third-party messaging).
- No access to personal email/calendar unless explicitly re-scoped by governance.
- No trading/broker execution.
