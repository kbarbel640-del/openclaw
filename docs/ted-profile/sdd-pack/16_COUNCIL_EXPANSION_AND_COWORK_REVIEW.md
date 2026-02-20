# Council Expansion and Co-Work Alignment Review

**Generated:** 2026-02-20

## Purpose

Expand the standing council with additional expert seats and run a critical review of the current build against future co-work best practices.

This file is now part of the recurring SDD governance loop.

## Permanent Council Seats (Updated)

Existing seats remain active. Add these seats as permanent council roles:

1. Agentic AI Systems Architect
2. Human Factors and Cognitive Load Researcher
3. Orchestration Engineer
4. Evals Specialist and Quality Lead
5. Security and Compliance Lead
6. Product Lead

## Required Interrogation Questions (Must Ask Each Review Cycle)

### Agentic AI Systems Architect

- Which capabilities should be deterministic workflows vs adaptive agent planning?
- What is the minimum safe tool surface for Phase-1, and what tools are explicitly refused?
- Where is persistent state stored, and what controls prevent context drift across weeks?

### Human Factors and Cognitive Load Researcher

- Which cognitive load buckets are we actually removing (triage, memory, context switching, decision framing, emotional overhead)?
- Can operator explain "what happened and why" in one screen with provenance?
- Can operator correct a wrong action in under 10 seconds?

### Orchestration Engineer

- Is the orchestration model event-driven, scheduled, or hybrid for this slice?
- Are all jobs idempotent/retriable with dedupe and backoff?
- What prevents long-running sessions from losing intent across restarts?

### Evals Specialist and Quality Lead

- What offline eval sets cover this slice?
- What production metrics prove this slice helps (approval rate, correction rate, misses, false positives)?
- What regression tests protect prior slices from breakage?

### Security and Compliance Lead

- How is prompt injection/tool misuse handled for this slice?
- Are least-privilege and execution boundaries still enforced?
- What OAuth/consent abuse patterns are blocked?

### Product Lead

- Are the first three highest-value workflows still the focus?
- What are week-1, week-4, and week-8 success criteria?
- What is explicitly out-of-scope for now?

## Critical Review of Current Build (As Implemented)

### Verified Strengths

- Governance controls are now executable, not just documented:
  - role card validation, hard-ban checks, output contract checks
  - entity/provenance and cross-entity block enforcement
  - confidence escalation and contradiction checks with citations
  - pause/resume and rate governance controls
  - deterministic learning and bounded affinity controls
- Recursive proof chain is in place (`JC-006` through `JC-010`) and passing.
- Value/friction gates and canonical operator loop are formalized in SDD.

### Material Gaps for Future Co-Work Quality

1. Workflow-vs-agent boundary remains under-specified at runtime orchestration layer.
2. Fast-repair UX (<10s correction) is not yet proven with explicit acceptance tests.
3. Offline eval packs for briefs/drafts/extraction are not yet formalized in gates.
4. Long-running context persistence and anti-drift checks are not yet explicit artifacts.
5. macOS installer completion remains blocked in current Linux environment (requires macOS + Swift/Xcode toolchain).

### Priority Remediation Actions

1. Add a workflow/agent boundary contract per slice:
   - deterministic path first, agentic branch only where needed.
2. Add "fast repair" acceptance criteria and proof step to all operator-facing slices.
3. Add eval bundle job card:
   - golden sets for drafts, extraction, contradiction, escalation routing.
4. Add orchestration integrity checks:
   - idempotency key requirement, retry/backoff contract, resume consistency.
5. Execute mac packaging on a macOS runner to close installer gate.

## Council Decision

- Keep this expanded council active for all future slices.
- No slice promotes without a council interrogation pass against the questions above.
- Failures in evals, security posture, or operator cognitive load are stop-the-line conditions.
