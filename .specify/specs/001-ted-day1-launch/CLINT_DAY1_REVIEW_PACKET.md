# Clint Feature & Unlock Review Packet

_Generated: 2026-02-20_

## The Big Picture

Ted is being built as a full operations platform, not a single feature bot.
Day-1 delivers controlled value immediately, and additional capabilities unlock only when quality and governance gates are met.

This means you get:

- fast value now (drafts, daily ops, deal support)
- no unsafe automation surprises
- a clear path to full feature depth

## Full Feature Set (What the Platform Is Designed to Include)

### 1) Governance and Safety Core

- Single-operator security model
- Draft-only default for outbound actions
- Approval-first risky writes
- Entity separation and provenance controls
- Redaction and privileged-routing enforcement
- Full audit/event trace and retention policy
- Emergency pause/resume controls

### 2) Communications and Scheduling

- Inbox prioritization and draft generation
- Draft queue and approval flow
- Calendar digest and conflict detection
- Deadline extraction and follow-up proposals
- Tentative hold workflows (approval-gated before any apply)
- Mobile approval actions (as promoted)

### 3) DealOps and Work Management

- Deal ledger and phase/state tracking
- Triage queue and evidence linkage
- Filing suggestions and governed approval workflow
- Task surface and daily action plans
- Deal summaries, agendas, and follow-up packets

### 4) Legal Workflow Support

- Template library governance
- Template rendering with deal data
- Clause extraction and clause preference tracking
- Outside counsel support context
- Governed draft generation for legal docs

### 5) Connector and Research Layer

- Connector onboarding with legal approval metadata
- Controlled external source integrations
- Source-tiered research claims with citations
- Budget/rate-aware retrieval patterns

### 6) Living Knowledge and Continuous Improvement

- Governed learning from approved outcomes
- Deterministic skill-growth modifiers
- Self-improvement scorecards
- Bounded affinity/routing signals (never policy-overriding)

### 7) Packaging and Operations Reliability

- macOS installer and restart persistence
- doctor/setup diagnostics
- release gates and rollback discipline

## How Features Unlock (Quality-Gate Evolution)

### Stage 0: Foundation Active (Now)

- Core SDD governance policy is active.
- Day-1 defaults are locked.
- Value/Friction gates are defined and release-blocking.

### Stage 1: Day-1 Controlled Operations (Current Build Path)

Primary user experience:

- morning brief
- draft queue
- approval/escalation surface
- end-of-day digest

Unlock requires:

- `pnpm check:docs` PASS
- `pnpm check` PASS
- slice proof scripts PASS
- no governance regressions

### Stage 2: Structured Data Safety Expansion

Adds:

- stricter entity/provenance enforcement
- cross-entity block enforcement
- audience clearance and redaction hardening

Unlock requires:

- Slice 1 proof stability
- fail-closed negative-path evidence
- explainability completeness (`what/why/next-step`)

### Stage 3: Decision Quality Expansion

Adds:

- confidence-threshold policy
- escalation protocol hardening
- contradiction detection with citations

Unlock requires:

- queue-age KPI within budget
- escalation routing proofs
- contradiction evidence quality checks

### Stage 4: Operations Resilience Expansion

Adds:

- global pause/resume behavior
- catch-up summaries after pause
- rate-limit budgeting + priority backoff

Unlock requires:

- no missed critical queue items
- deterministic catch-up output
- overload behavior proofs

### Stage 5: Governed Learning Expansion

Adds:

- deterministic skill growth from verified outcomes
- optional bounded affinity signals
- stronger learning loops for daily quality

Unlock requires:

- no silent behavior drift
- reversible learning state
- policy-overrides blocked by design

## Current Dependency-Ordered Build Slices

1. JC-006: role cards + hard bans + output contract
2. JC-007: entity/provenance + cross-entity guards
3. JC-008: escalation + confidence + contradiction
4. JC-009: pause/resume + rate governance
5. JC-010: deterministic learning + optional affinity

Each slice is blocked from promotion until prior slice proofs are green.

## What This Means for Clint

- You are not waiting for value: Day-1 gives immediate operational leverage.
- You are not taking hidden risk: autonomy expands only after evidence.
- You get the full platform over time, with measurable trust gates.

## Friction Budget (Release Blocking)

- manual handling minutes/day <= 45
- approval queue oldest age <= 120 minutes
- unresolved triage items at EOD <= 12
- blocked actions missing explainability = 0

If these are violated, feature expansion pauses and remediation work is prioritized.

## Day-1 Ceilings (Deliberate, Not Missing)

- No autonomous send/invite/share
- No personal mailbox/calendar control
- No uncontrolled external writes
- No trading execution

These are guardrails that protect quality while the platform matures.

## Questions Requiring Your Preference (Optional Tuning)

- Which output should be highest priority in daily use: draft queue, DealOps digest, or triage queue?
- What morning brief delivery time is best for your operating rhythm?
- What level of notification aggressiveness do you want for urgent vs batched items?
- At what confidence level do you want auto-proposal vs mandatory escalation?

## Source Artifacts

- `.specify/specs/001-ted-day1-launch/spec.md`
- `.specify/specs/001-ted-day1-launch/clarify.md`
- `docs/ted-profile/ted_sdd_user_stories_bundle/EXECUTION_SLICE_048_061.md`
- `docs/ted-profile/sdd-pack/14_DAY1_PROMOTION_POLICY.md`
- `docs/ted-profile/sdd-pack/15_VALUE_AND_FRICTION_GATES.md`
