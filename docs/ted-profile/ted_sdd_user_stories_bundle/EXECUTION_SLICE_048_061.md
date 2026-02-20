# Execution Slice: TED-US-048..061 (Dependency Ordered)

## SDD Method

- Proof-first sequencing.
- One coherent increment per job card.
- No promotion to next slice until prior slice proofs are PASS.
- Security/Governance stories gate feature stories.

## Ordered Slices

### Slice 1 (Foundation, must-pass first)

- Stories:
  - `TED-US-048` Role cards with governed domain/IO/DoD/bans/escalation
  - `TED-US-049` Hard-bans enforcement with fail-closed execution
  - `TED-US-059` Standard bot output contract
- Why first:
  - Establishes behavior contract and deterministic guardrails used by all later slices.
- Depends on:
  - Existing Day-1 governance baseline (`TED-US-001..005`, `TED-US-046`).
- Proposed job card:
  - `JC-006-role-cards-and-hard-bans.md`
- Proposed proof script:
  - `scripts/ted-profile/proof_jc006.sh`
- Proof checks:
  - Invalid role card rejected (fail-closed)
  - Hard-ban violation blocked and audited
  - Output schema validation enforced
  - `pnpm check:docs` and related governance gates PASS

### Slice 2 (Classification + leakage controls)

- Stories:
  - `TED-US-053` Entity tagging + provenance required
  - `TED-US-054` Cross-entity guardrails block-by-default
  - `TED-US-061` Audience-clearance redaction + privileged routing
- Why second:
  - Adds structural data isolation after role/policy foundation is stable.
- Depends on:
  - Slice 1 PASS.
- Proposed job card:
  - `JC-007-entity-provenance-and-cross-entity-guards.md`
- Proposed proof script:
  - `scripts/ted-profile/proof_jc007.sh`
- Proof checks:
  - Untagged objects blocked from downstream use
  - Cross-entity render blocked with offending object list
  - Redaction/block behavior enforced for non-cleared audience
  - Auditable reason codes emitted

### Slice 3 (Extraction quality and operator control)

- Stories:
  - `TED-US-050` Escalation protocol to approval surface
  - `TED-US-056` Contradiction detection for draft commitments
  - `TED-US-060` Confidence thresholds for extracted actions
- Why third:
  - Requires upstream policy and data-contract enforcement from Slices 1-2.
- Depends on:
  - Slice 2 PASS.
- Proposed job card:
  - `JC-008-escalation-confidence-and-contradiction-controls.md`
- Proposed proof script:
  - `scripts/ted-profile/proof_jc008.sh`
- Proof checks:
  - Escalated items routed to approval queue (no bypass)
  - Low-confidence items appear as questions, not auto-applied risky actions
  - Commitment conflicts flagged with citations
  - All paths remain draft-only/approval-first for risky writes

### Slice 4 (Ops resilience)

- Stories:
  - `TED-US-055` Global pause/resume with catch-up summary
  - `TED-US-057` Rate-limit budgeting and priority-aware backoff
- Why fourth:
  - Improves reliability once core behavior and policy are in place.
- Depends on:
  - Slice 3 PASS.
- Proposed job card:
  - `JC-009-ops-controls-pause-and-rate-governance.md`
- Proposed proof script:
  - `scripts/ted-profile/proof_jc009.sh`
- Proof checks:
  - Pause halts non-critical automation and preserves queue
  - Resume produces deterministic catch-up summary
  - Quota thresholds throttle low-priority jobs without dropping required actions

### Slice 5 (Growth loop, optional optimization)

- Stories:
  - `TED-US-051` Deterministic skill growth modifiers
  - `TED-US-058` Meeting summary/action capture with exclusions
  - `TED-US-052` Affinity routing as bounded internal signal (optional/Phase-2)
- Why fifth:
  - Adds learning/optimization only after governance and reliability controls are proven.
- Depends on:
  - Slice 4 PASS.
- Proposed job card:
  - `JC-010-governed-learning-and-optional-affinity.md`
- Proposed proof script:
  - `scripts/ted-profile/proof_jc010.sh`
- Proof checks:
  - Growth modifiers are deterministic, bounded, auditable, reversible
  - Excluded meetings are not processed
  - Affinity signal cannot override policy, hard bans, or approval requirements

## Stop-the-Line Criteria

- Any regression of:
  - draft-only boundary
  - approval-first risky write controls
  - cross-entity or audience clearance protection
  - audit/redaction guarantees
- Any proof script nondeterminism for implemented increment.

## Gate Commands (each slice)

- `pnpm check:docs`
- Slice-specific proof script (`proof_jc00X.sh`)
- Existing release-gate checks from `docs/ted-profile/sdd-pack/09_TEST_AND_RELEASE_GATES.md`
