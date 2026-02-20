# JC-001 — Sidecar Proof of Life (OpenClaw → Ted Engine)

## Outcome

From OpenClaw chat, operator runs a Ted command that returns sidecar /doctor output.

## Promotion State

- Current: GA (foundation gate)
- Promotion rule: this card must remain PASS for all later slices.

## Why this is first

Proves the platform/sidecar boundary before we build any features (Graph, ledgers, filing, deadlines).

## Constraints

- Loopback only (127.0.0.1)
- Endpoint allowlist: /status and /doctor only (for this job)
- Fail closed on any violation
- No secrets in logs

## Proof

1. Start sidecar locally (loopback-only).
2. From OpenClaw chat run: /ted doctor
3. Response shows:
   - sidecar version
   - uptime
   - profiles_count
4. Attempting non-allowlisted call is blocked.

---

## Proof Evidence (Executed)

- Date: 2026-02-18
- Environment: macOS shell (user-space Node via nvm)
- Proof Script: scripts/ted-profile/proof_jc001.sh
- Result: PASS

### Observations

- /doctor and /status checks passed
- doctor/status payload keys verified
- non-allowlisted endpoint returned 404 (fail-closed behavior confirmed)

### Notes

- Node runtime required for sidecar (server.mjs). Installed via nvm (user-space).
