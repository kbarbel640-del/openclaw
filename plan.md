# Roadmap & Job Board — OpenClaw Ted Profile (Mac)

**Generated:** 2026-02-17

This is the implementation backlog expressed as **job cards** (proof-based).

Legend:
- Status: `TODO` | `IN_PROGRESS` | `DONE` | `BLOCKED`
- Each job must record: proof commands + evidence (CI run, logs, screenshots).

---

## EPIC 0 — Baseline Alignment

### OC0.1 — Confirm Baseline Decision (OpenClaw + Sidecar)
- Status: DONE
- Goal: Lock in architecture choice so we don't rebuild the wrong baseline.
- DoD:
  - Spec pack adopted (this pack becomes source of truth).
  - Repo skeleton matches architecture.
- Proof:
  - Architecture review sign-off in `11_DECISION_LOG.md`.

---

## EPIC 1 — Mac Installer + Auto-Start

### OC1.1 — Build macOS installers (arm64 + intel)
- Status: TODO
- Goal: Produce installable DMGs for both architectures.
- DoD:
  - CI produces two artifacts per release.
- Proof:
  - Download artifacts; verify `.app` bundles open.

### OC1.2 — Auto-start on login/reboot (LaunchAgent)
- Status: TODO
- Goal: Services survive restarts.
- DoD:
  - After reboot, OpenClaw + Ted Engine are running without manual intervention.
- Proof:
  - Reboot test evidence (doctor/status OK).

---

## EPIC 2 — Ted Profile Security Hardening

### OC2.1 — Keychain-first secret store (no secrets in files)
- Status: TODO
- Goal: Secrets/tokens never stored in plaintext config/state.
- DoD:
  - secret scan passes; deep security audit GREEN.
- Proof:
  - security audit output; grep/sanity checks.

### OC2.2 — Deny-by-default plugins/tools; allowlists
- Status: TODO
- Goal: Reduce blast radius.
- DoD:
  - tool allowlist and endpoint allowlist in place.
- Proof:
  - attempts to call non-allowlisted endpoint fail.

---

## EPIC 3 — Sidecar Tooling (OpenClaw → Ted Engine)

### OC3.1 — Implement `ted-sidecar` tool wrapper
- Status: TODO
- Goal: OpenClaw can safely call Ted Engine over loopback.
- DoD:
  - allowlist enforced; token mint works; per-call profile selection works.
- Proof:
  - unit test for loopback restriction + allowlist.

### OC3.2 — Chat-first UX for “draft email” and “daily brief”
- Status: TODO
- Goal: Operator can run core workflows from chat.
- DoD:
  - tool invoked from chat; result shown; drafts created.
- Proof:
  - integration test + manual proof.

---

## EPIC 4 — M365 Draft-Only Workflows (Phase 1)

### OC4.1 — Graph profile setup (two profiles)
- Status: TODO
- Goal: Configure two tenants.
- DoD:
  - device-code sign-in works for both; token cache in Keychain.
- Proof:
  - doctor shows Graph ready for both profiles.

### OC4.2 — Read inbox → create drafts
- Status: TODO
- Goal: Primary success metric.
- DoD:
  - system creates drafts in Outlook Drafts, never sends.
- Proof:
  - integration tests; screenshots optional.

### OC4.3 — Calendar tentative holds (proposal → approve → apply)
- Status: TODO
- Goal: Draft-only scheduling assistance.
- DoD:
  - propose holds; requires approval; applies draft holds.
- Proof:
  - approval gate proof; calendar entry visible.

---

## EPIC 5 — Release & Supportability

### OC5.1 — Doctor/setup wizard parity for Ted Profile
- Status: TODO
- Goal: Non-engineer can self-diagnose.
- DoD:
  - doctor highlights missing configs; links to fix.
- Proof:
  - screenshot + test.

### OC5.2 — Release checklist + rollback procedure
- Status: TODO
- Goal: predictable shipping.
- DoD:
  - release docs + CI gates.
- Proof:
  - checklist used for a release.

