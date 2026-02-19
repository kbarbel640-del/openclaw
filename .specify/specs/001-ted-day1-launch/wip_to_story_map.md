# WIP to Story Map

## Source Snapshot

Based on `git status --short` in this repo at mapping time.

## Mapping Rules

- Map by functional intent first (governance, ops, ledgers, connectors, contract).
- If a file is meta-scaffolding across all stories, map to `SPINE-01` governance baseline unless there is a stronger fit.
- Large imported packs are grouped as ingestion artifacts and tagged Phase-1 planning unless they directly implement Day-1 spine behavior.

## Mapped WIP

| File or path                                                                | Story mapping      | Rationale                                                        |
| --------------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------- |
| `.specify/specs/001-ted-day1-launch/spec.md`                                | SPINE-01..SPINE-07 | Cohesive Day-1 spine definition.                                 |
| `.specify/specs/001-ted-day1-launch/story_traceability.md`                  | SPINE-01..SPINE-07 | Crosswalk from spine to detailed stories.                        |
| `.specify/specs/001-ted-day1-launch/story_coverage_matrix.md`               | SPINE-01..SPINE-07 | Coverage audit across Day-1/Phase-1 capability sets.             |
| `.specify/specs/001-ted-day1-launch/capability_inventory.md`                | SPINE-07           | Sidecar/API reality baseline and contract drift signal.          |
| `.specify/templates/spec-template.md`                                       | SPINE-01           | Governance-aligned spec gate propagation.                        |
| `.specify/templates/plan-template.md`                                       | SPINE-01           | Governance-aligned plan gate propagation.                        |
| `.specify/templates/tasks-template.md`                                      | SPINE-01           | Governance-aligned task/proof gate propagation.                  |
| `.specify/memory/constitution.md`                                           | SPINE-01           | Constitutional constraints and non-negotiables.                  |
| `constitution.md`                                                           | SPINE-01           | Root enforceable governance summary.                             |
| `spec.md`                                                                   | SPINE-01..SPINE-07 | Canonical front-door spec alignment.                             |
| `plan.md`                                                                   | SPINE-02           | Milestones and rollout sequencing.                               |
| `tasks.md`                                                                  | SPINE-02           | Execution checklist and dependency ordering.                     |
| `gates_checklists.md`                                                       | SPINE-02           | Release/proof gating definition.                                 |
| `plan-template.md`                                                          | SPINE-01           | Root template gate consistency.                                  |
| `spec-template.md`                                                          | SPINE-01           | Root template gate consistency.                                  |
| `tasks-template.md`                                                         | SPINE-01           | Root template gate consistency.                                  |
| `docs/integration/ted-sidecar-contract.md`                                  | SPINE-07           | Boundary contract, route stability, auth/reconciliation.         |
| `extensions/ted-sidecar/AGENTS.md`                                          | SPINE-07           | Extension boundary and policy guidance.                          |
| `docs/ted-profile/job-cards/JC-001-sidecar-proof-of-life.md`                | SPINE-02, SPINE-07 | Sidecar health/doctor proof.                                     |
| `docs/ted-profile/job-cards/JC-002-macos-autostart-launchagents.md`         | SPINE-02           | macOS autostart/operator recovery.                               |
| `docs/ted-profile/job-cards/JC-003-graph-draft-only-two-profiles.md`        | SPINE-03           | Draft-only Graph workflow.                                       |
| `docs/ted-profile/job-cards/JC-004-deal-ledger-triage-queue.md`             | SPINE-04           | Ledger/triage foundation.                                        |
| `docs/ted-profile/job-cards/JC-005-filing-suggestions-queue.md`             | SPINE-05           | Approval-first filing progression.                               |
| `docs/ted-profile/job-cards/JC-006-sidecar-auth-contract-reconciliation.md` | SPINE-07           | Contract/auth reconciliation.                                    |
| `docs/ted-profile/job-cards/JC-007-deadlines-extraction-proposals.md`       | SPINE-05           | Deadline proposal workflow shell.                                |
| `docs/ted-profile/job-cards/JC-008-dashboards-daily-view.md`                | SPINE-04           | Daily command center/dashboard surface.                          |
| `docs/ted-profile/job-cards/JC-009-patterns-governed-learning-expansion.md` | SPINE-06           | Governed learning/pattern expansion.                             |
| `docs/ted-profile/job-cards/JC-010-release-gates-evidence-pack.md`          | SPINE-02           | QA/release gate packaging.                                       |
| `docs/ted-profile/job-cards/JC-011-retention-purge-metrics.md`              | SPINE-07           | Retention lifecycle and purge proofs.                            |
| `scripts/ted-profile/proof_jc005.sh`                                        | SPINE-05           | Filing queue deterministic proof.                                |
| `scripts/ted-profile/proof_jc005_inc2.sh`                                   | SPINE-05           | Filing increment extension proof.                                |
| `docs/ted-profile/sdd-pack/03_SCOPE_BOUNDARIES.md`                          | SPINE-01           | Governance scope ceilings and non-goals.                         |
| `docs/ted-profile/sdd-pack/07_M365_GRAPH_SPEC.md`                           | SPINE-03           | Draft-only Graph guardrails.                                     |
| `docs/ted-profile/sdd-pack/08_OPENCLAW_SIDECAR_TOOLING_SPEC.md`             | SPINE-07           | Sidecar contract + tooling boundary.                             |
| `docs/ted-profile/sdd-pack/10_ROADMAP_JOB_BOARD.md`                         | SPINE-02           | Milestone and dependency board.                                  |
| `docs/ted-profile/sdd-pack/12_RISK_REGISTER.md`                             | SPINE-01           | Risk governance and mitigations.                                 |
| `docs/ted-profile/sdd-pack/13_OPEN_QUESTIONS.md`                            | SPINE-01, SPINE-07 | Decision backlog for unresolved constraints.                     |
| `docs/ted-profile/sdd-pack/spec_index.json`                                 | SPINE-02           | Canonical index alignment for execution.                         |
| `docs/ted-profile/planning/FEATURE_PLACEMENT_MAP.md`                        | SPINE-07           | Capability placement guardrails.                                 |
| `docs/ted-profile/planning/REQUIREMENTS_TRACEABILITY.md`                    | SPINE-02           | Requirements to job card/proof traceability.                     |
| `docs/ted-profile/planning/COUNCIL_FUNCTION_MAP.md`                         | SPINE-01           | Council roles/governance operating model.                        |
| `docs/ted-profile/planning/COUNCIL_RUNBOOK.md`                              | SPINE-02           | Execution protocol and checkpoints.                              |
| `docs/ted-profile/ted_sdd_user_stories_bundle/`                             | SPINE-01..SPINE-07 | Detailed backlog (includes TED-US-046 and TED-US-047 additions). |
| `docs/ted-profile/user_story_inventory.txt`                                 | SPINE-02           | Inventory support artifact for traceability.                     |
| `docs/ted-profile/Knowledge-Pack_SDD/`                                      | SPINE-02           | Ingested source modules and ingestion report context.            |
| `docs/ted-profile/JobCatagories_sdd_pack/`                                  | SPINE-06           | Job-category domain pack inputs (ingestion artifacts).           |
| `MERGE_REPORT.md`                                                           | SPINE-02           | Integration/reporting evidence.                                  |

## Items Needing Follow-up Mapping Precision

| Path                                            | Current mapping            | Follow-up                                                                           |
| ----------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------- |
| `docs/ted-profile/ted_sdd_user_stories_bundle/` | Broad SPINE-01..07 mapping | Split into per-epic commit groups before implementation commits.                    |
| `docs/ted-profile/Knowledge-Pack_SDD/`          | Ingestion context          | Confirm no duplicate canonical truths relative to `docs/ted-profile/sdd-pack/`.     |
| `docs/ted-profile/JobCatagories_sdd_pack/`      | SPINE-06 planning input    | Confirm whether this remains source-only or becomes normalized into canonical pack. |
