# JC-009 — Pause/Resume + Rate Governance

## Outcome

Operator can pause non-critical automation and apply quota-aware backoff without losing required queue state.

## Promotion State

- Current: SHADOW
- Promotion rule:
  - Requires JC-006 through JC-008 PASS first.

## Non-negotiables

- Pause never drops queued work.
- Resume provides deterministic catch-up summary.
- Quota pressure throttles low-priority workloads first.

## Deliverables

- Global pause/resume state.
- Priority-aware rate policy handler.

## Operator Loop Impact

- Prevents queue collapse and protects end-of-day digest completeness during incidents.

## Friction KPI Evidence

- Track unresolved triage count at EOD and time-to-recovery after pause/resume.

## Proof

- Pause blocks non-critical actions and records queue.
- Resume returns catch-up summary.
- Simulated quota pressure defers low-priority jobs.

## Proof Evidence (Executed)

- Date: 2026-02-20
- Proof Script: `scripts/ted-profile/proof_jc009.sh`
- Result: PASS
