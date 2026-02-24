# SDD 63 -- Comprehensive QA Plan Suite

**Version:** 1.0
**Date:** 2026-02-24
**Scope:** Ted Engine (sidecar + extension + UI), 14 QA plans covering static analysis through user acceptance
**Status:** Active

---

## Executive Summary

Ted's codebase has grown to ~18,974 lines (server.mjs), ~10,530 lines (index.ts), and ~4,358 lines (views/ted.ts) with 150+ route handlers, 156 gateway methods, 78 agent tools, 71 MCP tools, 35 JSONL ledgers, and 26 operator surface cards. Current test coverage consists of 81 behavioral proof scripts (HTTP curl tests) and a 32-line extension test stub. There are zero unit tests for server.mjs, zero component integration tests, zero performance tests, and zero accessibility tests.

This document defines 14 QA plans in recommended execution order, following the fail-fast principle: catch cheap bugs early, expensive bugs before they compound. The plans progress from fully automated CI gates (minutes) to operator-driven acceptance testing (days).

**Current risk profile:** The sole persistence layer (35 JSONL ledgers) has no data integrity test suite. The 18,974-line server.mjs has zero unit test coverage. LLM outputs are validated only by 7 golden fixtures run at startup. These gaps represent the highest risk-to-effort ratio for immediate investment.

---

## Recommended Execution Order

| #   | Plan                          | Duration   | Automation       | Blocking?          | Current Coverage |
| --- | ----------------------------- | ---------- | ---------------- | ------------------ | ---------------- |
| 1   | Static Analysis & Linting     | 2-5 min    | Fully automated  | Yes (CI gate)      | PARTIAL          |
| 2   | Unit Testing                  | 10-30 min  | Fully automated  | Yes (CI gate)      | NONE             |
| 3   | Component Integration Testing | 5-15 min   | Fully automated  | Yes (CI gate)      | LOW              |
| 4   | API Contract Testing          | 5-10 min   | Fully automated  | Yes (CI gate)      | PARTIAL          |
| 5   | Data Integrity Testing        | 5-15 min   | Fully automated  | Yes (CI gate)      | NONE             |
| 6   | Security Testing              | 30-60 min  | Semi-automated   | Yes (release gate) | LOW              |
| 7   | LLM/AI Application Testing    | 15-45 min  | Semi-automated   | Yes (release gate) | LOW              |
| 8   | External Service Integration  | 10-30 min  | Semi-automated   | No (nightly)       | PARTIAL          |
| 9   | End-to-End Testing            | 15-45 min  | Semi-automated   | Yes (release gate) | PARTIAL          |
| 10  | Performance Testing           | 30-120 min | Semi-automated   | No (weekly)        | NONE             |
| 11  | Accessibility Testing         | 30-60 min  | Semi-automated   | No (release gate)  | NONE             |
| 12  | UI/UX Testing                 | 60-120 min | Manual + tools   | No (release gate)  | PARTIAL          |
| 13  | Operational Readiness Review  | 60-120 min | Manual + scripts | Yes (GO/NO-GO)     | LOW              |
| 14  | User Acceptance Testing       | 1-5 days   | Manual           | Yes (ship gate)    | NONE             |

---

## Gap Analysis

| Plan                          | Current State                                                        | Coverage | Priority |
| ----------------------------- | -------------------------------------------------------------------- | -------- | -------- |
| Static Analysis & Linting     | tsc builds run; no eslint config for ted-engine; no secrets scanning | PARTIAL  | HIGH     |
| Unit Testing                  | 0 unit tests for server.mjs; 32-line stub for extension              | NONE     | CRITICAL |
| Component Integration Testing | No wiring verification tests; tool registration untested             | LOW      | HIGH     |
| API Contract Testing          | 81 proof scripts (curl-based); no schema validation                  | PARTIAL  | HIGH     |
| Data Integrity Testing        | No JSONL integrity tests; no concurrent write tests                  | NONE     | CRITICAL |
| Security Testing              | HIPAA redaction exists; no OWASP scanning; no pen testing            | LOW      | HIGH     |
| LLM/AI Application Testing    | 7 golden fixtures at startup; no prompt injection tests              | LOW      | HIGH     |
| External Service Integration  | graphFetchWithRetry exists; no mock server tests                     | PARTIAL  | MEDIUM   |
| End-to-End Testing            | Proof scripts cover happy paths; no failure/recovery paths           | PARTIAL  | MEDIUM   |
| Performance Testing           | No benchmarks; no load tests; no memory leak detection               | NONE     | MEDIUM   |
| Accessibility Testing         | No WCAG audit; no screen reader testing                              | NONE     | MEDIUM   |
| UI/UX Testing                 | SDD 62 checklist (184 items) defined but not executed                | PARTIAL  | MEDIUM   |
| Operational Readiness Review  | ted-setup.sh exists; systemd unit exists; no DR testing              | LOW      | HIGH     |
| User Acceptance Testing       | Blocked on real Azure AD credentials                                 | NONE     | HIGH     |

---

## Priority Recommendation: Top 5 Plans to Implement First

1. **Plan 2: Unit Testing** -- Highest ROI. Pure functions in server.mjs (editDistance, cronFieldMatches, stripHtml, EWMA scoring, circuit breaker transitions) are testable today with zero infrastructure. Catches regression bugs at the cheapest possible stage.

2. **Plan 5: Data Integrity Testing** -- Highest risk. 35 JSONL ledgers are the sole persistence layer with no database backup. A single corrupt write or failed mutex could lose operator data. Must verify write/read round-trips, concurrent access, and compaction integrity.

3. **Plan 1: Static Analysis & Linting** -- Cheapest to implement. Add eslint + secrets scanning to CI. Catches type errors, unused variables, and accidental credential commits before they reach any other test layer.

4. **Plan 4: API Contract Testing** -- Formalizes the 81 existing proof scripts into a repeatable, schema-validated suite. Low marginal effort since the curl-based tests already exist; needs schema extraction and assertion hardening.

5. **Plan 6: Security Testing** -- HIPAA compliance is a hard requirement. PHI redaction, approval bypass prevention, and JSONL injection resistance must be validated before any operator handles real patient-adjacent data.

**Rationale:** This ordering follows the cost-of-fix curve -- bugs caught in unit tests cost 1x to fix, in integration 5x, in production 100x. Plans 2 and 5 address the two largest gaps (zero coverage on the two most critical layers). Plans 1 and 4 are low-effort, high-signal CI gates. Plan 6 is driven by regulatory obligation.

---

## Plan 1: Static Analysis & Linting

**Purpose:** Catch syntax errors, type violations, unused code, formatting drift, dependency vulnerabilities, and accidental secret commits before any code reaches review or runtime.

**Who runs it:** CI pipeline (automated on every push and PR)

**Key checklist:**

- TypeScript compilation (`tsc --noEmit`) passes with zero errors for extension
- ESLint runs on `index.ts`, `controllers/ted.ts`, `views/ted.ts`, `app-render.ts` with zero errors
- ESLint or equivalent linter runs on `server.mjs` (JS rules, no-unused-vars, no-undef)
- Prettier/format check passes (consistent indentation, trailing commas, semicolons)
- `npm audit` reports zero critical/high vulnerabilities in production dependencies
- Secret scanning (gitleaks or trufflehog) finds zero secrets in staged changes
- No `console.log` statements outside designated debug blocks
- No `TODO` or `FIXME` without linked issue/task number
- License compatibility check passes (no GPL in production deps)
- Circular dependency detection passes (madge or equivalent)

**Recommended tools:** TypeScript compiler, ESLint, Prettier, npm audit, gitleaks, madge

**Scoring rubric:**

- **PASS:** Zero errors across all checks
- **FAIL:** Any single check produces an error (warnings may be allowed with documented exceptions)

**Duration:** 2-5 minutes | **Automation:** Fully automated (CI gate, blocks merge)

---

## Plan 2: Unit Testing

**Purpose:** Verify correctness of pure functions and isolated logic units in server.mjs and the extension, providing the fastest feedback loop for regressions.

**Who runs it:** CI pipeline (automated on every push); developers run locally during development

**Key checklist:**

- `editDistance(a, b)` -- known string pairs, empty strings, identical strings, Unicode
- `cronFieldMatches(field, value)` -- wildcards, ranges, steps, comma-separated, DOW=0 and DOW=7 as Sunday
- `cronMatchesNow(schedule)` -- boundary cases (midnight, month-end, DST transitions)
- `detectCorrectionPatterns(signals)` -- time decay weighting, minimum signal threshold, pattern grouping
- `selectArchetype(profile)` -- all 3 archetypes returned for matching profiles, fallback for unknown
- `stripHtml(input)` -- nested tags, script tags, entities, empty input, non-HTML passthrough
- `normalizeRoutePolicyKey(method, path)` -- all 150+ route patterns produce correct keys, unknown routes
- EWMA health scoring -- boundary values (0%, 100%), latency normalization, provider ranking
- Circuit breaker state transitions -- closed->open (threshold), open->half-open (cooldown), half-open->closed (probe success), half-open->open (probe failure)
- `cronFieldMatches()` extended -- comma+step combos, out-of-range values, malformed input
- `readJsonBodyGuarded()` -- valid JSON, invalid JSON (returns 400), empty body, oversized body
- `blockedExplainability()` -- all policy types produce human-readable explanation strings

**Recommended tools:** Vitest (fast, ESM-native, compatible with .mjs)

**Scoring rubric:**

- **PASS:** 100% of tests pass; line coverage >80% for tested functions
- **FAIL:** Any test failure; coverage below 80% for any targeted function

**Duration:** 10-30 minutes (initial suite creation: 2-4 hours) | **Automation:** Fully automated (CI gate)

**Note:** server.mjs currently has ~0% unit test coverage. Functions must be extracted or imported for testability. Consider extracting pure functions into a `server-utils.mjs` module.

---

## Plan 3: Component Integration Testing

**Purpose:** Verify that the extension correctly wires controllers to gateway methods, registers all agent tools, enforces event schemas, and that ledger read/write round-trips are correct.

**Who runs it:** CI pipeline (automated); requires sidecar running locally

**Key checklist:**

- All 156 gateway methods registered and callable (enumerate via reflection, verify no orphans)
- All 78 agent tools registered with correct parameter schemas
- All 71 MCP tools exposed via `/mcp` endpoint with correct schemas
- Event schema compliance -- all 212 event types in `event_schema.json` have corresponding `appendEvent()` calls
- Hook execution order -- `before_tool_call` fires before tool execution for all gated tools
- Ledger round-trip -- write to each of 35 ledgers, read back, verify identical content
- Controller state management -- loading guard prevents double-submission, error state resets correctly
- Gateway timeout -- `requestTedWithTimeout<T>()` correctly rejects after 12s
- Extension startup -- `resolvePluginTools()` resolves all 78 tools without errors
- Dual-write consistency -- every ledger write has a corresponding `appendEvent()` call
- `REQUIRES_OPERATOR_CONFIRMATION` set contains exactly the expected tools (currently 7+2 write tools)

**Recommended tools:** Vitest + test harness that starts sidecar subprocess, supertest for HTTP

**Scoring rubric:**

- **PASS:** All wiring checks pass; zero orphaned methods/tools; all ledger round-trips succeed
- **FAIL:** Any orphaned gateway method, unregistered tool, missing event type, or failed round-trip

**Duration:** 5-15 minutes | **Automation:** Fully automated (CI gate, requires sidecar process)

---

## Plan 4: API Contract Testing

**Purpose:** Validate that all 150+ sidecar routes accept correct inputs, return correct HTTP status codes, enforce required headers, and match documented response schemas.

**Who runs it:** CI pipeline (automated); sidecar must be running

**Key checklist:**

- Every route returns correct HTTP status codes (200, 201, 400, 403, 404, 500)
- `readJsonBodyGuarded()` routes return 400 on malformed JSON (not 500)
- All routes requiring `x-ted-approval-source: operator` reject requests without the header (403)
- Error responses use consistent format (`{ error: string }`)
- Golden fixture validation -- 7 fixtures (draft_email, triage_classify, commitment_extract, improvement_proposal, morning_brief, eod_digest, meeting_debrief) pass schema check
- Content-Type headers correct on all responses (application/json)
- Route policy normalization -- all routes map to a valid `executionBoundaryPolicy` key
- Pagination routes return correct `nextLink` or truncation indicators
- Auth-guarded routes return 401/403 when token is missing or expired
- Empty body routes do not crash (null/undefined body handling)
- CORS and security headers present where required
- Proof script formalization -- all 81 existing proof scripts converted to repeatable test suite

**Recommended tools:** Vitest + supertest, or dedicated contract testing framework (Pact); existing proof scripts as baseline

**Scoring rubric:**

- **PASS:** All routes return expected status codes; error format consistent; golden fixtures pass; all 81 proof scripts pass
- **FAIL:** Any incorrect status code, inconsistent error format, or golden fixture failure

**Duration:** 5-10 minutes | **Automation:** Fully automated (CI gate)

---

## Plan 5: Data Integrity Testing

**Purpose:** Verify that the 35 JSONL ledgers -- Ted's sole persistence layer -- maintain data integrity under all conditions including concurrent writes, crashes, and compaction.

**Who runs it:** CI pipeline (automated); dedicated integrity tests run nightly

**Key checklist:**

- JSONL write/read round-trip for all 35 ledgers (write N records, read back, verify identical)
- Dual-write consistency -- every ledger mutation also produces an `appendEvent()` entry in `event_log.jsonl`
- Replay correctness -- reading a ledger and replaying events produces identical final state
- Compaction integrity -- hot/archive split preserves all records, SHA-256 manifest validates
- Concurrent write safety -- `_xxxRunning` mutex guards prevent interleaved writes under parallel requests
- Atomic write verification -- incomplete writes (simulated crash mid-append) do not corrupt subsequent reads
- `readJsonlLines()` handles corrupt lines gracefully (skips with warning, does not crash)
- Dedup verification -- ingestion dedup (ingestion.jsonl) correctly prevents duplicate processing
- `appendJsonlLine()` ends every line with `\n` (no missing newlines that merge records)
- Ledger rotation -- `rotateLogIfNeeded()` creates new file without data loss
- File locking -- no two processes can write to the same ledger simultaneously
- Backup/restore -- a cold backup of the `data/` directory can be restored and all routes function correctly

**Recommended tools:** Vitest, custom test harness with filesystem assertions, concurrent test runner

**Scoring rubric:**

- **PASS:** All round-trips succeed; zero data loss under concurrent writes; compaction manifest verifies; corrupt line handling graceful
- **FAIL:** Any data loss, corrupt read, failed manifest, or crash on corrupt input

**Duration:** 5-15 minutes (unit); nightly run 30-60 minutes (stress) | **Automation:** Fully automated (CI gate + nightly stress)

**CRITICAL:** This is the highest-risk gap. JSONL files are the only persistence layer -- there is no database, no WAL, no replication. A single integrity bug could lose all operator data.

---

## Plan 6: Security Testing

**Purpose:** Validate OWASP API Top 10 compliance, HIPAA-specific protections (PHI redaction, audit trails, entity isolation), and resistance to prompt injection and authorization bypass.

**Who runs it:** Security engineer or designated developer; automated scans in CI, manual pen testing quarterly

**Key checklist:**

- OWASP API1: Object-level authorization -- profile isolation (profile A cannot read profile B ledgers)
- OWASP API2: Broken authentication -- token refresh flow, expired token rejection, no hardcoded credentials
- OWASP API3: Object property level -- no mass assignment via JSON body injection
- OWASP API5: SSRF -- Graph API calls cannot be redirected to internal endpoints
- HIPAA: `redactPhiFromMessages()` correctly strips PHI patterns (SSN, MRN, DOB, phone, email)
- HIPAA: `selectLlmProvider()` routes HIPAA entities to compliant providers (case-insensitive matching)
- HIPAA: Audit trail -- all data access logged to `event_log.jsonl` with timestamps and actor
- Approval bypass -- requests lacking `x-ted-approval-source: operator` are rejected for all 9 confirmation-required tools
- Path traversal -- file-path parameters in SharePoint routes cannot escape allowed directories
- JSONL injection -- crafted JSON payloads with embedded newlines cannot create false ledger entries
- Prompt injection -- direct injection via tool parameters does not alter system prompt behavior
- Secrets in response -- no API keys, tokens, or credentials appear in any route response body

**Recommended tools:** OWASP ZAP (automated scan), Burp Suite (manual), Semgrep (SAST rules), gitleaks

**Scoring rubric:**

- **PASS:** Zero critical/high OWASP findings; all HIPAA controls verified; zero approval bypasses; zero path traversals
- **FAIL:** Any critical OWASP finding, HIPAA redaction miss, approval bypass, or credential leak

**Duration:** 30-60 minutes (automated); 2-4 hours (manual pen test) | **Automation:** Semi-automated (CI scan + quarterly manual)

---

## Plan 7: LLM/AI Application Testing

**Purpose:** Validate that LLM integrations produce correct, safe, and consistent outputs -- including resistance to prompt injection, hallucination detection, and format compliance.

**Who runs it:** ML/AI engineer or designated developer; automated regression in CI, adversarial testing quarterly

**Key checklist:**

- Direct prompt injection -- tool parameters containing "ignore previous instructions" do not alter behavior
- Indirect prompt injection -- ingested emails containing injection payloads are neutralized by `redactPhiFromMessages()`
- Golden fixture regression -- 7 fixtures produce structurally valid output on every run
- Format compliance -- over 20 runs, >95% of LLM outputs match expected JSON schema
- Constitution enforcement -- `validateConstitution()` rejects proposals that violate design laws
- Rubber-stamping detection -- builder lane identifies and flags auto-approved proposals without genuine review
- Provider fallback -- when primary provider is down, `selectLlmProviderWithFallback()` routes to healthy alternative
- EWMA scoring -- provider health degrades correctly under simulated failures
- Hallucination detection -- commitment extraction from known test emails produces only real commitments
- Cost tracking -- token counts are logged and costs calculated correctly per provider
- Timeout handling -- LLM calls that exceed timeout produce graceful error (not hang)
- Temperature/parameter consistency -- all LLM calls use documented parameters (no rogue temperature settings)

**Recommended tools:** Promptfoo (automated evaluation), Giskard (adversarial testing), custom golden fixture runner

**Scoring rubric:**

- **PASS:** Golden fixtures pass 100%; format compliance >95% over 20 runs; zero prompt injection successes; provider fallback works
- **FAIL:** Any golden fixture failure, format compliance <95%, successful prompt injection, or provider fallback failure

**Duration:** 15-45 minutes | **Automation:** Semi-automated (CI regression + quarterly adversarial)

---

## Plan 8: External Service Integration Testing

**Purpose:** Verify that Microsoft Graph, LLM providers, and SharePoint integrations handle real-world conditions (throttling, pagination, token refresh, errors) correctly.

**Who runs it:** Developer with mock server in CI; operator with real credentials for gated tests

**Key checklist:**

- OAuth2 token refresh -- `ensureValidToken()` refreshes expired tokens and retries the original request
- Graph 429 throttling -- `graphFetchWithRetry()` respects Retry-After header and backs off correctly
- Graph pagination -- `graphFetchAllPages()` follows `@odata.nextLink` up to 10 pages, truncates with warning
- Graph error codes -- 401 triggers token refresh, 403 produces clear permission error, 404 handled gracefully
- SharePoint upload -- file uploaded via Graph API is retrievable and content matches
- SharePoint folder creation -- created folder appears in subsequent list calls
- LLM provider timeout -- requests exceeding configured timeout are aborted and error logged
- LLM provider error -- 500/503 from provider triggers retry with backoff
- Calendar event fetch -- `fetchCalendarEventsInternal()` returns correct events with attendees, body, organizer
- Mail fetch -- `fetchUnreadMailInternal()` returns unread messages, marks as read when configured
- Planner/To Do sync -- `reconcile()` correctly syncs without creating duplicates
- Mock vs real gate -- mock server tests run in CI; real credential tests require `GRAPH_LIVE=1` env var

**Recommended tools:** Mock service worker (MSW) or nock for CI; real Graph sandbox tenant for gated tests

**Scoring rubric:**

- **PASS:** All mock tests pass; retry/backoff behavior correct; pagination terminates correctly; auth refresh works
- **FAIL:** Any unhandled error code, infinite retry loop, pagination overflow, or auth failure

**Duration:** 10-30 minutes (mock); 15-45 minutes (live) | **Automation:** Semi-automated (CI mock + nightly live if credentials available)

---

## Plan 9: End-to-End Testing

**Purpose:** Validate complete user workflows from trigger to final output, covering the full stack: UI -> extension -> sidecar -> Graph -> response -> UI update.

**Who runs it:** QA engineer or developer; automated in CI with mock backend, manual with real services

**Key checklist:**

- Onboarding flow -- `ted-setup.sh` + `/ops/onboarding/activate` + `/ops/setup/validate` completes without errors
- Morning brief -- scheduler triggers -> calendar fetch -> commitment lookup -> LLM call -> brief delivered
- Inbox ingestion -- `/ops/ingestion/run` -> mail fetch -> auto-triage -> dedup -> event logged
- Draft lifecycle -- create -> edit -> submit_review -> approve -> execute (Graph send) -> archive
- Deal management -- create deal -> add contact -> log activity -> update stage -> retrospective
- Meeting debrief -- fetch event -> extract commitments -> generate action items -> store results
- Scheduler dispatch -- `schedulerTick()` fires all configured cron jobs at correct times
- Self-healing recovery -- circuit breaker opens on failure -> half-open probe -> recovery to closed
- Discovery pipeline -- `/ops/onboarding/discover` scans email + calendar + Planner, extracts contacts/deals
- Builder lane -- correction signal -> pattern detection -> proposal generation -> shadow evaluation
- Config change -- operator changes policy via UI -> config saved -> snapshot event logged -> effect verified
- Error recovery -- sidecar crash -> systemd restart -> startup validation -> ledger replay -> operational

**Recommended tools:** VS Code Extension Test Runner, Playwright (for webview UI), custom workflow harness

**Scoring rubric:**

- **PASS:** All 12 workflows complete end-to-end; final state matches expected; no orphaned state
- **FAIL:** Any workflow fails to complete, produces incorrect output, or leaves inconsistent state

**Duration:** 15-45 minutes | **Automation:** Semi-automated (CI with mocks + manual with real services)

---

## Plan 10: Performance Testing

**Purpose:** Establish performance baselines and detect regressions in route latency, JSONL operations at scale, memory usage, and event loop health.

**Who runs it:** Developer or SRE; automated benchmarks in CI, extended stress tests weekly

**Key checklist:**

- Route latency baselines -- p50/p95/p99 for top 20 most-called routes (target: p99 < 200ms for reads, <500ms for writes)
- JSONL append at scale -- 1K, 10K, 100K line files: measure append latency and read-all latency
- JSONL read at scale -- `readJsonlLines()` performance with 100K+ lines (target: <5s)
- Memory leak detection -- 24-hour continuous operation with periodic requests, heap growth <50MB
- Event loop lag -- under sustained load, event loop delay stays <100ms
- Scheduler tick under load -- 6 gates evaluated within 1s even with 100K ledger lines
- Concurrent request handling -- 50 simultaneous requests do not cause crashes or data corruption
- LLM call queuing -- back-pressure handling when LLM provider is slow
- Startup time -- cold start to first request served (target: <5s)
- Compaction performance -- archiving a 100K-line ledger completes within 30s
- Graph pagination under load -- 10-page fetch completes within configured timeout
- Memory profile -- no single request allocates >100MB (watch for large email body processing)

**Recommended tools:** k6 (load testing), clinic.js (Node.js profiling), autocannon (HTTP benchmarks), process.memoryUsage()

**Scoring rubric:**

- **PASS:** All latency targets met; zero memory leaks; event loop lag <100ms; no crashes under load
- **FAIL:** Any p99 exceeding target by 2x, memory leak detected, event loop lag >500ms, or crash under load

**Duration:** 30-120 minutes | **Automation:** Semi-automated (CI benchmarks + weekly extended runs)

---

## Plan 11: Accessibility Testing

**Purpose:** Ensure Ted Workbench meets WCAG 2.2 Level AA accessibility standards across all 26 operator surface cards, supporting keyboard navigation, screen readers, and high contrast modes.

**Who runs it:** UX engineer or developer with accessibility expertise; automated scans in CI

**Key checklist:**

- Perceivable: Color contrast ratio >= 4.5:1 for text, >= 3:1 for large text and UI components
- Perceivable: All images and icons have text alternatives (alt text or aria-label)
- Perceivable: Content is readable and functional at 200% zoom
- Operable: All interactive elements reachable via keyboard (Tab, Shift+Tab, Enter, Space, Escape)
- Operable: Focus indicator visible on all focusable elements (not hidden by CSS)
- Operable: No keyboard traps -- Escape closes modals, focus returns to trigger element
- Understandable: All form inputs have visible labels (not placeholder-only)
- Understandable: Error messages are associated with their form fields (aria-describedby)
- Robust: All custom components use correct ARIA roles, states, and properties
- Robust: Screen reader (NVDA/VoiceOver) can navigate all 26 cards and read content meaningfully
- VS Code theme compatibility -- cards render correctly in Default Dark, Default Light, High Contrast
- VS Code zoom levels -- layout does not break at 150% and 200% editor zoom

**Recommended tools:** axe-core (automated scanning), Lighthouse (accessibility audit), NVDA (Windows screen reader), VoiceOver (macOS)

**Scoring rubric:**

- **PASS:** Zero critical/serious axe-core violations; keyboard navigation complete; screen reader usable; all themes render correctly
- **FAIL:** Any critical axe-core violation, keyboard trap, or screen reader blocker

**Duration:** 30-60 minutes (automated); 2-4 hours (manual screen reader) | **Automation:** Semi-automated (CI scan + manual screen reader quarterly)

---

## Plan 12: UI/UX Testing

**Purpose:** Execute the SDD 62 UX Quality Assurance Checklist (184 items across 16 categories) and verify visual correctness, state binding, empty states, and cross-theme rendering for all 26 operator surface cards.

**Who runs it:** UX engineer or product designer; developer assists with state simulation

**Key checklist:**

- SDD 62 Category 1-16 execution -- all 184 checklist items scored (PASS/PARTIAL/FAIL/N/A)
- Card rendering -- each of 26 cards renders without visual artifacts in Default Dark and Light themes
- State binding -- controller state changes propagate to view within one render cycle
- Empty states -- every card shows meaningful empty state (not blank space) when no data exists
- Loading states -- every async operation shows loading indicator within 100ms
- Error states -- every failed operation shows clear error message with retry affordance
- Cross-theme testing -- Default Dark, Default Light, High Contrast Dark, High Contrast Light
- Visual regression -- screenshot comparison against baseline for each card in each theme
- Form validation -- all input forms validate before submission, show inline errors
- Responsive layout -- cards render correctly at minimum and maximum VS Code panel widths
- Interaction patterns -- buttons, dropdowns, toggles, and modals behave per VS Code UX Guidelines
- Information hierarchy -- critical information (alerts, errors, pending approvals) is visually prominent

**Recommended tools:** Playwright (screenshot comparison), VS Code Extension Test Runner, SDD 62 checklist spreadsheet

**Scoring rubric:**

- **PASS:** >= 90% of SDD 62 items scored PASS; zero S1-CRITICAL or S2-HIGH failures; visual regression delta <1%
- **FAIL:** < 90% PASS rate, any S1-CRITICAL finding, or visual regression delta >5%

**Duration:** 60-120 minutes | **Automation:** Manual with tool assistance (screenshot diffing automated)

---

## Plan 13: Operational Readiness Review

**Purpose:** Verify that Ted can be built, deployed, operated, monitored, and recovered from disaster by a single operator without developer intervention. GO/NO-GO gate before production.

**Who runs it:** Operations engineer or designated developer simulating operator role

**Key checklist:**

- Clean checkout build -- `git clone` -> `npm install` -> `npm run build` succeeds with zero errors
- `ted-setup.sh` validation -- all 7 phases complete, `/ops/setup/validate` returns all-green
- Systemd service lifecycle -- `start` -> `status` -> `stop` -> `restart` all succeed; `ted-engine.service` enabled
- Startup recovery -- incomplete `pending_delivery.jsonl` entries are retried on restart
- Monitoring coverage -- all 212 event types in `event_schema.json` are emittable and queryable
- Log rotation -- `rotateLogIfNeeded()` creates rotated files; old logs are preserved
- Disaster recovery -- backup `data/` directory, delete original, restore from backup, verify all routes functional
- Capacity planning -- documented maximum ledger sizes, recommended disk space, memory requirements
- Rollback plan -- documented steps to revert to previous version without data loss
- Configuration validation -- all JSON configs validated at startup; malformed config produces clear error
- Health endpoint -- `/ops/health` returns status within 1s, reflects actual component health
- Scheduler resilience -- scheduler survives cron job failures without stopping future dispatches

**Recommended tools:** Shell scripts, systemctl, manual verification checklist

**Scoring rubric:**

- **PASS (GO):** All 12 items verified; DR tested successfully; monitoring covers all event types; rollback tested
- **FAIL (NO-GO):** Any item fails; especially: build failure, DR data loss, or scheduler not resilient

**Duration:** 60-120 minutes | **Automation:** Manual with scripted assists (ted-setup.sh, proof scripts)

---

## Plan 14: User Acceptance Testing

**Purpose:** Validate that Ted delivers real business value to an operator using real Azure AD credentials, real calendar data, real email, and real deal pipelines over a multi-day evaluation period.

**Who runs it:** Operator (end user) with real Azure AD credentials; developer available for support

**Key checklist:**

- Day 1: Azure AD connection -- OAuth2 flow completes, Graph scopes granted, profile validated
- Day 1: Morning brief -- fetches real calendar events, includes real commitments, operator finds it useful
- Day 1: Inbox ingestion -- processes real unread emails, auto-triages correctly, no false positives
- Day 1: Draft email -- generates draft in operator's voice, appears in Outlook Drafts, tone is acceptable
- Day 7: Deal pipeline -- real deals entered, contacts linked, activities logged, stage transitions tracked
- Day 7: Commitment extraction -- real meeting transcripts produce accurate commitments (>80% precision)
- Day 7: Meeting debrief -- real calendar events enriched with attendees/body, debrief is actionable
- Day 7: Scheduler reliability -- morning brief and EOD digest fire on schedule for 7 consecutive days
- Day 30: Builder lane calibration -- correction patterns detected, proposals generated, style drift measured
- Day 30: Self-healing -- circuit breakers triggered and recovered during normal operation
- Day 30: Autonomy progression -- Ted correctly escalated/de-escalated based on operator corrections
- Day 30: Overall satisfaction -- operator would recommend Ted to a colleague (NPS-style assessment)

**Recommended tools:** Operator Adoption Playbook (SDD 53), real Azure AD credentials, feedback forms

**Scoring rubric:**

- **PASS:** Operator completes Day 1 checklist without developer intervention; Day 7 and Day 30 items meet "useful" threshold; zero data loss incidents
- **FAIL:** Operator cannot complete Day 1 without help; any data loss; commitment precision <60%; drafts require >50% manual rewriting

**Duration:** 1-5 days (Day 1), 7 days (Day 7 gate), 30 days (full acceptance) | **Automation:** Manual (operator-driven with structured feedback)

---

## Appendix: Rationale for Execution Ordering

The 14 plans are ordered by the **fail-fast principle** and the **cost-of-fix curve**:

1. **Static analysis first** -- cheapest possible gate. A type error caught here costs 1 minute to fix. The same error caught in production costs hours of debugging plus potential data corruption.

2. **Unit tests second** -- isolated function tests run in milliseconds, catch logic bugs before any integration complexity. The 18,974-line server.mjs with zero unit coverage is the single largest risk in the codebase.

3. **Integration before contract** -- verifying that components are wired correctly is prerequisite to testing their contracts. A missing gateway method cannot produce a correct response schema.

4. **Data integrity before security** -- a data corruption bug can masquerade as a security issue. Establish that the persistence layer is sound before testing access controls on top of it.

5. **Security before LLM testing** -- prompt injection and PHI leakage are higher-severity than LLM format compliance. A security breach has regulatory consequences; a malformed LLM output has operational consequences.

6. **External services after security** -- Graph API integration issues are contained by the sidecar boundary. Testing them requires mock infrastructure that benefits from having the contract tests already defined.

7. **E2E after components** -- end-to-end tests are expensive to write and debug. They should only run after unit, integration, and contract tests have established confidence in individual components.

8. **Performance after correctness** -- optimizing a system that produces wrong results is waste. Performance tests assume functional correctness.

9. **Accessibility and UI/UX together** -- both require the UI to be functionally complete and correct. Accessibility is more automatable; UI/UX requires human judgment.

10. **Operational readiness before UAT** -- the operator should not encounter deployment issues during acceptance testing. Verify that the system can be installed and operated before asking an operator to evaluate it.

11. **UAT last** -- the most expensive test (requires a real human with real credentials over multiple days). Every preceding plan exists to ensure the operator's time is spent evaluating business value, not debugging infrastructure.

---

## Appendix: Existing Test Assets Inventory

| Asset                           | Count        | Location                                                         | Type            |
| ------------------------------- | ------------ | ---------------------------------------------------------------- | --------------- |
| Proof scripts (behavioral HTTP) | 81           | `scripts/ted-profile/proof_*.sh`                                 | Bash + curl     |
| Extension test stub             | 1 (32 lines) | `extensions/ted-sidecar/index.test.ts`                           | Vitest          |
| Golden fixtures                 | 7            | Embedded in `server.mjs` startup                                 | JSON schema     |
| UX checklist                    | 184 items    | `docs/ted-profile/sdd-pack/62_UX_QUALITY_ASSURANCE_CHECKLIST.md` | Manual          |
| Event schema                    | 212 types    | `event_schema.json`                                              | JSON validation |
| Operator playbook               | 1            | `docs/ted-profile/sdd-pack/53_OPERATOR_ADOPTION_PLAYBOOK.md`     | Manual guide    |
| Setup script                    | 1            | `ted-setup.sh`                                                   | Bash (7 phases) |
| Systemd unit                    | 1            | `ted-engine.service`                                             | systemd         |

---

_Document generated 2026-02-24. Review and update quarterly or after any architectural change._
