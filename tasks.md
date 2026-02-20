# Tasks — OpenClaw Ted Profile (Mac) + Ted Engine Sidecar

Gates for all work:

- docs/ted-profile/sdd-pack/09_TEST_AND_RELEASE_GATES.md
- docs/ted-profile/sdd-pack/14_DAY1_PROMOTION_POLICY.md
- docs/ted-profile/sdd-pack/15_VALUE_AND_FRICTION_GATES.md

Roadmap reference:

- docs/ted-profile/sdd-pack/10_ROADMAP_JOB_BOARD.md
- docs/ted-profile/ted_sdd_user_stories_bundle/EXECUTION_SLICE_048_061.md

## Recursive execution rule

For each job card increment:

1. Confirm spec + clarify alignment
2. Execute proof script
3. Run gates
4. Record evidence in job card
5. Set promotion state (`SHADOW`, `PREVIEW`, `GA`, `DEFERRED`)
6. Confirm increment improves the canonical operator loop
7. Record friction-budget KPI evidence in the job card

## Active Job Cards (execute in order)

- JC-001 — Sidecar Proof of Life (OpenClaw → Ted Engine /doctor)
  - File: docs/ted-profile/job-cards/JC-001-sidecar-proof-of-life.md

- JC-002 — macOS Auto-start (LaunchAgents for OpenClaw + Sidecar)
  - File: docs/ted-profile/job-cards/JC-002-macos-autostart-launchagents.md

- JC-003 — Draft-only Graph (2 profiles) — inbox read → draft create
  - File: docs/ted-profile/job-cards/JC-003-graph-draft-only-two-profiles.md

- JC-004 — Deal Ledger + Triage Queue (Governed system of record)
  - File: docs/ted-profile/job-cards/JC-004-deal-ledger-triage-queue.md

- JC-005 — Filing Suggestions Queue (approval-gated)
  - File: docs/ted-profile/job-cards/JC-005-filing-suggestions-queue.md

- JC-006 — Role cards + hard-bans + output contract
  - Source slice: docs/ted-profile/ted_sdd_user_stories_bundle/EXECUTION_SLICE_048_061.md

- JC-007 — Entity/provenance + cross-entity + audience clearance guards
  - Source slice: docs/ted-profile/ted_sdd_user_stories_bundle/EXECUTION_SLICE_048_061.md

- JC-008 — Escalation + confidence + contradiction controls
  - Source slice: docs/ted-profile/ted_sdd_user_stories_bundle/EXECUTION_SLICE_048_061.md

- JC-009 — Pause/resume + rate governance controls
  - Source slice: docs/ted-profile/ted_sdd_user_stories_bundle/EXECUTION_SLICE_048_061.md

- JC-010 — Deterministic learning + optional affinity routing
  - Source slice: docs/ted-profile/ted_sdd_user_stories_bundle/EXECUTION_SLICE_048_061.md

## Proof Scripts

- scripts/ted-profile/proof_jc001.sh
- scripts/ted-profile/proof_jc002.sh
- scripts/ted-profile/proof_jc003.sh
- scripts/ted-profile/proof_jc004.sh
- scripts/ted-profile/proof_jc005.sh
- scripts/ted-profile/proof_jc006.sh
- scripts/ted-profile/proof_jc007.sh
- scripts/ted-profile/proof_jc008.sh
- scripts/ted-profile/proof_jc009.sh
- scripts/ted-profile/proof_jc010.sh (planned)

## Mandatory Value/Friction Evidence (each increment)

- Operator-loop mapping:
  - morning brief, draft queue, approval/escalation, end-of-day digest impact
- Friction metrics snapshot:
  - manual handling minutes/day
  - approval queue oldest age
  - unresolved triage end-of-day count
  - explainability missing count
