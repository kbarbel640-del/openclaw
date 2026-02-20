# Plan — OpenClaw Ted Profile (Mac) + Ted Engine Sidecar

Canonical planning docs live in:

- Roadmap/job board: docs/ted-profile/sdd-pack/10_ROADMAP_JOB_BOARD.md
- Mac installer spec: docs/ted-profile/sdd-pack/06_MAC_INSTALLER_SPEC.md
- M365 Graph spec: docs/ted-profile/sdd-pack/07_M365_GRAPH_SPEC.md
- Sidecar tooling spec: docs/ted-profile/sdd-pack/08_OPENCLAW_SIDECAR_TOOLING_SPEC.md
- Day-1 promotion policy: docs/ted-profile/sdd-pack/14_DAY1_PROMOTION_POLICY.md

## Promotion model (required)

Every slice runs through recursive SDD phases:

1. spec/clarify update
2. task + job-card increment
3. deterministic proof script
4. gates + decision/risk updates
5. promotion decision (`SHADOW -> PREVIEW -> GA`)

## Current execution focus (dependency ordered)

1. Prove architecture seam (JC-001)
2. Lock Mac runtime (LaunchAgents + reboot survivability)
3. Enable Draft-only Graph (2 profiles) after seam is proven
4. Add ledgers (deal/triage/drafts/deadlines) behind governance
5. Execute `TED-US-048..061` in ordered slices:
   - Slice 1: role cards + hard bans + output contract
   - Slice 2: entity/provenance + cross-entity + audience redaction guards
   - Slice 3: escalation + contradiction + confidence policy
   - Slice 4: pause/resume + rate governance
   - Slice 5: deterministic learning + optional affinity routing

All phases must pass gates defined in:

- docs/ted-profile/sdd-pack/09_TEST_AND_RELEASE_GATES.md
