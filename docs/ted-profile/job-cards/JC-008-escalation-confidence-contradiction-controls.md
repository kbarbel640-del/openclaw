# JC-008 — Escalation + Confidence + Contradiction Controls

## Outcome

Ted Engine enforces escalation for risky/low-confidence outputs and flags contradiction risks with source pointers.

## Promotion State

- Current: SHADOW
- Promotion rule:
  - Requires JC-006 and JC-007 PASS first.

## Non-negotiables

- Low-confidence extracted actions are surfaced as questions, not auto-applied.
- Contradiction risks must include citations.
- Approval-first behavior remains unchanged.

## Deliverables

- Confidence threshold policy evaluator.
- Escalation path router to approval surface.
- Contradiction detector interface for draft checks.

## Operator Loop Impact

- Improves approval/escalation step by surfacing conflicts and low-confidence items clearly.

## Friction KPI Evidence

- Track approval queue age change and low-confidence question resolution rate.

## Proof

- `<0.8` confidence produces question/escalation.
- Contradictory draft commitment is flagged with references.
- No bypass to autonomous external write.

## Proof Evidence (Executed)

- Date: 2026-02-20
- Proof Script: `scripts/ted-profile/proof_jc008.sh`
- Result: PASS
