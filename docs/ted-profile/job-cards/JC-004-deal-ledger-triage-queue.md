# JC-004 — Deal Ledger + Triage Queue (Governed System of Record)

## Outcome

Ted Engine maintains a canonical, auditable system of record for:

- Deals (deal_id, metadata, file structure pointers)
- Triage queue for any item that cannot be linked to a deal_id/task_id

This enables later workflows (filing, deadlines, dashboards) to be governed and explainable.

## Promotion State

- Current: PREVIEW
- Promotion rule: promote to GA only after linkage-or-triage behavior and pattern controls remain deterministic under proof gates.

## Non-negotiables

- Every sidecar action that produces an artifact must link to deal_id or task_id, or go to triage.
- No silent auto-linking at first; learning comes later behind approval.
- Fail-closed: if linkage cannot be asserted, it must be triaged.
- Audit log entries for create/update/link actions.

## Deliverables (Increment 1)

- Storage:
  - deals ledger file(s): sidecars/ted-engine/artifacts/deals/<deal_id>.json
  - triage ledger: sidecars/ted-engine/artifacts/triage/triage.jsonl (append-only)
- Endpoints:
  - POST /deals/create
  - GET /deals/:deal_id
  - GET /deals/list
  - GET /triage/list
  - POST /triage/:item_id/link (link to deal_id/task_id)
- Doctor surface: reports deal/triage counts

## Proof (Increment 1)

- Create a deal -> deal file exists -> GET returns it
- Add a triage item (unlinked) -> appears in triage list
- Link triage item to deal_id -> removed from triage list and recorded in audit trail

---

## Proof Evidence (Increment 1 — Deals + Triage + Link)

- Date: 2026-02-18
- Proof Script: scripts/ted-profile/proof_jc004.sh
- Result: PASS

### What was proven

- Deal ledger storage created under artifacts/deals/<deal_id>.json
- Endpoints function:
  - POST /deals/create (slug-safe validation; 409 on existing)
  - GET /deals/:deal_id
  - GET /deals/list
  - GET /triage/list (open items only)
  - POST /triage/:item_id/link (requires deal_id or task_id; append-only resolution)
- Triage uses append-only JSONL with audit entries (create/link) and resolved items no longer appear in open list
- Doctor/status surfaces report deals_count and triage_open_count

### Notes

- sidecars/ted-engine/artifacts/ is runtime data and is intentionally ignored by git.

---

## Proof Evidence (Increment 2 — Triage ingest endpoint)

- Date: 2026-02-18
- Proof Script: scripts/ted-profile/proof_jc004.sh
- Result: PASS

### What was proven (2)

- POST /triage/ingest accepts:
  - item_id (slug-safe), source_type, source_ref, summary
  - optional suggested_deal_id / suggested_task_id
- Fail-closed validation:
  - 400 on invalid/missing fields
  - 409 ALREADY_EXISTS when item_id already OPEN
- Append-only ledger:
  - triage_item record written to triage.jsonl
  - audit record written (TRIAGE_INGEST)
- Proof harness confirms endpoint returns 201 and JC-004 flow still passes end-to-end.

### Notes (2)

- docs/ted-profile/planning/ is local scratch and intentionally not committed in this increment.

---

## Proof Evidence (Increment 3 — Pattern learning scaffold)

- Date: 2026-02-18
- Proof Script: scripts/ted-profile/proof_jc004.sh
- Result: PASS

### What was proven (3)

- Append-only patterns event ledger created (patterns.jsonl) with:
  - pattern_proposed and pattern_approved events
- Endpoints function and are approval-gated:
  - GET /triage/patterns returns { active, proposed } via event replay
  - POST /triage/patterns/propose validates inputs and returns pattern_id
  - POST /triage/patterns/:pattern_id/approve requires approved_by and proposed existence
- No auto-linking behavior was introduced in this increment.

### Notes (3)

- docs/ted-profile/planning/ remains local scratch and is intentionally not committed.

---

## Proof Evidence (Increment 4 — Apply active patterns as suggestions on ingest)

- Date: 2026-02-18
- Proof Script: scripts/ted-profile/proof_jc004.sh
- Result: PASS

### What was proven (4)

- POST /triage/ingest now evaluates ACTIVE patterns and applies suggestions (no auto-link):
  - For SENDER_DOMAIN_TO_DEAL, extracts domain from source_ref (e.g., from:someone@example.com)
  - Case-insensitive match against pattern.match.domain
  - Sets suggested_deal_id from pattern.suggest.deal_id when matched
- Suggested fields are persisted on the triage_item record (append-only JSONL)
- /triage/list surfaces suggestion fields when present
- /triage/ingest response may include suggestion fields (useful for operators and proofs)
- Items remain OPEN until explicitly linked via /triage/:item_id/link (governance preserved)

### Notes (4)

- docs/ted-profile/planning/ remains local scratch and intentionally not committed.
