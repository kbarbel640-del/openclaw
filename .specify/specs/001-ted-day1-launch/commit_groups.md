# Commit Groups by Spine Story

## Conventions

- Branch naming: `story/<spine-id>-<short-topic>`
- Commit format: `<area>: <change> (SPINE-XX, TED-US-###[, TED-US-###])`
- Keep each group independently reviewable and proofable.

## Group 1 - SPINE-01 Governance Baseline (GOV)

- Branch: `story/spine-01-governance-baseline`
- Scope:
  - `constitution.md`
  - `.specify/memory/constitution.md`
  - `.specify/templates/spec-template.md`
  - `.specify/templates/plan-template.md`
  - `.specify/templates/tasks-template.md`
  - `docs/ted-profile/sdd-pack/03_SCOPE_BOUNDARIES.md`
  - `docs/ted-profile/sdd-pack/12_RISK_REGISTER.md`
  - `docs/ted-profile/sdd-pack/13_OPEN_QUESTIONS.md`
  - `docs/ted-profile/planning/COUNCIL_FUNCTION_MAP.md`
- Message example:
  - `docs: tighten governance constraints and template gates (SPINE-01, TED-US-001, TED-US-002, TED-US-004, TED-US-005)`

## Group 2 - SPINE-02 Reliability, Plan, and Release Gates (MNT)

- Branch: `story/spine-02-ops-reliability`
- Scope:
  - `plan.md`
  - `tasks.md`
  - `gates_checklists.md`
  - `docs/ted-profile/sdd-pack/10_ROADMAP_JOB_BOARD.md`
  - `docs/ted-profile/sdd-pack/spec_index.json`
  - `docs/ted-profile/job-cards/JC-001-sidecar-proof-of-life.md`
  - `docs/ted-profile/job-cards/JC-002-macos-autostart-launchagents.md`
  - `docs/ted-profile/job-cards/JC-010-release-gates-evidence-pack.md`
  - `docs/ted-profile/planning/REQUIREMENTS_TRACEABILITY.md`
  - `docs/ted-profile/planning/COUNCIL_RUNBOOK.md`
- Message example:
  - `docs: align Day-1 reliability plan and release gate evidence (SPINE-02, TED-US-009, TED-US-010, TED-US-011, TED-US-012)`

## Group 3 - SPINE-03 Draft-First Graph Workflows (OUT)

- Branch: `story/spine-03-draft-first-graph`
- Scope:
  - `docs/ted-profile/sdd-pack/07_M365_GRAPH_SPEC.md`
  - `docs/ted-profile/job-cards/JC-003-graph-draft-only-two-profiles.md`
  - `spec.md` (Graph sections)
- Message example:
  - `docs: clarify draft-only Graph profile flows and proofs (SPINE-03, TED-US-003, TED-US-015, TED-US-016)`

## Group 4 - SPINE-04 Ledger and Daily Surface Foundation (LED)

- Branch: `story/spine-04-ledger-daily-surface`
- Scope:
  - `docs/ted-profile/job-cards/JC-004-deal-ledger-triage-queue.md`
  - `docs/ted-profile/job-cards/JC-008-dashboards-daily-view.md`
  - `spec.md` (ledger/day surface sections)
- Message example:
  - `docs: establish Day-1 ledger and daily surface contracts (SPINE-04, TED-US-006, TED-US-024, TED-US-026, TED-US-028)`

## Group 5 - SPINE-05 Approval-First Actions (LED)

- Branch: `story/spine-05-approval-actions`
- Scope:
  - `docs/ted-profile/job-cards/JC-005-filing-suggestions-queue.md`
  - `docs/ted-profile/job-cards/JC-007-deadlines-extraction-proposals.md`
  - `scripts/ted-profile/proof_jc005.sh`
  - `scripts/ted-profile/proof_jc005_inc2.sh`
- Message example:
  - `docs: enforce approval-first filing and deadline proposal progression (SPINE-05, TED-US-017, TED-US-022, TED-US-039)`

## Group 6 - SPINE-06 Connectors and Governed Learning (ING)

- Branch: `story/spine-06-connectors-learning`
- Scope:
  - `docs/ted-profile/job-cards/JC-009-patterns-governed-learning-expansion.md`
  - `docs/ted-profile/JobCatagories_sdd_pack/`
  - `docs/ted-profile/Knowledge-Pack_SDD/` (if connector-learning related normalization is included)
- Message example:
  - `docs: codify governed connector and pattern-learning expansion (SPINE-06, TED-US-034, TED-US-041, TED-US-042)`

## Group 7 - SPINE-07 Sidecar Boundary and Retention Governance (GOV)

- Branch: `story/spine-07-sidecar-retention`
- Scope:
  - `docs/integration/ted-sidecar-contract.md`
  - `extensions/ted-sidecar/AGENTS.md`
  - `docs/ted-profile/sdd-pack/08_OPENCLAW_SIDECAR_TOOLING_SPEC.md`
  - `docs/ted-profile/job-cards/JC-006-sidecar-auth-contract-reconciliation.md`
  - `docs/ted-profile/job-cards/JC-011-retention-purge-metrics.md`
  - `docs/ted-profile/ted_sdd_user_stories_bundle/user_stories/ted-us-046_loopback_sidecar_contract_with_authenticated_non_health_routes.md`
  - `docs/ted-profile/ted_sdd_user_stories_bundle/user_stories/ted-us-047_retention_purge_controls_with_auditable_lifecycle.md`
- Message example:
  - `docs: reconcile sidecar boundary contract and retention controls (SPINE-07, TED-US-046, TED-US-047)`

## Group 8 - Spine Packaging and Traceability

- Branch: `story/spine-packaging-traceability`
- Scope:
  - `.specify/specs/001-ted-day1-launch/story_traceability.md`
  - `.specify/specs/001-ted-day1-launch/story_coverage_matrix.md`
  - `.specify/specs/001-ted-day1-launch/capability_inventory.md`
  - `.specify/specs/001-ted-day1-launch/wip_to_story_map.md`
  - `.specify/specs/001-ted-day1-launch/commit_groups.md`
  - `.specify/specs/001-ted-day1-launch/wip_ledger.md`
- Message example:
  - `docs: add Day-1 capability/coverage and WIP execution maps (SPINE-01, SPINE-02, SPINE-07)`
