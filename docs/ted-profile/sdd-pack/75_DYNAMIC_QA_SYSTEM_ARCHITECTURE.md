# SDD 75: Dynamic QA System Architecture

**Status:** Active
**Version:** v1
**Date:** 2026-02-25
**Council Mandate:** Unanimous approval — formalize a modular, self-evolving QA system
**Research Base:** 16 platforms analyzed (GitHub Copilot, Devin, Replit, OpenAI Codex, Anthropic Claude, Microsoft Copilot Studio, LangSmith, Meta TestGen-LLM), 80+ authoritative sources
**Prerequisite:** Sprint 2 complete (evaluation pipeline, golden fixtures, prompt registry)

---

## Council Debate Summary

### Tension 1: Framework Proliferation vs. Simplicity

- **Seat 2 (Deal Intelligence)** raised concern: "We already have 84 bash proof scripts. Adding Vitest, fast-check, Stryker, and LangSmith-style eval is 4 new frameworks on a single sidecar."
- **Seat 5 (Workflow)** responded: "The research shows the winning pattern is ONE test runner (Vitest) with plugins for different concerns. Not 4 separate frameworks."
- **Resolution:** Vitest is the single test runner. fast-check is a Vitest plugin. LLM evaluation runs inside Vitest. Proof scripts remain as the behavioral HTTP layer (they test the running system, not code units). Two runners total: Vitest (code) + proof scripts (system).

### Tension 2: LLM Non-Determinism

- **Seat 3 (Output Quality)** argued for LLM-as-judge on all LLM outputs.
- **Seat 7 (Risk)** argued LLM-as-judge introduces its own non-determinism and cost.
- **Resolution:** Layered assertion model (cheapest valid assertion first). Schema validation catches 80% of failures. LLM-as-judge is reserved for high-stakes intents (draft_email, morning_brief) where semantic quality matters. Multi-trial averaging (3 runs) reduces judge variance.

### Tension 3: When to Auto-Generate Tests

- **Seat 4 (Compliance)** cited Meta's TestGen-LLM: "25% coverage-increase rate means 75% of generated tests add no value."
- **Seat 8 (Adoption)** cited OpenAI: "Every manual fix is a signal — turn it into a test."
- **Resolution:** Two auto-generation triggers: (1) correction signals from Builder Lane automatically create regression test fixtures, (2) new route handlers get contract test stubs generated from their execution boundary policy. Both go through a filter pipeline: must parse + must pass + must increase coverage, or discard.

### Tension 4: Static Analysis vs. Dynamic Selection

- **Seat 1 (Systems Integration)** wanted full TIA (test impact analysis) with runtime coverage mapping.
- **Seat 6 (Scalability)** argued runtime instrumentation adds overhead to a single-process Node sidecar.
- **Resolution:** Start with Vitest's built-in import-graph watch mode (static analysis, zero overhead). Add coverage-guided prioritization in CI only. Defer runtime TIA until module extraction (Sprint 3) creates clean import boundaries.

---

## Architecture: 4-Layer Dynamic QA

```
┌─────────────────────────────────────────────────────────────────┐
│  L4: CONTINUOUS MONITORING                                       │
│  Synthetic canaries · Drift detection · Production health        │
│  Runner: Scheduler cron (existing) · Frequency: hourly/daily     │
├─────────────────────────────────────────────────────────────────┤
│  L3: LLM EVALUATION                                              │
│  Multi-grader pipeline · Correction→regression · Shadow eval     │
│  Runner: Vitest + custom harness · Trigger: prompt/model change  │
├─────────────────────────────────────────────────────────────────┤
│  L2: CONTRACT + INTEGRATION                                      │
│  Route contracts · Extension↔sidecar · JSONL round-trips         │
│  Runner: Vitest (HTTP) + proof scripts · Trigger: route change   │
├─────────────────────────────────────────────────────────────────┤
│  L1: UNIT + PROPERTY                                              │
│  Pure function tests · Invariant properties · Edge cases          │
│  Runner: Vitest + fast-check · Trigger: file change (watch mode) │
└─────────────────────────────────────────────────────────────────┘
```

### Dynamic Behaviors

| Behavior                           | Mechanism                                             | Source                                            |
| ---------------------------------- | ----------------------------------------------------- | ------------------------------------------------- |
| **Affected-only re-run**           | Vitest import-graph watch mode                        | Vitest built-in                                   |
| **Contract auto-generation**       | Route registry → test stub generator                  | Custom (inspired by Pact, Microsoft TIA)          |
| **Regression from corrections**    | Builder Lane correction → golden fixture              | Custom (inspired by OpenAI "every fix is a test") |
| **Multi-grader composition**       | Per-intent grader config in `evaluation_graders.json` | Custom (inspired by Microsoft Copilot Studio)     |
| **Drift detection**                | Baseline comparison on scheduled runs                 | Custom (inspired by Netflix Kayenta, LangSmith)   |
| **Coverage-guided prioritization** | Istanbul/c8 coverage + changed-file intersection      | Vitest coverage plugin                            |

---

## Layer 1: Unit + Property Tests

### Purpose

Test pure functions extracted from server.mjs — the 48 testable functions identified in SDD 65, plus invariant properties of data structures.

### Framework

- **Vitest** as test runner (ESM-native for .mjs, built-in watch mode, import-graph analysis)
- **fast-check** for property-based testing (invariant discovery, shrinking, edge case generation)

### Sub-tasks

**QA-001:** Vitest infrastructure setup

- Install: `vitest`, `@vitest/coverage-v8`, `fast-check`
- Create: `vitest.config.mjs` with `test.include: ['sidecars/ted-engine/tests/**/*.test.mjs']`
- Create: `sidecars/ted-engine/tests/` directory
- Add npm script: `"test": "vitest run"`, `"test:watch": "vitest"`
- Coverage thresholds: 80% line, 70% branch for tested files
- ~20 lines config

**QA-002:** Extract testable pure functions into `server-utils.mjs`

- File: `sidecars/ted-engine/server-utils.mjs`
- Extract from server.mjs (keep originals as thin wrappers that delegate):
  - `estimateTokens(text)` — token estimation
  - `editDistance(a, b)` — Levenshtein distance
  - `stripHtml(input)` — HTML sanitization
  - `cronFieldMatches(field, value)` — cron parsing
  - `cronMatchesNow(schedule)` — cron matching
  - `normalizeRoutePolicyKey(method, path)` — route normalization
  - `upcastRecord(record, ledgerName, upcasters)` — record upcasting (pure version)
  - `assembleContext(callType, sections, budgets)` — context assembly (pure version)
  - `validateLlmOutputContract(intent, text, contracts)` — output validation (pure version)
  - `redactPhiFromMessages(messages)` — PHI redaction
- Export all as named exports
- server.mjs imports and delegates — zero behavior change
- ~200 lines (exports) + ~50 lines (server.mjs import bridge)

**QA-003:** Unit tests for extracted functions (example-based)

- File: `sidecars/ted-engine/tests/server-utils.test.mjs`
- Test suites for all 10+ extracted functions
- Minimum 3 cases per function: happy path, edge case, error case
- Priority targets (from SDD 65 C-2):
  - `editDistance`: known pairs, empty strings, identical, Unicode
  - `cronFieldMatches`: wildcards, ranges, steps, comma-separated
  - `stripHtml`: nested tags, script tags, entities, empty
  - `normalizeRoutePolicyKey`: all 155+ route patterns
  - `redactPhiFromMessages`: SSN, MRN, DOB, phone, email patterns
- ~300 lines

**QA-004:** Property-based tests (fast-check)

- File: `sidecars/ted-engine/tests/properties.test.mjs`
- Invariant properties:
  - `estimateTokens(s) >= 0` for all strings
  - `estimateTokens("") === 0`
  - `editDistance(a, b) === editDistance(b, a)` (symmetry)
  - `editDistance(a, a) === 0` (identity)
  - `editDistance(a, b) <= Math.max(a.length, b.length)` (upper bound)
  - `stripHtml(stripHtml(x)) === stripHtml(x)` (idempotence)
  - `cronFieldMatches("*", n) === true` for all valid n
  - `assembleContext(type, sections).metadata.estimated_tokens <= budget.max_tokens` (budget respected)
  - `upcastRecord({...rec, _schema_version: 1}, name) === rec` (v1 identity)
  - `validateLlmOutputContract(intent, validFixture).valid === true` (golden fixtures always pass)
- Generators:
  - `fc.string()` for text inputs
  - `fc.integer({min:0, max:59})` for cron fields
  - `fc.record()` for JSONL records
- ~200 lines

**QA-005:** JSONL round-trip property tests

- File: `sidecars/ted-engine/tests/jsonl-roundtrip.test.mjs`
- Properties:
  - For any valid JSON object, `appendJsonlLine()` then `readJsonlLines()` returns the object with `_schema_version: 1` added
  - For any sequence of appends, `readJsonlLines()` returns them in order
  - For any record with `_schema_version: 0`, upcasting produces `_schema_version: 1`
  - `appendJsonlLine()` output always ends with `\n`
  - Concurrent appends (simulated) never interleave partial JSON
- Requires: temp directory for test JSONL files
- ~150 lines

---

## Layer 2: Contract + Integration Tests

### Purpose

Test the interfaces between components: sidecar routes, extension↔sidecar gateway, config schemas. Contracts auto-generate from route definitions.

### Sub-tasks

**QA-006:** Route contract registry

- File: `sidecars/ted-engine/config/route_contracts.json`
- Auto-generated from execution boundary policy + route definitions
- Per route: `{ method, path, request_schema, response_schema, status_codes, required_headers }`
- Generator script: `scripts/ted-profile/generate_route_contracts.mjs`
  - Reads server.mjs, extracts all `sendJson(res, STATUS, BODY)` patterns
  - Reads execution boundary policies
  - Outputs route_contracts.json
- Re-run on every server.mjs change (watch mode or pre-commit)
- ~155 route entries, ~400 lines JSON

**QA-007:** Contract validation tests

- File: `sidecars/ted-engine/tests/contracts.test.mjs`
- For each route in `route_contracts.json`:
  - Verify response status code matches contract
  - Verify response body contains all required fields
  - Verify response content-type is application/json
  - Verify x-ted-api-version header present
- Uses Vitest + `fetch()` against running sidecar (same pattern as proof scripts but in Vitest)
- Can run with sidecar in `DETERMINISTIC` mode for reproducibility
- ~200 lines + dynamic test generation from contract file

**QA-008:** Extension gateway contract tests

- File: `sidecars/ted-engine/tests/gateway-contracts.test.mjs`
- For each gateway method registered in index.ts:
  - Verify corresponding sidecar route exists in route_contracts.json
  - Verify parameter names match between gateway call and sidecar route
  - Verify response type matches between gateway and sidecar
- This is a **static analysis test** — reads source files, not running system
- Catches: gateway method added without sidecar route, or vice versa
- ~100 lines

**QA-009:** Config schema validation tests

- File: `sidecars/ted-engine/tests/config-schemas.test.mjs`
- For each config file in `config/`:
  - Verify valid JSON
  - Verify `_config_version` present
  - Verify against per-file JSON schema (if defined)
- For `event_schema.json`: verify all event types have `source` and `payload` definitions
- For `output_contracts.json`: verify all contracts have `required_sections`
- For `prompt_registry.json`: verify all template files exist on disk
- ~150 lines

---

## Layer 3: LLM Evaluation (Multi-Grader Pipeline)

### Purpose

Validate LLM outputs using composable graders — cheapest and fastest graders first, expensive LLM-as-judge only when needed. Correction signals from Builder Lane auto-generate regression fixtures.

### Grader Types (inspired by Microsoft Copilot Studio)

| Grader         | Cost | Determinism | When to Use                                                       |
| -------------- | ---- | ----------- | ----------------------------------------------------------------- |
| **Schema**     | Free | 100%        | Always — verify JSON structure, required fields                   |
| **Keyword**    | Free | 100%        | When specific terms must appear (entity names, dates)             |
| **Constraint** | Free | 100%        | Token count, no banned phrases, format compliance                 |
| **Pattern**    | Free | 100%        | Regex patterns (email format, date format, deal ID)               |
| **Semantic**   | Low  | ~95%        | When meaning matters more than exact words (embedding similarity) |
| **LLM-Judge**  | High | ~85%        | High-stakes intents only (draft_email, morning_brief)             |

### Sub-tasks

**QA-010:** Evaluation grader configuration

- File: `sidecars/ted-engine/config/evaluation_graders.json`
- Per-intent grader composition:
  ```json
  {
    "_config_version": 1,
    "triage_classify": {
      "graders": ["schema", "keyword", "constraint"],
      "schema_grader": { "required_fields": ["classification", "urgency", "reason"] },
      "keyword_grader": { "must_contain_one_of": ["low", "medium", "high", "critical"] },
      "constraint_grader": { "max_tokens": 500, "banned_phrases": [] }
    },
    "morning_brief": {
      "graders": ["schema", "constraint", "llm_judge"],
      "schema_grader": { "required_fields": ["greeting", "calendar_summary", "action_items"] },
      "constraint_grader": { "max_tokens": 2000 },
      "llm_judge": {
        "rubric": "Is this brief actionable, accurate, and appropriately prioritized?",
        "threshold": 0.7,
        "trials": 3
      }
    }
  }
  ```
- ~20 intents configured, ~200 lines

**QA-011:** Multi-grader evaluation engine

- File: `sidecars/ted-engine/server.mjs` (extend `runEvaluationPipeline()`)
- Load `evaluation_graders.json` at evaluation time
- For each golden fixture:
  1. Run graders in order (cheapest first)
  2. Early-exit on first hard failure (schema, constraint)
  3. Accumulate soft scores (semantic, LLM-judge)
  4. Compute composite score: weighted average of all grader scores
  5. Compare to threshold (configurable per intent)
- New grader functions:
  - `gradeSchema(text, config)` — existing `validateLlmOutputContract` (already implemented)
  - `gradeKeyword(text, config)` — check for required/forbidden keywords
  - `gradeConstraint(text, config)` — token count, banned phrases, format
  - `gradePattern(text, config)` — regex matching
  - `gradeLlmJudge(text, config, intent)` — call LLM with rubric, average N trials
- Store per-grader scores in evaluation result for debugging
- ~200 lines

**QA-012:** Correction-to-regression pipeline

- File: `sidecars/ted-engine/server.mjs`
- When Builder Lane records a correction signal:
  1. Extract the original LLM output (before correction)
  2. Extract the corrected output (after operator edit)
  3. Auto-generate a golden fixture:
     - `fixture`: the corrected output (this is what "good" looks like)
     - `anti_fixture`: the original output (this is what "bad" looks like)
     - `validates_against`: the intent
     - `source`: `"correction_signal"` with correction_id
  4. Append to `evaluation_corrections.jsonl` ledger
  5. On next evaluation run, include correction-derived fixtures alongside static golden fixtures
- This makes the test suite grow from operator feedback — the "every fix is a test" pattern (OpenAI)
- ~80 lines

**QA-013:** LLM evaluation Vitest harness

- File: `sidecars/ted-engine/tests/llm-evaluation.test.mjs`
- Vitest tests that exercise the evaluation pipeline:
  - Load all golden fixtures
  - For each: run through multi-grader pipeline
  - Assert composite score >= threshold
  - Assert no schema failures
  - Report per-grader breakdown
- Can run offline (against cached fixtures) or online (against running sidecar)
- Integrates with Vitest's `--reporter` for CI output
- ~100 lines

---

## Layer 4: Continuous Monitoring

### Purpose

Scheduled canary tests against the running sidecar, drift detection comparing metrics over time, production health validation.

### Sub-tasks

**QA-014:** Synthetic canary configuration

- File: `sidecars/ted-engine/config/synthetic_canaries.json`
- Define canary checks:
  ```json
  {
    "_config_version": 1,
    "canaries": [
      {
        "name": "status_health",
        "method": "GET",
        "path": "/status",
        "interval_minutes": 60,
        "assertions": [
          { "type": "status_code", "expected": 200 },
          { "type": "field_present", "field": "uptime_seconds" },
          { "type": "field_present", "field": "api_version" }
        ]
      },
      {
        "name": "evaluation_freshness",
        "method": "GET",
        "path": "/ops/evaluation/status",
        "interval_minutes": 1440,
        "assertions": [
          { "type": "status_code", "expected": 200 },
          { "type": "field_gte", "field": "pass_rate", "value": 80 }
        ]
      }
    ]
  }
  ```
- ~15 canaries covering critical paths, ~150 lines

**QA-015:** Canary runner in scheduler

- File: `sidecars/ted-engine/server.mjs`
- Add `runSyntheticCanaries()` to scheduler tick (or dedicated canary interval)
- For each canary:
  1. Execute HTTP request to loopback
  2. Run assertions against response
  3. Log result to `canary_results.jsonl`
  4. On failure: `appendEvent("canary.failed", "synthetic_monitor", { canary_name, assertion, actual })`
  5. On recovery after failure: `appendEvent("canary.recovered", "synthetic_monitor", { canary_name })`
- Track consecutive failures — alert escalation after 3 consecutive fails
- ~120 lines

**QA-016:** Drift detection engine

- File: `sidecars/ted-engine/server.mjs`
- Compare current evaluation results to rolling baseline:
  - 7-day rolling average pass rate (already exists in evaluation pipeline)
  - Per-intent pass rate comparison
  - New: per-grader score trends (detect if schema passes but quality drops)
- Drift thresholds:
  - WARNING: pass rate drops >10% from 7-day average
  - CRITICAL: pass rate drops >20% OR any previously-passing intent fails
- Events: `evaluation.drift.warning`, `evaluation.drift.critical`
- Route: `GET /ops/evaluation/drift` — returns drift analysis
- ~80 lines

**QA-017:** QA dashboard route

- File: `sidecars/ted-engine/server.mjs`
- `GET /ops/qa/dashboard` — aggregated QA health view:
  - Last Vitest run: pass/fail/skip counts, timestamp
  - Last evaluation pipeline: pass rate, trend, failing intents
  - Last canary results: pass/fail per canary, uptime percentage
  - Correction-derived fixtures: count, newest, coverage contribution
  - Drift status: stable/warning/critical
- ~60 lines

**QA-018:** QA dashboard extension gateway + UI card

- File: `extensions/ted-sidecar/index.ts`
  - Gateway method: `ted.ops.qa.dashboard` (GET)
  - Agent tool: `ted_qa_dashboard` — "View QA health metrics"
- File: `ui/src/ui/views/ted.ts`
  - QA Health card showing all dashboard metrics
  - Color-coded status indicators (green/yellow/red)
  - "Run Evaluation" button (existing), "Run Canaries" button (new)
- ~120 lines total

---

## Dynamic Evolution Mechanisms

### Mechanism 1: Test Auto-Discovery (Vitest)

Vitest's import-graph watch mode automatically detects which tests are affected by a file change. When `server-utils.mjs` changes, only tests importing from it re-run.

### Mechanism 2: Contract Auto-Generation (QA-006)

When routes are added/modified, the contract generator script produces updated route_contracts.json. Contract tests dynamically read this file, so new routes automatically get tested.

### Mechanism 3: Correction-to-Regression (QA-012)

Builder Lane corrections automatically create evaluation fixtures. The test suite literally grows from operator feedback without manual test authoring.

### Mechanism 4: Canary Self-Discovery (QA-014)

Canary configuration is data-driven (JSON). Adding a new canary is a config change, not a code change. The canary runner dynamically loads and executes all defined canaries.

### Mechanism 5: Grader Composition (QA-010)

When a new LLM intent is added, its evaluation graders are configured in JSON. The evaluation engine dynamically loads grader configs and applies them. No code change needed to evaluate a new intent.

### Mechanism 6: Drift Baseline Auto-Update (QA-016)

The drift detector's baseline is a rolling 7-day average. As the system improves (or intentionally changes), the baseline automatically adjusts. No manual threshold updates needed.

---

## Execution Plan

### Wave 1 — Foundation (3 parallel agents, ~10 min)

```
Agent A: QA-001 (Vitest setup) + QA-002 (extract pure functions)
Agent B: QA-006 (route contract registry generator)
Agent C: QA-010 (evaluation grader config)
```

### Wave 2 — Core Tests (3 parallel agents, ~15 min)

```
Agent D: QA-003 (unit tests) + QA-004 (property tests) + QA-005 (JSONL round-trips)
Agent E: QA-007 (contract validation) + QA-008 (gateway contracts) + QA-009 (config schemas)
Agent F: QA-011 (multi-grader engine) + QA-012 (correction-to-regression)
```

### Wave 3 — Monitoring + UI (2 parallel agents, ~10 min)

```
Agent G: QA-014 (canary config) + QA-015 (canary runner) + QA-016 (drift detection) + QA-017 (dashboard route)
Agent H: QA-013 (LLM eval harness) + QA-018 (extension + UI card)
```

### Verification

```
node --check sidecars/ted-engine/server.mjs
node --check sidecars/ted-engine/server-utils.mjs
npx tsc --noEmit
npx vitest run
bash -n scripts/ted-profile/generate_route_contracts.mjs
```

---

## Estimated Impact

| Metric             | Before          | After                                                         |
| ------------------ | --------------- | ------------------------------------------------------------- |
| Unit tests         | 0               | ~80 (example + property)                                      |
| Contract tests     | 0               | ~155 (auto-generated from routes)                             |
| Golden fixtures    | 19              | 19 + N correction-derived (growing)                           |
| Evaluation graders | 1 (schema only) | 6 (schema, keyword, constraint, pattern, semantic, LLM-judge) |
| Canary monitors    | 0               | ~15 (critical path coverage)                                  |
| Drift detection    | Manual          | Automated (7-day rolling, auto-alert)                         |
| Test re-run time   | All or nothing  | Affected-only (Vitest watch)                                  |

## Research Sources

### AI Co-Work Platform QA (Primary)

- GitHub Copilot: [Engineering blog — Model evaluation](https://github.blog/ai-and-ml/generative-ai/how-we-evaluate-models-for-github-copilot/)
- Devin (Cognition): [Evaluating coding agents](https://cognition.ai/blog/evaluating-coding-agents)
- Replit Agent: [Automated self-testing](https://blog.replit.com/automated-self-testing)
- OpenAI Codex: [Testing agent skills with evals](https://developers.openai.com/blog/eval-skills/)
- Anthropic Claude: [Bloom behavioral evaluations](https://www.anthropic.com/research/bloom)
- Microsoft Copilot Studio: [Agent evaluation](https://www.microsoft.com/en-us/microsoft-copilot/blog/copilot-studio/build-smarter-test-smarter-agent-evaluation-in-microsoft-copilot-studio/)
- LangSmith: [Evaluation lifecycle](https://www.langchain.com/langsmith/evaluation)
- Meta TestGen-LLM: [Automated test improvement using LLMs](https://arxiv.org/abs/2402.09171)

### Dynamic QA Architecture

- Microsoft TIA: [Test Impact Analysis](https://learn.microsoft.com/en-us/azure/devops/pipelines/test/test-impact-analysis)
- Google TAP: [Testing at the Speed of Light](https://research.google.com/pubs/archive/45861.pdf)
- Meta Predictive Test Selection: [ML-based test selection](https://engineering.fb.com/2018/11/21/developer-tools/predictive-test-selection/)
- Martin Fowler: [Rise of Test Impact Analysis](https://martinfowler.com/articles/rise-test-impact-analysis.html)
- Netflix Kayenta: [Automated canary analysis](https://netflixtechblog.com/automated-canary-analysis-at-netflix-with-kayenta-3260bc7acc69)
- Stryker Mutator: [Mutation testing](https://stryker-mutator.io/)
- fast-check: [Property-based testing](https://fast-check.dev/)
- Vitest: [Import-graph watch mode](https://vitest.dev/guide/features)

### LLM Testing Best Practices

- Langfuse: [Testing LLM applications](https://langfuse.com/blog/2025-10-21-testing-llm-applications)
- Promptfoo: [Assertions and metrics](https://www.promptfoo.dev/docs/configuration/expected-outputs/)
- NAACL 2025: [Non-determinism in LLM evaluation](https://aclanthology.org/2025.naacl-long.211.pdf)
- LangSmith: [Pytest integration](https://blog.langchain.com/pytest-and-vitest-for-langsmith-evals/)

---

## Council Vote

| Seat                    | Vote    | Notes                                                                 |
| ----------------------- | ------- | --------------------------------------------------------------------- |
| 1 — Systems Integration | APPROVE | 4-layer architecture aligns with industry consensus                   |
| 2 — Deal Intelligence   | APPROVE | Correction-to-regression captures deal-specific quality               |
| 3 — Output Quality      | APPROVE | Multi-grader pipeline is the right LLM evaluation model               |
| 4 — Compliance          | APPROVE | Contract tests catch interface drift automatically                    |
| 5 — Workflow            | APPROVE | Two runners (Vitest + proofs) is clean, not bloated                   |
| 6 — Scalability         | APPROVE | Dynamic mechanisms reduce maintenance as system grows                 |
| 7 — Risk                | APPROVE | Drift detection + canaries address production monitoring gap          |
| 8 — Adoption            | APPROVE | Correction-to-regression makes operator feedback build the test suite |

**Unanimous: 8-0 APPROVE**
