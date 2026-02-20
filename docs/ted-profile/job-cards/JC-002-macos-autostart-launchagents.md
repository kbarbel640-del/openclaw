# JC-002 — macOS Auto-start (LaunchAgents for OpenClaw + Sidecar)

## Outcome

After a Mac reboot, OpenClaw and the Ted Engine sidecar are both running and healthy without manual steps.

## Promotion State

- Current: GA (foundation gate)
- Promotion rule: reboot/autostart proof must remain PASS before any PREVIEW/GA expansion.

## Why this is next

We have proven the OpenClaw ↔ sidecar seam (JC-001). Now we must make the runtime reliable before adding Graph and workflow features.

## Constraints

- No admin/root required for default install (prefer user LaunchAgents)
- Sidecar binds loopback only (127.0.0.1)
- Fail closed: if sidecar isn't healthy, OpenClaw shows degraded state and blocks Ted actions
- Logs exist and do not contain secrets

## Decision

Use the existing OpenClaw gateway daemon/launchd framework as the single orchestrator.

- One LaunchAgent stack (gateway) manages startup/shutdown lifecycle.
- Ted Engine sidecar is a managed subprocess started/stopped by gateway runtime.
- Do not create a second direct node LaunchAgent for sidecar.

## Deliverables

- Gateway-managed ted-engine subprocess wiring (startup + shutdown)
- Doctor/service health integration for sidecar `/status` and `/doctor`
- Install/uninstall scripts under scripts/ted-profile/
- Health check command(s)

## Proof

1. Non-reboot proof (`bash scripts/ted-profile/proof_jc002.sh`):
   - install/start gateway via existing CLI pathways
   - verify sidecar healthy (`/status`, `/doctor`)
   - verify OpenClaw command path check for ted sidecar health
   - verify non-allowlisted endpoint remains blocked (fail closed)
2. Manual reboot proof:
   - install autostart (`bash scripts/ted-profile/jc002_install_autostart.sh`)
   - reboot Mac
3. Verify both processes running after reboot:
   - sidecar responds to /doctor and /status
   - OpenClaw can execute /ted doctor successfully
4. Verify logs written to expected paths (`sidecars/ted-engine/logs/`) with no secrets
5. Verify uninstall removes/disables autostart (`bash scripts/ted-profile/jc002_uninstall_autostart.sh`)

---

## Proof Evidence (Executed)

- Date: 2026-02-18
- Proof Script: scripts/ted-profile/proof_jc002.sh
- Result: PASS

### Observations

- Control UI assets built successfully via `pnpm ui:build` (no build artifacts committed)
- Sidecar health verified via /status and /doctor
- Payload schema keys verified
- Non-allowlisted endpoint remains blocked (fail-closed)
- Doctor command path reflects Ted sidecar health

### Notes

- `pnpm ui:build` required Node in shell; used nvm Node to avoid broken corepack shim.
