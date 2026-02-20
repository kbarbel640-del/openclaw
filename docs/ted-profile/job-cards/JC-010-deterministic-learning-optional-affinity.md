# JC-010 — Deterministic Learning + Optional Affinity Routing

## Outcome

Growth and learning modifiers are deterministic and auditable, while affinity remains optional and cannot override governance.

## Promotion State

- Current: SHADOW
- Promotion rule:
  - Requires JC-006 through JC-009 PASS first.

## Non-negotiables

- No silent behavior drift.
- All learned modifiers are explainable and reversible.
- Affinity signal never overrides policy, hard bans, or approvals.

## Deliverables

- Deterministic modifier engine.
- Optional affinity signal (guarded and non-authoritative).

## Operator Loop Impact

- Improves next-day brief and draft quality without introducing silent behavior drift.

## Friction KPI Evidence

- Track whether modifier changes reduce manual edits while keeping explainability complete.

## Proof

- Same inputs produce same modifiers.
- Modifier changes include reason + source evidence.
- Affinity can influence ordering only; no policy bypass.

## Proof Evidence (Executed)

- Date: 2026-02-20
- Proof Script: `scripts/ted-profile/proof_jc010.sh`
- Result: PASS
