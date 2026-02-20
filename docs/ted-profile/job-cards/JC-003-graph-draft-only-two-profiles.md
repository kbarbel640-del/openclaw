# JC-003 — Draft-only Microsoft Graph (Two Profiles)

## Outcome

Ted Engine can (a) read limited email/calendar context and (b) create **drafts only** in Outlook for two separate M365 profiles (e.g., Olumie + Everest), while preserving strict governance and auditability.

## Promotion State

- Current: PREVIEW
- Promotion rule:
  - stays PREVIEW until tenant auth prerequisites are satisfied and full revoke/health proofs are stable
  - may move to GA only after deterministic PASS runs and zero governance regressions

## Canonical spec reference

- docs/ted-profile/sdd-pack/07_M365_GRAPH_SPEC.md

## Non-negotiables

- Draft-only: **no Send**, no external outreach, no autonomous meeting sends.
- Single operator: no multi-user/team workflows.
- No personal email/calendar control.
- Secrets policy: no plaintext secrets in repo/logs; use approved secret store approach.
- Fail-closed: if auth/health/policy checks fail → refuse execution.
- Observability: auditable actions + redacted logs.

## Scope (Phase 1)

- Two profiles selectable by `profile_id` (no manual “context switching” in chat; selection is explicit)
- Graph read (minimal) for:
  - mailbox scan for draft generation (metadata-first; body only when needed)
  - calendar read for briefing/conflict detection (no auto-send invites)
- Graph write (minimal) for:
  - create Outlook drafts only (never send)
- Setup UX:
  - an operator “graph setup” flow that stores auth material safely and validates scopes
  - a “revoke” flow to immediately disable access

## Out of scope (explicit)

- Any message sending
- Automatic calendar invite sends
- SharePoint/OneDrive broad write access unless separately approved by spec
- Any financial execution/trading actions

## Deliverables

1. Ted Engine endpoints (behind governance) for:
   - /graph/{profile_id}/status
   - /graph/{profile_id}/mail/list (minimal fields)
   - /graph/{profile_id}/mail/draft/create
   - /graph/{profile_id}/calendar/list (read-only)
2. Profile config model + setup command(s)
3. Audit logging for all Graph calls (redacted)
4. Doctor integration shows Graph connectivity per profile (healthy/degraded)
5. Device-code auth endpoints exist for per-profile bootstrap/revoke:
   - POST /graph/{profile_id}/auth/device/start
   - POST /graph/{profile_id}/auth/device/poll
   - POST /graph/{profile_id}/auth/revoke

## Proof (must pass)

- Setup both profiles successfully
- Create an Outlook draft via Ted workflow (verify draft exists in Drafts)
- Confirm no send capability exists (by scope + code path)
- Confirm calendar is not modified without explicit approval flow
- Confirm tokens/secret material are not stored in plaintext
- Confirm revoke works (subsequent calls fail closed)

---

## Proof Evidence (Increment 1 — Profile config + /status endpoint)

- Date: 2026-02-18
- Proof Script: scripts/ted-profile/proof_jc003.sh
- Result: PASS

### What was proven

- Two profiles are addressable by profile_id (olumie, everest)
- No-secret config template exists (graph.profiles.example.json)
- Runtime config is ignored (graph.profiles.json)
- Sidecar exposes /graph/:profile_id/status with fail-closed DISCONNECTED auth_state
- Proof harness validates schema and exits successfully

### Notes

- Auth is intentionally not implemented yet (next_action: RUN_DEVICE_CODE_AUTH)

---

## Proof Evidence — Increment 2 (Auth + Secure Store)

- Date: 2026-02-18
- Proof Script: scripts/ted-profile/proof_jc003.sh
- Result: PASS (after ensuring sidecar was running)

### What was proven (2)

- Sidecar health: /status and /doctor respond and are healthy
- Graph status endpoints exist per profile:
  - /graph/olumie/status schema checks pass
  - /graph/everest/status schema checks pass
- Device-code auth start endpoint exists and returns expected schema:
  - POST /graph/olumie/auth/device/start includes verification_uri, user_code, device_code, expires_in
- Sidecar-owned token scan gate passed (no plaintext token storage in sidecar repo surfaces)

### Notes / Follow-ups

- Improvement: update proof_jc003.sh to start/stop the sidecar automatically so proof is fully deterministic.
- Device polling + real tenant consent is intentionally not required for this proof increment.

---

## Proof Evidence (Increment 3 — Draft-only email draft creation endpoint)

- Date: 2026-02-18
- Proof Script: scripts/ted-profile/proof_jc003.sh
- Result: PASS

### What was proven (3)

- Sidecar exposes POST /graph/:profile_id/mail/draft/create
- Validates payload (subject + at least one recipient)
- Enforces draft-only behavior (Graph create draft via /me/messages; no send path)
- Fail-closed when not authenticated:
  - Returns 409 NOT_AUTHENTICATED with next_action RUN_DEVICE_CODE_AUTH
- Status reflects CONNECTED/DISCONNECTED without leaking tokens
- Sidecar-only token scan gate passes (no plaintext secret material in sidecars)

### Notes (2)

- Proof intentionally verifies fail-closed behavior without requiring live tenant auth.

---

## Real-World Proof Attempt (Device-code) — BLOCKED by Tenant Identity Prerequisite

- Date: 2026-02-18
- Step attempted: Complete device-code auth for Olumie profile
- Result: BLOCKED (expected non-code dependency)

### Observed error (summary)

Selected user account does not exist in tenant and cannot access the application in that tenant.
Account must be added as an external user (guest) or a tenant user must be used.

### Interpretation (SDD)

This is not a defect in sidecar auth flow. It is a tenant onboarding prerequisite:

- A user principal completing device-code auth must exist in the target Entra tenant and be authorized to access the app.

### Next action

- Use an Olumie tenant user to complete auth (preferred), OR
- Invite the operator as a B2B guest and ensure mailbox/calendar access is valid for the intended workflows.

---

## Proof Evidence (Increment 4 — Calendar read-only list endpoint)

- Date: 2026-02-18
- Proof Script: scripts/ted-profile/proof_jc003.sh
- Result: PASS

### What was proven (4)

- Sidecar exposes GET /graph/:profile_id/calendar/list?days=7
- When DISCONNECTED, endpoint fails closed with:
  - 409 NOT_AUTHENTICATED + next_action RUN_DEVICE_CODE_AUTH
- When CONNECTED, endpoint calls Graph calendarview read-only and returns minimal fields only:
  - id, subject, start, end, location
- No calendar writes/invites/sends were introduced.

### Notes (3)

- Proof currently validates the fail-closed behavior without requiring tenant auth.

---

## Proof Evidence (Increment 5 — Auth failure diagnostics classifier)

- Date: 2026-02-18
- Proof Script: scripts/ted-profile/proof_jc003.sh
- Result: PASS

### What was proven (5)

- Sidecar exposes POST /graph/diagnostics/classify
- Classifier returns stable categories and next-actions for common blockers:
  - USER_NOT_IN_TENANT
  - CONDITIONAL_ACCESS_BLOCK
  - AUTH_PENDING
  - MISSING_SCOPES
  - TOKEN_EXPIRED_OR_REVOKED
  - UNKNOWN
- No secrets are processed or logged; this is pure text classification.
- Proof harness validates classifier behavior end-to-end.

### Notes (4)

This endpoint converts real-world tenant/auth failures into admin-ready guidance while keeping the system fail-closed.
