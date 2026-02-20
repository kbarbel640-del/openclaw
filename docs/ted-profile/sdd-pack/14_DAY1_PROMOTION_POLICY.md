# Day-1 Promotion Policy (Recursive SDD Model)

**Generated:** 2026-02-20

---

## Purpose

Ship a mature Day-1 product without widening blast radius.

All feature families are represented in SDD artifacts, but runtime activation is promotion-gated by evidence.

---

## Promotion States

### SHADOW

- Observe-only mode.
- No external side effects.
- Produces diagnostics/proposals for operator review.

### PREVIEW

- Limited active mode with strict boundaries.
- Risky operations remain approval-gated.
- Tight allowlists and fail-closed behavior required.

### GA

- Fully enabled within approved scope.
- Still bound by non-negotiables (draft-only boundaries, approval-first risky writes, auditability).

### DEFERRED

- Not enabled in current phase.
- Exists in roadmap/spec backlog only.

---

## Non-Negotiables (Apply in All States)

- Draft-only outbound by default; no autonomous send/invite/share.
- Single-operator posture for Day-1 baseline.
- No personal mailbox/calendar control in Day-1 baseline.
- No plaintext secrets/tokens; keychain-first.
- Loopback-only sidecar boundary with allowlisted routes.
- Fail-closed on auth/policy/audit/secret failures.

---

## Recursive SDD Loop (Required Per Slice)

1. Update `spec` (outcomes + boundaries).
2. Resolve `clarify` items (P0 decisions locked or explicit NEEDS_CLINT).
3. Define `tasks` and job card increment.
4. Run deterministic proof script (`proof_jcXXX.sh`).
5. Run release/documentation gates.
6. Update decision/risk/open-question logs.
7. Decide promotion (`SHADOW -> PREVIEW -> GA`).

No slice advances until prior slice proofs and gates are PASS.

---

## Promotion Criteria

### SHADOW -> PREVIEW

- Contract/schema validation passes.
- No policy bypass observed.
- Audit/redaction evidence complete.

### PREVIEW -> GA

- Deterministic proof scripts PASS for two consecutive runs.
- No critical governance violations in monitored window.
- Operator validation pass (doctor/setup/workflow smoke + reboot where applicable).

---

## Day-1 Default Activation Strategy

- GA: governance baseline, sidecar contract seam, setup/doctor/runtime reliability, draft workflows.
- PREVIEW: higher-risk or less-proven behavior where approvals remain strict.
- SHADOW: optimization/learning features until quality and control metrics stabilize.

---

## Open Questions Handling Rule

When operator input is missing, use safest default that minimizes blast radius and preserves governance.

Record each temporary default in:

- `11_DECISION_LOG.md`
- `13_OPEN_QUESTIONS.md`

Promote only after explicit decision and proof evidence.
