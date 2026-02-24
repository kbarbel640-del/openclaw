# SDD 65 — Council QA Execution Report

**Version:** 1.0
**Date:** 2026-02-24
**Council Vote:** All 10 seats participated
**Plans Executed:** 14 of 14
**Checklist Items Audited:** ~379

---

## Executive Summary

The Ted Council executed all 14 QA plans defined in SDD 63-64 against the full codebase: `server.mjs` (~19K lines), `index.ts` (~10K lines), `views/ted.ts` (~4.4K lines), plus controllers, configs, and 80 proof scripts. Every plan was run by a dedicated council seat agent performing real code audits — reading source, counting registrations, tracing workflows, and running commands.

### Overall Verdict: **CONDITIONAL PASS — 4 blockers must be resolved before production**

| Rating          | Count | Plans                              |
| --------------- | ----- | ---------------------------------- |
| **PASS**        | 2     | Plans 8, 9                         |
| **PARTIAL**     | 9     | Plans 1, 3, 4, 5, 6, 7, 10, 11, 12 |
| **CONDITIONAL** | 2     | Plans 13, 14                       |
| **FAIL**        | 1     | Plan 2                             |

---

## Master Verdict Table

| #   | Plan                      | Verdict                 | Score               | Key Finding                                                                                                                       |
| --- | ------------------------- | ----------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Static Analysis & Linting | **PARTIAL**             | 7/10                | extensions/ excluded from oxlint; server.mjs formatting drift; 7 dep vulns (1 critical)                                           |
| 2   | Unit Testing              | **FAIL**                | 0/48                | Zero unit tests for server.mjs; 48 testable functions identified; no exports = untestable                                         |
| 3   | Component Integration     | **PARTIAL**             | 8/11                | 156 gateways PASS, 78 tools PASS, but 60 MCP tools (not 71), 38 orphaned event types                                              |
| 4   | API Contract Testing      | **PARTIAL**             | 9/12                | 386 curl tests across 59 scripts; CRITICAL: `pathname` bug (FIXED); 23 untested routes                                            |
| 5   | Data Integrity            | **PARTIAL**             | 8/12                | 35 ledgers verified, 6 mutexes correct; 5 dual-write gaps; no backup mechanism; race in improvement ledger                        |
| 6   | Security Testing          | **PARTIAL**             | 8/12                | OWASP checks mostly pass; HIPAA provider routing solid; prompt injection unmitigated; PHI misses phone/email; audit gaps on reads |
| 7   | LLM/AI Testing            | **PARTIAL**             | 7/12                | 7/7 golden fixtures pass; EWMA+fallback solid; rubber-stamping detection NOT IMPLEMENTED; no cost tracking; no max_tokens         |
| 8   | External Integration      | **PASS**                | 11/12               | Token refresh, retry/backoff, pagination all solid; 4 low findings (SharePoint size, reconcile raw fetch)                         |
| 9   | End-to-End Testing        | **PASS**                | 12/12               | All 12 workflows trace end-to-end; no dead ends; draft lifecycle complete; scheduler 6-gate                                       |
| 10  | Performance Testing       | **PARTIAL**             | 5/12                | readJsonlLines() sync+uncached at 97 call sites; morning brief = 9 full ledger scans; no request concurrency limit                |
| 11  | Accessibility             | **PARTIAL**             | 5/12                | 80 aria-labels PASS; zero --vscode-\* theme vars; 3 CSS variable conflicts; 3 keyboard-inaccessible divs; no headings             |
| 12  | UI/UX (SDD 62)            | **PARTIAL**             | 92/172 (53%)        | Trust/transparency excellent (80%); flexibility FAIL (30%); help/docs FAIL (25%); information overload                            |
| 13  | Operational Readiness     | **CONDITIONAL-GO**      | 7/12 GO             | systemd ReadWritePaths misconfigured; no DR runbook; health endpoint shallow; capacity undocumented                               |
| 14  | User Acceptance           | **CONDITIONALLY READY** | 12/12 code-complete | All scenarios implemented; BLOCKED on Azure AD creds + LLM API key                                                                |

---

## Critical Issues (Must Fix Before Production)

### C-1: `pathname` undeclared — 3 dead routes [FIXED]

- **Location:** `server.mjs` lines 18302, 18303, 18451
- **Impact:** Shadow mode POST/GET and proposal resurrect POST routes threw ReferenceError
- **Resolution:** Changed `pathname` → `route` on all 3 lines. Verified with `node --check`.

### C-2: Zero unit tests for 48 testable functions

- **Location:** `sidecars/ted-engine/server.mjs` — no exports, no test files
- **Impact:** 36 pure functions and 12 extractable-core functions have zero test coverage
- **Blocker:** `server.mjs` has no exports — all functions are file-scoped
- **Required:** Extract pure functions to `server-utils.mjs` with named exports; add vitest config for sidecars/

### C-3: systemd ReadWritePaths misconfigured

- **Location:** `config/ted-engine.service` line 35
- **Impact:** Points to non-existent `data/` dir. With `ProtectSystem=strict`, sidecar WILL FAIL to write to `artifacts/`, `logs/`, `scheduler/`, `config/snapshots/`
- **Required:** Change to list `artifacts/`, `logs/`, `scheduler/`, `config/` directories

### C-4: Azure AD credentials empty (UAT blocker)

- **Location:** `config/graph.profiles.json` — both profiles have empty `tenant_id` and `client_id`
- **Impact:** Blocks ALL Graph integration: OAuth, calendar, mail, drafts, SharePoint, Planner, To Do
- **Required:** Operator must provide real Azure AD app registrations

---

## High-Priority Issues (Should Fix Before Release)

### H-1: Prompt injection unmitigated

- **Plans 6, 7:** Email bodies, meeting notes, triage content injected raw into LLM prompts at 5+ call sites
- **Fix:** Add `<user_content>...</user_content>` boundary markers; add system prompt instruction to treat delimited content as data only

### H-2: PHI redaction gaps

- **Plan 6:** `redactPhiFromMessages()` misses phone numbers and email addresses (both HIPAA Safe Harbor identifiers); gated behind opt-in `phi_auto_redact` flag
- **Fix:** Add phone/email patterns; make redaction default-on

### H-3: No backup mechanism

- **Plan 5:** 35 JSONL ledgers are the sole persistence layer with no backup/restore tooling
- **Fix:** Implement `POST /ops/backup` with mutex acquisition, directory copy, SHA-256 manifest

### H-4: readJsonlLines() is sync and uncached

- **Plan 10:** 97 call sites of synchronous `readFileSync` + `JSON.parse` block the event loop. Morning brief reads 9 ledgers per request
- **Fix:** Add per-ledger LRU cache with file-mtime invalidation; consider async reads for large ledgers

### H-5: Rubber-stamping detection not implemented

- **Plan 7:** Config at line 14203 defines 3 thresholds but NO runtime code reads them
- **Fix:** Implement `checkRubberStamping()` function comparing operator approval rate against thresholds

### H-6: Audit gaps on data reads

- **Plan 6:** `commitmentList()`, `listDealsEndpoint()`, and triage reads emit no audit events
- **Fix:** Add `appendEvent("commitment.listed")`, `appendEvent("deal.listed")` to read endpoints

### H-7: UI has zero VS Code theme integration

- **Plan 11:** `:host` block defines 14 hardcoded hex colors with no `--vscode-*` custom properties. 3 incompatible CSS variable naming schemes coexist
- **Fix:** Map all CSS tokens to `--vscode-*` variables

### H-8: Health endpoint lacks dependency verification

- **Plan 13:** `/status` returns uptime/counts but never probes Graph API, ledger I/O, or LLM availability
- **Fix:** Add dependency health checks to `/status` response

---

## Medium-Priority Issues

| #    | Issue                                             | Plan | Fix                                                               |
| ---- | ------------------------------------------------- | ---- | ----------------------------------------------------------------- |
| M-1  | extensions/ excluded from oxlint                  | 1    | Add `!extensions/ted-sidecar/` to oxlint ignorePatterns           |
| M-2  | 38 orphaned event types never emitted             | 3    | Emit governance events from sidecar; add scheduler.tick.completed |
| M-3  | 23 routes with no proof script coverage           | 4    | Add proof scripts for scheduler, ingestion, discovery, GTD routes |
| M-4  | 5 dual-write gaps (style deltas, shadow eval)     | 5    | Add appendEvent() to 5 identified callsites                       |
| M-5  | Race condition in improvement ledger              | 5    | Add `_improvementWriteRunning` mutex for expiry/resurrection      |
| M-6  | Mass assignment on LLM provider config            | 6    | Validate `per_job_overrides` keys against allowlist               |
| M-7  | No LLM cost tracking                              | 7    | Log `usage` field from API response; create `llm_usage.jsonl`     |
| M-8  | No max_tokens on LLM calls                        | 7    | Set max_tokens from output_contracts.json per intent              |
| M-9  | Commitment extraction has no confidence threshold | 7    | Filter out commitments with `confidence < 0.5`                    |
| M-10 | Reconciliation uses raw fetch()                   | 8    | Upgrade to `graphFetchWithRetry()` for retry+circuit breaker      |
| M-11 | No request concurrency limiter                    | 10   | Add maxConcurrentRequests counter with 503 backpressure           |
| M-12 | Compaction per-line appendFileSync                | 10   | Batch write: `join('\n')` then single writeFileSync               |
| M-13 | 6+ form inputs without labels                     | 11   | Add `for=` attributes to SharePoint/DeepWork/Calibration inputs   |
| M-14 | 3 keyboard-inaccessible clickable divs            | 11   | Add role="button", tabindex="0", @keydown handler                 |
| M-15 | No heading structure for 26 card titles           | 11   | Convert div.card-title to `<h2>` elements                         |
| M-16 | UI information overload (30 cards in "all" view)  | 12   | Add collapsible section groups; default collapsed                 |
| M-17 | Mixed CSS style paradigms                         | 12   | Unify to "Grounded Sophistication" token system                   |
| M-18 | No contextual help, tooltips, or docs links       | 12   | Add info-icon tooltip component; glossary for domain terms        |
| M-19 | No DR runbook documented                          | 13   | Create backup/restore procedure doc                               |
| M-20 | No capacity limits on JSONL ledgers               | 13   | Add MAX_LEDGER_SIZE_BYTES check before readJsonlLines()           |

---

## Low-Priority Issues

| #    | Issue                                                       | Plan |
| ---- | ----------------------------------------------------------- | ---- |
| L-1  | No circular dependency detection (madge)                    | 1    |
| L-2  | 7 npm audit vulnerabilities (transitive)                    | 1    |
| L-3  | server.mjs formatting drift                                 | 1    |
| L-4  | 4 controller functions silently swallow errors              | 3    |
| L-5  | Planner buckets route has policy entries but no handler     | 4    |
| L-6  | Deal JSON writes not atomic (writeFileSync, no temp+rename) | 5    |
| L-7  | Error message leakage via err.message in MCP/LLM handlers   | 6    |
| L-8  | Token record spread stores unexpected OAuth fields          | 6    |
| L-9  | Temperature hardcoded at 0.3                                | 7    |
| L-10 | No LLM retry on timeout                                     | 7    |
| L-11 | No mock/test server mode for CI                             | 8    |
| L-12 | upnToUserIdCache is unbounded                               | 10   |
| L-13 | normalizeRoutePolicyKey recreates regex array each call     | 10   |
| L-14 | No aria-live regions for dynamic content                    | 11   |
| L-15 | No role="progressbar" on visual bars                        | 11   |
| L-16 | getElementById() anti-pattern in 2 forms                    | 12   |
| L-17 | No skeleton screens or loading spinners                     | 12   |
| L-18 | No keyboard shortcuts                                       | 12   |
| L-19 | Startup recovery logs but does not retry deliveries         | 13   |
| L-20 | Adoption playbook doesn't reference ted-setup.sh            | 14   |

---

## Strengths Identified

The council identified these as production-quality strengths:

1. **Graph API resilience** (Plan 8 PASS): `graphFetchWithRetry()` with 3 retries, exponential backoff, 429 Retry-After, circuit breaker per workload group (7 groups). `graphFetchAllPages()` with nextLink following, 10-page max, truncation warnings.

2. **End-to-end workflow completeness** (Plan 9 PASS): All 12 major workflows trace from trigger to final output with no dead ends. Draft lifecycle has a complete 8-state FSM. Scheduler has 6-gate qualification with reentrancy mutex and failure backoff.

3. **Trust and transparency** (Plan 12 — 80%): Best-in-class for an AI dashboard. Confidence scores, change attribution, promotion criteria, correction taxonomy, risk acknowledgment all visible to operator.

4. **Domain language fidelity** (Plan 12 — 90%): Healthcare M&A terminology used correctly and consistently. Helper functions translate codes to operator-friendly labels.

5. **Approval gate defense-in-depth** (Plan 6 PASS): Three-layer defense: extension hook blocks agent self-approval, sidecar checks `x-ted-approval-source: operator` header, `REQUIRES_OPERATOR_CONFIRMATION` set enforced.

6. **HIPAA provider routing** (Plan 6 PASS): Case-insensitive entity lookup, `hipaa_cleared` check on provider config, fallback safety net on default provider.

7. **Scheduler production hardness** (Plans 9, 13): 6 gates per job (cron match, dedup, onboarding, budget, backoff, pause), reentrancy mutex, per-job try/catch, startup recovery for incomplete deliveries.

8. **Loading state discipline** (Plan 12): 36 loading indicators, 78 disabled states, per-card error isolation. Every async operation has visual feedback.

---

## Risk-Weighted Remediation Priority

If implementing fixes incrementally (highest risk-reduction per effort):

| Priority | Issue                                        | Effort   | Risk Reduction                                     |
| -------- | -------------------------------------------- | -------- | -------------------------------------------------- |
| 1        | C-2: Extract pure functions + add unit tests | 2-3 days | Catches regressions in 48 core functions           |
| 2        | H-1: Prompt injection boundaries             | 0.5 day  | Blocks adversarial email manipulation              |
| 3        | H-2: PHI redaction + default-on              | 0.5 day  | HIPAA compliance for phone/email                   |
| 4        | H-4: readJsonlLines() caching                | 1-2 days | Eliminates 97 sync blocking call sites             |
| 5        | C-3: systemd ReadWritePaths fix              | 10 min   | Unblocks systemd deployment                        |
| 6        | H-3: Backup mechanism                        | 1 day    | Prevents data loss catastrophe                     |
| 7        | H-7: VS Code theme integration               | 2-3 days | Fixes broken rendering in all non-light themes     |
| 8        | M-16: Collapsible card sections              | 1-2 days | Reduces cognitive overload from 30→5 visible items |
| 9        | H-5: Rubber-stamping detection               | 0.5 day  | Prevents governance bypass                         |
| 10       | H-6: Read audit events                       | 0.5 day  | HIPAA audit trail completeness                     |

---

## Metrics Summary

| Metric                         | Value                              |
| ------------------------------ | ---------------------------------- |
| Total checklist items audited  | ~379                               |
| Gateway methods verified       | 156/156                            |
| Agent tools verified           | 78/78                              |
| MCP tools found                | 60 (documented as 71 — stale)      |
| Event types in schema          | 212                                |
| Event types actively emitted   | 174 (82%)                          |
| JSONL ledgers verified         | 35/35                              |
| Pure functions identified      | 36 (+ 12 extractable cores)        |
| Pure functions with unit tests | 0/48 (0%)                          |
| Proof scripts                  | 80 (59 behavioral HTTP, 21 static) |
| Behavioral test assertions     | 386 curl calls                     |
| Routes in sidecar              | 103                                |
| Routes with proof coverage     | ~80 (78%)                          |
| UI/UX score (SDD 62)           | 92/172 (53%)                       |
| Controller functions verified  | 62/64 follow guard pattern         |
| Security checks passed         | 8/12                               |
| Operational readiness          | 7/12 GO, 5/12 CONDITIONAL          |
| UAT scenarios code-complete    | 12/12                              |
| Critical bugs found and fixed  | 1 (`pathname` → `route`)           |

---

## Council Signatures

| Seat | Role                  | Plans Executed | Verdict Issued             |
| ---- | --------------------- | -------------- | -------------------------- |
| 1    | Software Architecture | 1, 13          | PARTIAL, CONDITIONAL-GO    |
| 2    | Test Engineering      | 2              | FAIL                       |
| 3    | Integration Quality   | 3, 11          | PARTIAL, PARTIAL           |
| 4    | API Contracts         | 4              | PARTIAL                    |
| 5    | Data Integrity        | 5              | PARTIAL                    |
| 6    | Security & HIPAA      | 6              | PARTIAL                    |
| 7    | AI/ML Quality         | 7              | PARTIAL                    |
| 8    | External Integration  | 8              | PASS                       |
| 9    | Healthcare M&A Ops    | 9, 12, 14      | PASS, PARTIAL, CONDITIONAL |
| 10   | Clinical PHI          | 10, 12         | PARTIAL, PARTIAL           |

---

_This report is a point-in-time assessment. Re-execute after remediation using the execution order in SDD 64._
