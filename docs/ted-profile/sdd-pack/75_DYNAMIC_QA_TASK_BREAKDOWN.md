# SDD 75 — Dynamic QA System Architecture: Task Breakdown

**Status:** COMPLETE (18/18)
**Sprint:** 3
**Date:** 2026-02-25
**Test Suite:** 7 files, 1,434 tests (1,278 pass, 156 skipped), ~670ms

---

## Wave 1 — L1 Foundation (Unit + Property Testing)

- [x] **QA-001** — Vitest infrastructure setup (`vitest.sidecar.config.ts`, devDependencies)
- [x] **QA-002** — Extract pure functions into `server-utils.mjs` (10 functions: sanitize, slugify, estimateTokens, validateOutputContractPure, cronMatchesNow, etc.)
- [x] **QA-003** — Unit tests for extracted functions (75 tests in `server-utils.test.mjs`)
- [x] **QA-004** — Property-based tests with fast-check (28 tests in `properties.test.mjs`)
- [x] **QA-005** — JSONL round-trip property tests (16 tests in `jsonl-roundtrip.test.mjs`)

## Wave 2 — L2 Contract + L3 Evaluation

- [x] **QA-006** — Route contract registry generator (164 routes in `route_contracts.json`)
- [x] **QA-007** — Contract validation tests (852 tests in `contracts.test.mjs`, 156 skipped when sidecar offline)
- [x] **QA-008** — Extension gateway contract tests (198 tests in `gateway-contracts.test.mjs`)
- [x] **QA-009** — Config schema validation tests (148 tests in `config-schemas.test.mjs`, validates all 34 configs)
- [x] **QA-010** — Evaluation grader configuration (`evaluation_graders.json`: 20 intents, 4 grader types)
- [x] **QA-011** — Multi-grader evaluation engine (schema → keyword → constraint → pattern, hard-fail early exit)
- [x] **QA-012** — Correction-to-regression pipeline (auto-generates golden fixtures from Builder Lane edits)
- [x] **QA-013** — LLM evaluation Vitest harness (117 tests in `llm-evaluation.test.mjs`)

## Wave 3 — L4 Continuous Monitoring + Dashboard

- [x] **QA-014** — Synthetic canary configuration (`synthetic_canaries.json`: 10 canaries, hourly schedule)
- [x] **QA-015** — Canary runner in scheduler (`runSyntheticCanaries()`, consecutive failure alerting)
- [x] **QA-016** — Drift detection engine (`detectScoreDrift()`, per-intent rolling baseline comparison)
- [x] **QA-017** — QA dashboard route (`GET /ops/qa/dashboard` — aggregates evaluation, canaries, drift)
- [x] **QA-018** — QA dashboard extension + UI card (gateway methods, controller, view card)

---

## Artifacts Created

| Artifact                     | Type   | Location                      |
| ---------------------------- | ------ | ----------------------------- |
| `vitest.sidecar.config.ts`   | Config | Project root                  |
| `server-utils.mjs`           | Module | `sidecars/ted-engine/`        |
| `server-utils.test.mjs`      | Test   | `sidecars/ted-engine/tests/`  |
| `properties.test.mjs`        | Test   | `sidecars/ted-engine/tests/`  |
| `jsonl-roundtrip.test.mjs`   | Test   | `sidecars/ted-engine/tests/`  |
| `contracts.test.mjs`         | Test   | `sidecars/ted-engine/tests/`  |
| `gateway-contracts.test.mjs` | Test   | `sidecars/ted-engine/tests/`  |
| `config-schemas.test.mjs`    | Test   | `sidecars/ted-engine/tests/`  |
| `llm-evaluation.test.mjs`    | Test   | `sidecars/ted-engine/tests/`  |
| `evaluation_graders.json`    | Config | `sidecars/ted-engine/config/` |
| `synthetic_canaries.json`    | Config | `sidecars/ted-engine/config/` |
| `route_contracts.json`       | Config | `sidecars/ted-engine/config/` |

## Routes Added

- `GET /ops/canary/status` — Last canary run results + 24h history
- `POST /ops/canary/run` — Trigger canary check cycle
- `GET /ops/drift/status` — Per-intent drift analysis
- `POST /ops/drift/run` — Trigger drift detection
- `GET /ops/qa/dashboard` — Unified QA health aggregator

## Server Functions Added

- `gradeSchema()`, `gradeKeyword()`, `gradeConstraint()`, `gradePattern()` — Individual graders
- `runMultiGraderEvaluation()` — Composable multi-grader pipeline with early-exit
- `loadCorrectionFixtures()` — Reads auto-generated fixtures from corrections
- `runSyntheticCanaries()` — Canary runner with consecutive failure tracking
- `detectScoreDrift()` — Per-intent trend comparison against rolling baseline
- `recordIntentScore()` — Score history recording for drift detection

## Gateway Methods Added

- `ted.ops.qa.dashboard` — QA health aggregator
- `ted.ops.canary.status` — Canary results
- `ted.ops.canary.run` — Trigger canary run
- `ted.ops.drift.status` — Drift analysis
