# JC-005 — Filing Suggestions Queue (Approval-gated)

## Outcome

Ted Engine can propose, list, and approve filing suggestions that are linked to deal context. No auto-filing; approvals are required.

## Promotion State

- Current: PREVIEW
- Promotion rule:
  - queue-only behavior may become GA once proof is stable and no execution side effects occur
  - any future apply/move execution requires a separate job card and starts at SHADOW/PREVIEW

This is the bridge between:

- triage ingest + deal linkage (JC-004)
  and
- draft-only Graph actions (JC-003) once tenant auth is available.

## Non-negotiables

- Suggestions are **not execution**. No moving emails/files without explicit approval and separate proof.
- Every suggestion must be tied to a deal_id or triage item (or fail closed).
- Append-only ledgers + audit entries.
- Fail-closed behavior when prerequisites are missing.

## Deliverables (Increment 1)

### Storage (append-only)

- sidecars/ted-engine/artifacts/filing/suggestions.jsonl

### Endpoints

- POST /filing/suggestions/propose
  Body: { source_type, source_ref, deal_id?, triage_item_id?, suggested_path, rationale? }
  Rules:
  - require (deal_id OR triage_item_id)
  - status = PROPOSED
- GET /filing/suggestions/list
  Returns open suggestions only by default
- POST /filing/suggestions/:suggestion_id/approve
  Body: { approved_by }
  Rules:
  - marks suggestion APPROVED (execution comes later)
  - writes audit entry

### Proof (Increment 1)

- Propose a suggestion -> appears in list with status PROPOSED
- Approve it -> status becomes APPROVED and audit recorded
- No execution side effects occur (no file moves, no Graph calls)

## Notes

Execution (apply/move) is a later increment and will require:

- explicit Graph/Files permissions
- new proofs + gates

---

## Proof Evidence (Increment 1 — Propose/List/Approve queue only)

- Date: 2026-02-18
- Proof Script: scripts/ted-profile/proof_jc005.sh
- Result: PASS

### What was proven

- Append-only filing suggestions ledger (suggestions.jsonl) with events:
  - filing_suggestion_proposed
  - filing_suggestion_approved
- Endpoints function and remain approval-gated (no execution):
  - POST /filing/suggestions/propose validates inputs and returns suggestion_id (PROPOSED)
  - GET /filing/suggestions/list replays events and defaults to open PROPOSED items
  - POST /filing/suggestions/:id/approve appends approval event and returns APPROVED
  - include_approved=true includes APPROVED items for audit/review
- Audit entries recorded for propose/approve actions
- No file moves and no Graph calls occur in this increment.

### Notes (2)

- docs/ted-profile/planning/ remains local scratch and intentionally not committed.
