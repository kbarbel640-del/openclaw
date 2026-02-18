<!--
Sync Impact Report
- Version change: 0.0.0 -> 1.0.0
- Modified principles:
  - N/A (initial constitution ratification)
- Added sections:
  - Core Principles
  - Engineering Constraints
  - Delivery Workflow and Quality Gates
  - Governance
- Removed sections:
  - None
- Templates requiring updates:
  - updated: .specify/templates/plan-template.md
  - updated: .specify/templates/spec-template.md
  - updated: .specify/templates/tasks-template.md
  - pending: .specify/templates/commands/*.md (directory not present in this repository)
- Follow-up TODOs:
  - None
-->

# OpenClaw Constitution

## Core Principles

### I. Channel and Extension Parity (NON-NEGOTIABLE)

Changes to shared routing, onboarding, command gating, allowlists, or pairing MUST
consider all built-in channels and relevant extensions. A feature is not complete until
cross-channel impact is documented and unsupported channels are explicitly justified.
Rationale: OpenClaw is multi-channel by design; partial rollouts create silent regressions.

### II. Typed and Maintainable TypeScript

All production changes MUST preserve strict TypeScript guarantees. New `any`,
`@ts-nocheck`, and prototype mutation-based behavior sharing are prohibited unless a
maintainer grants explicit exception approval. Favor explicit composition or inheritance
and concise files over duplicative "V2" forks. Rationale: type-safe, explicit structure is
required for long-term maintainability in a fast-moving CLI and gateway codebase.

### III. Verification First for Behavior Changes

Behavioral changes MUST include targeted tests or a documented reason tests are not
applicable. Before handoff, contributors MUST run relevant quality gates (`pnpm test`
or targeted tests, plus required lint/type/build checks for touched areas) and report
results. Rationale: feature velocity is only sustainable when regressions are caught
before release.

### IV. Operator Safe UX and Terminal Output

CLI and status output MUST stay script-safe and operator-friendly: preserve stable table
or machine-readable output expectations, use shared terminal primitives, and avoid
breaking automation unless versioned and documented. Rationale: OpenClaw is operated
in terminals and automation; output drift is a breaking interface.

### V. Documentation and Release Discipline

User-visible behavior changes MUST update docs and release notes in the same delivery
stream, using repository doc-linking rules and user-facing changelog language only.
Security, publish, and release flows MUST follow documented runbooks without ad-hoc
shortcuts. Rationale: reliable operations require docs and release artifacts to match the
running software.

### VI. Ted Sidecar Boundary Discipline (NON-NEGOTIABLE)

Ted Sidecar is a **loopback HTTP service** (default `http://127.0.0.1:48080`) with optional
**autostart** via a Node child process and HTTP calls from OpenClaw.

Authoritative boundary sources (MUST read before planning/coding boundary changes):

- Extension wiring + spawn/allowlist + /ted gating:
  - `extensions/ted-sidecar/index.ts`
- Plugin config schema + defaults:
  - `extensions/ted-sidecar/openclaw.plugin.json`
- Doctor enforcement (loopback-only + probes):
  - `src/commands/doctor-gateway-services.ts`
- Sidecar server routes:
  - `sidecars/ted-engine/server.mjs`
- Boundary contract:
  - `docs/integration/ted-sidecar-contract.md`

Boundary discipline:

1. Loopback-only is required (baseUrl + server bind).
2. `/status` and `/doctor` are stability endpoints and MUST remain safe/predictable.
3. Unhealthy mode routing MUST remain allowlisted (health endpoints only).
4. Any boundary change MUST update the contract doc and include verification evidence in the PR.

Additional Sidecar contract rules:

- Contract surface: Only `/status` and `/doctor` are stable external contract endpoints. All other sidecar routes are internal unless explicitly promoted (contract doc + tests + release note).
- Health schema: `/status` and `/doctor` MUST continue to include required fields `version`, `uptime`, and `profiles_count` (additive fields allowed).
- Timeout policy: The plugin command path and doctor probes use different timeouts; any PR touching timeout behavior MUST include explicit rationale.
- PR evidence: PRs touching sidecar boundary MUST include file:line “Boundary Evidence” in the PR description and must update the contract doc when the boundary changes.

## Engineering Constraints

- Runtime baseline MUST remain Node 22+ while preserving Bun and Node execution paths.
- Dependency changes MUST avoid patched dependency churn unless explicitly approved.
- Secrets, real credentials, and live personal data MUST never be committed.
- Plugin runtime dependencies MUST live in each plugin's `dependencies`; core-only deps
  MUST stay out of extension runtime manifests.

## Delivery Workflow and Quality Gates

1. Work starts from a clear spec with prioritized user stories and measurable outcomes.
2. Implementation plans MUST pass Constitution Check gates before major coding starts.
3. Tasks MUST be organized for independently testable story increments (MVP first).
4. For code changes, run the smallest sufficient validation set first, then full required
   checks before merge.
5. Pull requests MUST call out cross-channel impact, docs/changelog updates, and any
   justified constitution exceptions.

## Governance

This constitution overrides conflicting local conventions for feature planning, delivery,
and release quality. Amendments require a reviewed pull request that includes:

1. the proposed constitutional diff,
2. a migration impact note for active templates/processes, and
3. an explicit semantic version bump decision.

Constitution versioning policy:

- MAJOR: incompatible governance changes or principle removals/redefinitions.
- MINOR: new principles/sections or materially expanded obligations.
- PATCH: clarifications, wording, or non-semantic refinements.

Compliance review is required at plan time (Constitution Check), during implementation
(task structure and validation evidence), and in pull request review.

**Version**: 1.2.0 | **Ratified**: 2026-02-17 | **Last Amended**: 2026-02-18
