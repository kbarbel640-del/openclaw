# OpenClaw Ted Profile — Spec-Driven Development Pack

**Generated:** 2026-02-17  
**Purpose:** Provide a _project-ingestable_ spec pack to build a Mac-first OpenClaw fork ("Ted Profile") with a draft-only, auditable Microsoft Graph workflow and governed add-ons.

---

## How to Use This Pack

1. **Read `01_CONTEXT_PRIMER.md` first**  
   It captures the stable job-to-be-done, non‑negotiables, and day‑1 definition of done.

2. **Treat everything else as implementation guidance**  
   Many technical details in the source emails/docs are _user narrative_ and can evolve. This pack intentionally focuses on the _job_ and the _safety boundaries_.

3. **Implement as Epics + Job Cards**
   - Use `10_ROADMAP_JOB_BOARD.md` as the backlog spine.
   - Every job card includes _Proof_ steps (deterministic commands/tests) and a _Definition of Done_.

---

## What This Pack Produces

- A **clear baseline decision**: OpenClaw is the platform baseline; Ted Engine is a localhost sidecar.
- A **Mac installer specification** (auto-start, upgrades, rollback).
- A **security/governance spec** (Keychain-first, deny-by-default, approvals, audit).
- A **Graph draft-only spec** (two tenant profiles, least privilege).
- A **tooling spec** for OpenClaw → Ted Engine calls over loopback.

---

## File Index

| File                                        | What it is                                            |
| ------------------------------------------- | ----------------------------------------------------- |
| `01_CONTEXT_PRIMER.md`                      | One-page stable scope + non-negotiables               |
| `02_PRODUCT_BRIEF.md`                       | JTBD, user journeys, success metrics                  |
| `03_SCOPE_BOUNDARIES.md`                    | In-scope / out-of-scope / assumptions                 |
| `04_ARCHITECTURE.md`                        | Sidecar architecture + component contracts            |
| `05_SECURITY_GOVERNANCE.md`                 | Threat model + controls + approval gates              |
| `06_MAC_INSTALLER_SPEC.md`                  | Mac packaging, auto-start, upgrade, uninstall         |
| `07_M365_GRAPH_SPEC.md`                     | Identity profiles + scopes + draft-only workflows     |
| `08_OPENCLAW_SIDECAR_TOOLING_SPEC.md`       | Tool allowlist + endpoints + streaming                |
| `09_TEST_AND_RELEASE_GATES.md`              | QA gates + release checklist + proofs                 |
| `10_ROADMAP_JOB_BOARD.md`                   | Backlog epics + job cards (proof-based)               |
| `11_DECISION_LOG.md`                        | Record of key decisions and why                       |
| `12_RISK_REGISTER.md`                       | Risks + mitigations + monitoring                      |
| `13_OPEN_QUESTIONS.md`                      | Resolved build defaults + override policy             |
| `14_DAY1_PROMOTION_POLICY.md`               | Promotion states and recursive SDD loop               |
| `15_VALUE_AND_FRICTION_GATES.md`            | Operator-loop value and friction KPI gates            |
| `16_COUNCIL_EXPANSION_AND_COWORK_REVIEW.md` | Expanded council seats + mandatory interrogation pass |
| `APPENDIX_SOURCES.md`                       | Source docs list (for traceability)                   |
| `spec_index.json`                           | Machine-readable index of specs                       |

---

## Design Principles (Non-negotiable)

- **Draft-only by default**: never send emails or meeting invites without explicit human action.
- **Single-operator**: only the configured operator can use the system.
- **Keychain-first secrets**: no secrets or refresh tokens in plaintext files.
- **Fail-closed**: if auth/audit/policy/secret resolution fails, stop execution.
- **Full auditability**: log what happened and why (redacted).
