---
id: TED-NFR
title: Non-Functional Requirements (global)
created: 2026-02-19
status: Proposed
---

## Security & privacy

- Secrets are never stored in plaintext files; use keychain/vault references.
- Fail-closed: if auth, policy, or audit logging fails, execution stops.
- Draft-only outbound: no email send, no invite send, no third-party outreach.
- Governance checks are deterministic controls; AI suggestions never bypass policy gates.

## Auditability

- All material actions are logged with redaction before persistence.
- Audit records include operation id, actor/profile, and linkage metadata when available.
- Post-delivery learning requires explicit promotion; no silent behavior changes.

## Reliability & operability

- Auto-start on boot; service survives restarts.
- Doctor report available locally to diagnose issues and provide fix paths.

## Compliance / licensing

- Connectors to premium sources require license/approval metadata and allowed-operations declarations.
- Research outputs enforce source-tier rules and include citations.

## Performance

- Daily brief and digest generation completes within the agreed SLA window when configured.
- Inbox scans and connector pulls are bounded and rate-limited; no runaway loops.
