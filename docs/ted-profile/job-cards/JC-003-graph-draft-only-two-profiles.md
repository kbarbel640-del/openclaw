# JC-003 — Draft-only Microsoft Graph (Two Profiles)

## Outcome

Ted Engine can (a) read limited email/calendar context and (b) create **drafts only** in Outlook for two separate M365 profiles (e.g., Olumie + Everest), while preserving strict governance and auditability.

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

## Proof (must pass)

- Setup both profiles successfully
- Create an Outlook draft via Ted workflow (verify draft exists in Drafts)
- Confirm no send capability exists (by scope + code path)
- Confirm calendar is not modified without explicit approval flow
- Confirm tokens/secret material are not stored in plaintext
- Confirm revoke works (subsequent calls fail closed)
