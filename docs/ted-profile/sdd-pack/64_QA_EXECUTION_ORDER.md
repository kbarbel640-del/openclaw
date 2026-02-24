# SDD 64 — Ted QA Execution Order & Master Index

**Version:** 1.0
**Date:** 2026-02-24
**Council Vote:** 10/10 (unanimous)

---

## Purpose

This document defines the recommended execution order for all Ted QA plans. Each plan is a standalone, reusable document that can be executed on demand. The ordering follows the **fail-fast principle** — run the cheapest, fastest checks first so expensive tests don't run against broken code.

---

## Master Index

| Order | Plan                      | Document   | Items   | Duration   | Automation  | Gate?           |
| ----- | ------------------------- | ---------- | ------- | ---------- | ----------- | --------------- |
| 1     | Static Analysis & Linting | SDD 63 §1  | ~10     | Minutes    | Full CI     | Yes             |
| 2     | Unit Testing              | SDD 63 §2  | ~15     | Minutes    | Full CI     | Yes             |
| 3     | Component Integration     | SDD 63 §3  | ~10     | Minutes    | Full CI     | Yes             |
| 4     | API Contract Testing      | SDD 63 §4  | ~12     | Minutes    | Full CI     | Yes             |
| 5     | Data Integrity            | SDD 63 §5  | ~12     | 10-30 min  | Mostly auto | Yes             |
| 6     | Security Testing          | SDD 63 §6  | ~20     | Hours-Days | Semi-auto   | Critical/High   |
| 7     | LLM/AI Testing            | SDD 63 §7  | ~15     | Hours      | Semi-auto   | Safety issues   |
| 8     | External Integration      | SDD 63 §8  | ~15     | Hours      | Semi-auto   | Yes             |
| 9     | End-to-End Testing        | SDD 63 §9  | ~15     | Hours      | Semi-auto   | Yes             |
| 10    | Performance Testing       | SDD 63 §10 | ~12     | Hours      | Auto        | Regression only |
| 11    | Accessibility (WCAG AA)   | SDD 63 §11 | ~24     | Hours      | Semi-auto   | Level A         |
| 12    | **UI/UX Testing**         | **SDD 62** | **184** | Hours-Days | Semi-auto   | Render failures |
| 13    | Operational Readiness     | SDD 63 §13 | ~20     | Half-day   | Manual      | GO/NO-GO        |
| 14    | User Acceptance           | SDD 63 §14 | ~15     | Days-Weeks | Manual      | Final GO/NO-GO  |

**Total checklist items across all plans: ~379**

---

## Execution Tiers

### Tier 1: CI Pipeline (Run on every commit)

Plans 1-4. Total time: <5 minutes. Fully automated. Block merge on failure.

### Tier 2: Pre-Release (Run before each release candidate)

Plans 5-9. Total time: 4-8 hours. Mix of automated + manual. Block release on Critical/High failures.

### Tier 3: Quality Certification (Run quarterly or before major releases)

Plans 10-12. Total time: 1-3 days. Focus on non-functional quality attributes.

### Tier 4: Launch Gates (Run once before production)

Plans 13-14. Total time: 1-2 weeks. Manual. GO/NO-GO decision.

---

## Gap Analysis: Current Coverage

| Plan                     | Coverage    | Status                             | Top Gap                                      |
| ------------------------ | ----------- | ---------------------------------- | -------------------------------------------- |
| 1. Static Analysis       | **GOOD**    | `pnpm check` in pre-commit         | Add dependency + secrets scanning            |
| 2. Unit Testing          | **PARTIAL** | Vitest configured for extension    | server.mjs has ~0 unit tests                 |
| 3. Component Integration | **PARTIAL** | proof scripts test routes          | No systematic wiring verification            |
| 4. API Contract          | **PARTIAL** | 80+ proof scripts                  | No response schema assertions                |
| 5. Data Integrity        | **NONE**    | No ledger testing                  | Entire plan missing                          |
| 6. Security              | **LOW**     | Guards exist (auth, PHI, approval) | No systematic OWASP audit                    |
| 7. LLM/AI Testing        | **LOW**     | 7 golden fixtures only             | No prompt injection or hallucination testing |
| 8. External Integration  | **LOW**     | Untested without real creds        | No mock Graph server                         |
| 9. E2E Testing           | **LOW**     | Some e2e test files exist          | No Ted-specific workflows                    |
| 10. Performance          | **NONE**    | No measurements                    | Entire plan missing                          |
| 11. Accessibility        | **NONE**    | No a11y testing                    | Entire plan missing                          |
| 12. UI/UX                | **LOW**     | Manual only                        | SDD 62 not yet executed                      |
| 13. ORR                  | **PARTIAL** | Council reviews serve this role    | No formal checklist                          |
| 14. UAT                  | **BLOCKED** | Requires operator + real creds     | Acknowledged blocker                         |

---

## Priority Implementation Order

If implementing incrementally, build these plans first (highest risk-reduction per effort):

1. **Data Integrity (Plan 5)** — 35 JSONL ledgers are the sole persistence layer. A corruption bug means silent data loss with no recovery. Critical gap.

2. **Security (Plan 6)** — HIPAA-adjacent data handling without adversarial testing. PHI redaction, auth guards, and approval gates need penetration testing.

3. **Sidecar Unit Tests (Plan 2 expansion)** — server.mjs at ~19K lines with zero unit tests. Pure functions (editDistance, cronFieldMatches, EWMA scoring, circuit breakers) need isolated tests.

4. **LLM/AI Testing (Plan 7)** — Indirect prompt injection through ingested emails is a realistic attack vector. Malicious email body could manipulate triage, briefs, or commitments.

5. **Performance Baseline (Plan 10)** — O(n) JSONL scans across 35 ledgers growing over time. Need baselines to know when compaction or indexing becomes necessary.

---

## Document References

| SDD    | Title                              | Items                                                                                                |
| ------ | ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **62** | UX Quality Assurance Checklist     | 184 items, 16 categories (Nielsen heuristics, WCAG, Material Design, VS Code UX, Baymard, Apple HIG) |
| **63** | Comprehensive QA Plan Suite        | 14 plans, ~195 items covering static analysis through UAT                                            |
| **64** | QA Execution Order (this document) | Master index and prioritization                                                                      |

---

## How to Run

```bash
# Tier 1: CI pipeline (every commit)
pnpm check                    # Static analysis (Plan 1)
pnpm test                     # Unit tests (Plan 2)
# TODO: Add Plans 3-4 to CI

# Tier 2: Pre-release
./scripts/ted-profile/run_all_proofs.sh   # Contract tests (Plan 4, partial)
# TODO: Add Plans 5-9

# Tier 3: Quality certification
# Execute SDD 62 checklist manually (Plan 12)
# Run axe-core + Lighthouse (Plan 11)
# Run k6 benchmarks (Plan 10)

# Tier 4: Launch gates
# Execute ORR checklist (Plan 13)
# Operator runs Day 1 playbook (Plan 14)
```

---

## Review Schedule

- **Tier 1:** Every commit (automated)
- **Tier 2:** Every release candidate
- **Tier 3:** Quarterly or after major UI changes
- **Tier 4:** Before first production deployment, then annually

---

_This document is a living index. Update when new QA plans are added or execution order changes._
