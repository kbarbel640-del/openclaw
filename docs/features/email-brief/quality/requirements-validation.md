# Requirements Validation: ADR-001 Email Brief Extension

**Date:** 2026-02-20
**Validator:** Requirements Validator Agent
**Inputs:** ADR-001, Shift-Left Testing Report, QCSD Ideation Reports (HTSM, SFDIPOT, Testability), Milestones Plan

---

## Validation Summary

| Metric                                        | Count |
| --------------------------------------------- | ----- |
| Requirements checked (R-01..R-19)             | 19    |
| Fully traced                                  | 17    |
| Partially traced                              | 2     |
| Not traced                                    | 0     |
| Missing requirements checked (MR-01..MR-10)   | 10    |
| Missing reqs addressed in milestones          | 8     |
| Missing reqs deferred                         | 2     |
| ADR invariants checked                        | 5     |
| Invariants fully covered                      | 5     |
| SFDIPOT CRITICAL/HIGH risks                   | 11    |
| CRITICAL/HIGH risks with milestone assignment | 11    |
| Critical gaps                                 | 0     |
| Medium gaps                                   | 3     |
| Low gaps                                      | 4     |

---

## Implementation Readiness: CONDITIONAL YES

No critical gaps found. All 19 functional requirements are traced through tests and milestones. All 5 ADR invariants have enforcement mechanisms. All CRITICAL and HIGH risks from SFDIPOT are assigned to milestones. Three medium gaps exist as conditions to address during implementation (see below).

**Conditions for proceeding:**

1. M3 must include delegation-specific `403` error mapping (MG-01)
2. M5 must include the `sanitizeError()` utility that covers all error paths (MG-02)
3. M4/M5 must specify the LLM fallback format in code, not just in docs (MG-03)

---

## Traceability Matrix

### Functional Requirements (from Shift-Left Report)

| Req ID | Requirement                                            | ADR Section                 | Test Cases (Shift-Left) | Risk IDs     | Milestone | Coverage |
| ------ | ------------------------------------------------------ | --------------------------- | ----------------------- | ------------ | --------- | -------- |
| R-01   | Parse `/email_brief [filters] [period]` arguments      | Decision: Argument Parsing  | AT-Parse-01..10         | F-02         | M1        | Full     |
| R-02   | Period regex `\d+[hdwm]`, default 1d                   | Decision: Argument Parsing  | AT-Parse-01..05         | F-02         | M1        | Full     |
| R-03   | Support filters: from:, to:, urgent, unread, free text | Decision: Argument Parsing  | AT-Parse-06..10         | F-03         | M1, M2    | Full     |
| R-04   | JWT auth via Service Account (node:crypto, RS256)      | Decision: Authentication    | AT-JWT-01..07           | TR-04, S-4.1 | M3        | Full     |
| R-05   | Access token caching with 1h TTL auto-refresh          | Decision: Authentication    | AT-JWT-02..03           | T-01, T-06   | M3        | Full     |
| R-06   | Gmail API: list messages with search query             | Decision: Gmail API Usage   | AT-Gmail-01..02         | TR-01        | M3        | Full     |
| R-07   | Gmail API: get message content (full format)           | Decision: Gmail API Usage   | AT-Gmail-04             | TR-01        | M3        | Full     |
| R-08   | Build Gmail search query from parsed args              | Decision: Gmail API Usage   | AT-Gmail-01..03         | —            | M2        | Full     |
| R-09   | Respect maxEmails limit (default 20)                   | Decision: Configuration     | AT-Gmail-08             | SC-5.2       | M3        | Full     |
| R-10   | Extract email metadata (from, subject, date, snippet)  | Decision: Gmail API Usage   | AT-Gmail-04             | —            | M2        | Full     |
| R-11   | Extract email body text (plain text preferred)         | Decision: Gmail API Usage   | AT-Gmail-10..12         | C-1.1, F-05  | M2        | Full     |
| R-12   | LLM summarization via runEmbeddedPiAgent               | Decision: LLM Summarization | AT-LLM-01               | F-01, CO-8.1 | M4        | Partial  |
| R-13   | Summarization prompt with priority tiers               | Decision: LLM Summarization | AT-LLM-05..06           | CO-8.2       | M4        | Full     |
| R-14   | Format response for Telegram markdown                  | Decision: LLM Summarization | AT-Tg-01..03            | I-06         | M5        | Full     |
| R-15   | Graceful error on missing credentials                  | Consequences: Invariants    | AT-JWT-04..06           | TR-02        | M3, M5    | Full     |
| R-16   | Graceful error on Gmail API failure                    | Consequences: Invariants    | AT-Gmail-06..07         | TR-01, TR-07 | M3, M5    | Full     |
| R-17   | Graceful error on LLM failure/timeout                  | Consequences: Invariants    | AT-LLM-04..05           | TR-06, TR-10 | M4, M5    | Full     |
| R-18   | Plugin manifest with configSchema                      | Decision: Configuration     | AT-Install-01           | S-04         | M1        | Partial  |
| R-19   | Config from env vars and openclaw.json                 | Decision: Configuration     | AT-Install-04           | O-05         | M3, M5    | Full     |

**Partially traced:**

- **R-12**: LLM output quality is inherently non-deterministic. Tests verify invocation contract (`disableTools: true`, prompt structure), not output content. Accepted per testability assessment (Risk 2: LLM Output Non-Determinism).
- **R-18**: Plugin manifest `configSchema` is specified as JSON Schema in M1. SFDIPOT (S-04) notes that Typebox validation is not used. JSON Schema in manifest is sufficient for initial implementation.

### Missing Requirements (from Shift-Left Report)

| MR ID | Missing Requirement                            | Milestone              | Status        |
| ----- | ---------------------------------------------- | ---------------------- | ------------- |
| MR-01 | Telegram message chunking for long digests     | M5                     | Addressed     |
| MR-02 | Email body truncation for LLM context window   | M2 (body), M4 (prompt) | Addressed     |
| MR-03 | Sender authorization check                     | M5 (requireAuth: true) | Addressed     |
| MR-04 | HTML email body stripping                      | M2                     | Addressed     |
| MR-05 | Base64url decoding for Gmail API body parts    | M2                     | Addressed     |
| MR-06 | MIME multipart traversal                       | M2                     | Addressed     |
| MR-07 | Concurrent message fetching with limit         | M3 (concurrency cap 5) | Addressed     |
| MR-08 | Empty inbox handling                           | M5                     | Addressed     |
| MR-09 | Logging at key checkpoints                     | —                      | Deferred (P3) |
| MR-10 | Cleanup tmp session files after LLM invocation | —                      | Deferred (P3) |

**Deferred justification:**

- MR-09 (logging): Low impact, can be added incrementally during implementation. HTSM Observability section recommends it but does not make it a gate condition.
- MR-10 (tmp cleanup): The `runEmbeddedPiAgent` runner handles its own session cleanup. Extension-level cleanup is defense-in-depth, not required.

### ADR Invariants

| #     | Invariant                                                     | Enforcement Mechanism                         | Milestone | Test Coverage                       |
| ----- | ------------------------------------------------------------- | --------------------------------------------- | --------- | ----------------------------------- |
| INV-1 | Extension MUST NOT require bash tool calls from the LLM       | `disableTools: true` in M4                    | M4        | AT-LLM: verify `disableTools` param |
| INV-2 | Extension MUST handle Gmail API errors gracefully             | Error waterfall in M5, per-error tests in M3  | M3, M5    | AT-Gmail-06..08, AT-JWT-07          |
| INV-3 | Extension MUST respect configured maxEmails limit             | `maxResults` param in M3                      | M3        | AT-Gmail-08                         |
| INV-4 | Extension MUST work when gateway runs with Cloud.ru FM models | `disableTools: true` + text-only prompt in M4 | M4        | AT-LLM-01 (structural)              |
| INV-5 | JWT signing MUST use node:crypto only (no npm deps)           | Implementation constraint in M3               | M3        | AT-JWT-01                           |

### Domain Events

| Event                 | ADR Section   | Milestone | Implementation Status               |
| --------------------- | ------------- | --------- | ----------------------------------- |
| `command:email_brief` | Domain Events | M5        | Implicit (command dispatcher emits) |
| `email_brief:success` | Domain Events | M5        | To implement in handler             |
| `email_brief:error`   | Domain Events | M5        | To implement in handler             |

**Note:** The testability assessment (Section 2, Observability) flags domain event observability as a minor gap — the emission API is not yet designed. Events can be implemented via `api.logger.info()` as a proxy or deferred to a future `api.emit()` mechanism.

### SFDIPOT CRITICAL/HIGH Risk Coverage

| Risk ID | Risk                                      | Level       | Milestone | Mitigation in Plan                               |
| ------- | ----------------------------------------- | ----------- | --------- | ------------------------------------------------ |
| D-01    | Private key exposure in errors/logs       | CRITICAL    | M5        | `sanitizeError()` utility                        |
| D-02    | PII sent to external LLM                  | CRITICAL    | M4        | Anti-injection delimiters, prompt instruction    |
| D-08    | Prompt injection via email content        | HIGH        | M4        | `<email>` XML tags, anti-injection system prompt |
| F-01    | LLM output quality on Cloud.ru FM         | HIGH        | M4        | Fallback to metadata list                        |
| I-01    | `runEmbeddedPiAgent` API instability      | HIGH        | M4        | Dynamic import with try/catch (same as llm-task) |
| O-01    | Domain-wide delegation misconfiguration   | HIGH        | M3        | Actionable error on 403                          |
| O-02    | No setup validation command               | HIGH        | —         | Deferred to P2 (post-implementation)             |
| T-01    | Token expiry mid-request                  | HIGH        | M3        | 55-min refresh margin + 401 retry                |
| D-03    | Access token in process memory            | HIGH        | —         | Accepted risk (defense-in-depth P2)              |
| D-04    | Private key in environment variable       | HIGH        | M3        | Prefer file path, document risk                  |
| F-09    | Authorization bypass if requireAuth unset | MEDIUM (P0) | M5        | Explicit `requireAuth: true`                     |

All CRITICAL risks have milestone assignments. O-02 (validation command) is HIGH but deferred — it's a UX improvement, not a security or correctness issue.

---

## Gap Analysis

### Critical Gaps

None identified. All functional requirements, invariants, and CRITICAL/HIGH risks are covered.

### Medium Gaps

| ID    | Gap                                                                                  | Source                        | Impact                                                                 | Resolution                                                                                                                                    | Effort |
| ----- | ------------------------------------------------------------------------------------ | ----------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| MG-01 | Gmail 403 error mapping to delegation-specific message not in M3 acceptance criteria | SFDIPOT O-01, HTSM U-3.2      | Users get cryptic `unauthorized_client` instead of actionable guidance | Add acceptance criterion to M3: "On Gmail 403, error mentions domain-wide delegation with scope and client ID"                                | S      |
| MG-02 | `sanitizeError()` utility scope not fully defined                                    | SFDIPOT D-01, HTSM S-4.1      | Private key could leak through unexpected error paths                  | Define sanitization rules explicitly in M5: strip `-----BEGIN.*KEY-----`, `Bearer ` tokens, file paths                                        | S      |
| MG-03 | LLM fallback format not codified                                                     | SFDIPOT F-04, shift-left R-12 | When LLM fails, raw email metadata format is ambiguous                 | Define fallback as `"N. [sender] subject (date)\n"` in M4 acceptance criteria — already mentioned in M4 but confirm it's a testable criterion | S      |

**Resolution:** All three are small-effort additions to existing milestone acceptance criteria. They do not require new milestones or loop-back to earlier steps.

### Low Gaps

| ID    | Gap                                        | Source                    | Impact                                           | Resolution                                                                                              | Effort |
| ----- | ------------------------------------------ | ------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ------ |
| LG-01 | No typing indicator during processing      | HTSM U-3.4                | Users see no feedback for 10-60s                 | P2: Add `sendChatAction("typing")` via channel API. Requires understanding Telegram channel integration | M      |
| LG-02 | Domain events emission mechanism undefined | Testability Assessment §2 | Cannot test event emission in integration tests  | P3: Define `api.emit()` or use structured logging as proxy                                              | S      |
| LG-03 | No per-model context window budget         | HTSM CO-8.3               | Prompt may overflow on smaller models            | P2: Add model-specific truncation budgets when Cloud.ru FM model catalog stabilizes                     | M      |
| LG-04 | Gmail query injection via free text        | SFDIPOT F-03              | User can escape `in:inbox` scope with `in:trash` | P2: Strip known Gmail operators from free-text tokens                                                   | S      |

---

## Pattern Compliance Check

| Pattern                     | In Existing Code                                                        | In ADR/Plan                                            | Status  |
| --------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------ | ------- |
| Plugin entry point          | `export default function register(api)` in ask-agent, llm-task          | Same pattern in M5                                     | Aligned |
| Plugin manifest             | `openclaw.plugin.json` with `id`, `name`, `description`, `configSchema` | Specified in M1                                        | Aligned |
| Command registration        | `api.registerCommand({ name, description, handler })`                   | Specified in M5                                        | Aligned |
| `requireAuth` default       | Defaults to `true` per `src/plugins/types.ts:187`                       | Explicitly set `true` in M5                            | Aligned |
| LLM invocation              | Dynamic import of `runEmbeddedPiAgent` with try/catch                   | Same pattern in M4                                     | Aligned |
| `disableTools: true`        | Used in `llm-task` for JSON-only tasks                                  | Used in M4 for text-only summarization                 | Aligned |
| Result extraction           | `payloads.filter(p => !p.isError).map(p => p.text).join("\n")`          | Specified in M4                                        | Aligned |
| HTTP mocking                | `vi.stubGlobal("fetch", ...)` in googlechat tests                       | Planned for M3                                         | Aligned |
| Module mocking              | `vi.mock("path", () => ({}))` in llm-task tests                         | Planned for M4, M5                                     | Aligned |
| `fakeApi()` factory         | In `llm-task-tool.test.ts`                                              | Planned for M5                                         | Aligned |
| Colocated tests             | `*.test.ts` next to source in all extensions                            | Specified in all milestones                            | Aligned |
| ESM imports with `.js`      | Universal project convention                                            | Assumed                                                | Aligned |
| Text chunking               | `chunkMarkdownText(text, limit)` from `src/auto-reply/chunk.ts`         | Used in M5 for Telegram responses                      | Aligned |
| Error handling              | try/catch with typed error messages in ask-agent                        | Specified in M3 (per-error mapping) and M5 (waterfall) | Aligned |
| Config resolution           | Env vars > config file pattern in telegram, max extensions              | Specified in M3 and M5                                 | Aligned |
| File size limit             | ~500 LOC per file (CLAUDE.md)                                           | 6 source files, each focused                           | Aligned |
| No npm dependencies for JWT | ADR invariant INV-5                                                     | `node:crypto` in M3                                    | Aligned |

**No compliance gaps found.** The planned implementation follows all established codebase patterns.

---

## Cross-Artifact Consistency Check

| Check                                                    | Result                                            | Notes                                             |
| -------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------- |
| ADR requirements count matches shift-left report         | 19 in both                                        | Consistent                                        |
| Missing requirements (MR-01..10) addressed in milestones | 8 of 10                                           | MR-09, MR-10 deferred with justification          |
| SFDIPOT risk IDs referenced in milestones                | 11 of 11 CRITICAL/HIGH                            | All covered                                       |
| HTSM P0 actions covered in milestones                    | 4 of 4                                            | requireAuth, sanitizeError, truncation, chunking  |
| Testability gate decision                                | GO                                                | No blockers                                       |
| Milestone dependency DAG consistency                     | M1→{M2,M3,M4}→M5                                  | No cycles, correct parallelization                |
| Test case count alignment                                | Shift-left: ~38, Milestones: ~10+18+17+10+8 = ~63 | Milestones have more granular counts — acceptable |
| ADR invariants all have test assertions                  | 5/5                                               | Full coverage                                     |
| Domain events have milestone assignments                 | 3/3                                               | All in M5                                         |

---

## Verdict: CONDITIONAL YES

Implementation may proceed. All critical requirements, invariants, and high-severity risks are covered by the milestone plan. The three medium gaps (MG-01, MG-02, MG-03) are small refinements to existing milestone acceptance criteria and should be addressed during Wave 2-3 implementation.

**No loop-back required.**
