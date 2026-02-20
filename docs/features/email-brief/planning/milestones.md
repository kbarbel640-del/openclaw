# Implementation Plan: ADR-001 Email Brief Extension

**Date:** 2026-02-20
**Planner:** Code Goal Planner Agent
**Inputs:** ADR-001, Shift-Left Testing Report, QCSD Ideation Reports (HTSM, SFDIPOT, Testability)

---

## Current State

### Existing Modules Relevant to This Feature

| File                                            | Purpose                                                     | Reusability                                  |
| ----------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------- |
| `extensions/ask-agent/index.ts`                 | Reference extension — command registration, Cloud.ru A2A    | Structural pattern only                      |
| `extensions/llm-task/index.ts`                  | LLM invocation extension — `runEmbeddedPiAgent` usage       | Dynamic import pattern, result extraction    |
| `extensions/llm-task/src/llm-task-tool.ts`      | Detailed `runEmbeddedPiAgent` params construction           | Parameter shape, timeout handling            |
| `extensions/llm-task/src/llm-task-tool.test.ts` | Test pattern — `vi.mock()` for runner, `fakeApi()` factory  | Test scaffold, mock patterns                 |
| `src/agents/pi-embedded-runner.ts`              | Re-exports `runEmbeddedPiAgent`                             | Import target                                |
| `src/agents/pi-embedded-runner/run/params.ts`   | `RunEmbeddedPiAgentParams` type definition                  | Parameter reference                          |
| `src/agents/pi-embedded-runner/types.ts`        | `EmbeddedPiRunResult` type                                  | Return type reference                        |
| `src/plugins/types.ts`                          | `OpenClawPluginApi`, `PluginCommandContext`, `ReplyPayload` | SDK interface contract                       |
| `src/auto-reply/chunk.ts`                       | `chunkMarkdownText()`, `resolveTextChunkLimit()`            | Text chunking for Telegram (4000 char limit) |
| `src/auto-reply/types.ts`                       | `ReplyPayload` type                                         | Return type for command handlers             |
| `extensions/googlechat/src/api.test.ts`         | `vi.stubGlobal("fetch", ...)` mock pattern                  | HTTP mocking approach                        |

### Integration Points

1. **Plugin loader** — reads `extensions/email-brief/openclaw.plugin.json`, calls `register(api)`
2. **Command dispatcher** — routes `/email_brief` to registered handler
3. **`runEmbeddedPiAgent`** — internal runner at `src/agents/pi-embedded-runner.js`
4. **Config system** — `api.pluginConfig` for plugin-specific settings, `api.config` for global config
5. **Telegram chunking** — `chunkMarkdownText()` from `src/auto-reply/chunk.ts` for response splitting

### Conventions from Adjacent Code

- ESM imports with `.js` extension
- `import type { X }` for type-only imports
- Colocated tests: `*.test.ts` next to source
- Plugin entry: `export default function register(api: OpenClawPluginApi)`
- Dynamic import for `runEmbeddedPiAgent` with try/catch fallback
- `fakeApi()` factory in tests for `OpenClawPluginApi` mock
- `vi.stubGlobal("fetch", ...)` for HTTP call mocking
- `vi.mock("path", () => ({ fn: vi.fn() }))` for module mocking

---

## Goal State

### New Files to Create

```
extensions/email-brief/
  openclaw.plugin.json          # Plugin manifest with configSchema
  index.ts                      # Entry point: registerCommand, orchestration
  types.ts                      # Shared types (ParsedArgs, EmailMessage, GmailConfig)
  parse-args.ts                 # Argument parser (period, filters)
  parse-args.test.ts            # Unit tests: all argument combinations
  gmail-query.ts                # Gmail search query builder
  gmail-query.test.ts           # Unit tests: query construction
  gmail-body.ts                 # MIME traversal, base64url decode, HTML stripping
  gmail-body.test.ts            # Unit tests: diverse MIME structures
  gmail-client.ts               # JWT auth, token caching, Gmail API calls
  gmail-client.test.ts          # Integration tests: mocked HTTP
  summarize.ts                  # Prompt builder + LLM invocation
  summarize.test.ts             # Integration tests: mocked runEmbeddedPiAgent
  index.test.ts                 # E2E tests: full command handler with all mocks
```

### Existing Files to Modify

None. The extension is self-contained within `extensions/email-brief/`.

### Configuration

Plugin config in `openclaw.json`:

```json
{
  "plugins": {
    "email-brief": {
      "userEmail": "user@company.com",
      "maxEmails": 20,
      "model": null,
      "language": "auto"
    }
  }
}
```

Environment variables:

- `GMAIL_SERVICE_ACCOUNT_KEY_PATH` — path to SA JSON key file
- `GMAIL_SERVICE_ACCOUNT_KEY` — inline SA JSON key (fallback)
- `GMAIL_USER_EMAIL` — impersonated email (override for config)

---

## Milestones

### Milestone 1: Plugin Scaffold, Types, and Argument Parser

**Depends on:** None
**Estimated scope:** S

**Files to create:**

- `extensions/email-brief/openclaw.plugin.json` — Plugin manifest with `id`, `name`, `description`, `configSchema` (JSON Schema for `userEmail`, `maxEmails`, `model`, `language`)
- `extensions/email-brief/types.ts` — Shared types: `ParsedArgs` (period, from, to, urgent, unread, freeText), `EmailMessage` (id, from, subject, date, snippet, body), `GmailConfig` (serviceAccountKey, userEmail, maxEmails)
- `extensions/email-brief/parse-args.ts` — Parse `/email_brief [filters...] [period]` arguments. Period: last arg matching `/^\d+[hdwm]$/`, default `"1d"`. Filters: `from:`, `to:`, `urgent`, `unread`, free text
- `extensions/email-brief/parse-args.test.ts` — Unit tests: default invocation, period-only, hour/day/week/month periods, from filter, urgent flag, multiple filters combined, free text, edge cases (empty string, invalid period format)

**Acceptance criteria:**

- [ ] Plugin manifest is valid JSON and contains required fields (id, name, description, configSchema)
- [ ] `parseArgs("")` returns `{ period: "1d", filters: {} }`
- [ ] `parseArgs("7d")` returns `{ period: "7d", filters: {} }`
- [ ] `parseArgs("from:user@test.com 7d")` returns `{ period: "7d", filters: { from: "user@test.com" } }`
- [ ] `parseArgs("urgent 3d")` returns `{ period: "3d", filters: { urgent: true } }`
- [ ] `parseArgs("from:boss@work.com urgent 2d")` returns all three fields correctly
- [ ] All tests pass with `pnpm test extensions/email-brief/parse-args.test.ts`
- [ ] `pnpm check` passes

**Test plan:**

- Unit: ~10 test cases covering all argument combinations from Gherkin acceptance tests
- Maps to requirements R-01, R-02, R-03

**Risks:** F-02 (period/free-text ambiguity) — mitigated by documenting the "last token matching period regex" convention

---

### Milestone 2: Gmail Query Builder and Body Extraction

**Depends on:** M1 (uses `ParsedArgs` and `EmailMessage` types)
**Estimated scope:** M

**Files to create:**

- `extensions/email-brief/gmail-query.ts` — Build Gmail search query string from `ParsedArgs`. Default: `newer_than:1d in:inbox`. With period: `newer_than:{period} in:inbox`. With from: `from:{email} newer_than:{period} in:inbox`. Urgent: add `is:important OR label:urgent OR subject:(срочно OR urgent OR ASAP)`
- `extensions/email-brief/gmail-query.test.ts` — Unit tests: default query, with period, with from filter, with to filter, urgent query, unread filter, free text appended, combined filters
- `extensions/email-brief/gmail-body.ts` — Extract email body from Gmail API message response. Recursive MIME traversal of `payload.parts[]` preferring `text/plain` over `text/html`. Base64url decoding via `Buffer.from(data, "base64url")`. HTML tag stripping for HTML-only messages (remove `<style>`, `<script>`, decode entities, preserve `<br>`/`<p>` as newlines). Truncation to `MAX_EMAIL_BODY_CHARS` (2000) with `[...truncated]` marker
- `extensions/email-brief/gmail-body.test.ts` — Unit tests: single-part text/plain, multipart/alternative (text + html), HTML-only (tag stripping), nested MIME (5+ levels), base64url decoding, empty body, truncation at limit, corrupt base64 graceful fallback

**Acceptance criteria:**

- [ ] `buildGmailQuery({ period: "1d", filters: {} })` returns `"newer_than:1d in:inbox"`
- [ ] `buildGmailQuery({ period: "7d", filters: { from: "a@b.com" } })` returns `"from:a@b.com newer_than:7d in:inbox"`
- [ ] `buildGmailQuery({ period: "1d", filters: { urgent: true } })` includes urgency keywords
- [ ] `extractBody(plainTextMessage)` returns decoded text
- [ ] `extractBody(htmlOnlyMessage)` returns stripped text without HTML tags
- [ ] `extractBody(multipartMessage)` prefers text/plain over text/html
- [ ] Body truncation at 2000 chars works correctly
- [ ] All tests pass with `pnpm test extensions/email-brief/gmail-query.test.ts extensions/email-brief/gmail-body.test.ts`

**Test plan:**

- Unit: ~8 tests for query builder, ~10 tests for body extraction
- Maps to requirements R-03, R-08, R-10, R-11 and missing requirements MR-04, MR-05, MR-06

**Risks:** C-1.1 (MIME traversal depth), C-1.2 (HTML stripping quality), F-07 (base64url)

---

### Milestone 3: JWT Authentication and Gmail API Client

**Depends on:** M1 (uses types)
**Estimated scope:** L

**Files to create:**

- `extensions/email-brief/gmail-client.ts` — Three responsibilities:
  1. **JWT auth**: Sign JWT with RS256 via `node:crypto` (claims: `iss`, `sub`, `scope`, `aud`, `iat`, `exp`). Exchange JWT for access token at `https://oauth2.googleapis.com/token`. Cache token with 55-minute refresh margin (not 60, per T-01 mitigation)
  2. **Gmail API calls**: `listMessages(query, maxResults)` → message ID list. `getMessages(ids)` → full message objects. Concurrent fetching with concurrency cap of 5 (per SC-5.2, P-6.2). Per-request 401 retry with token refresh (per R-2.2)
  3. **Config resolution**: Read SA key from `GMAIL_SERVICE_ACCOUNT_KEY_PATH` file or `GMAIL_SERVICE_ACCOUNT_KEY` inline JSON. Read user email from `GMAIL_USER_EMAIL` env or plugin config. Validate required fields, return actionable error messages
- `extensions/email-brief/gmail-client.test.ts` — Tests with mocked `fetch`:
  - JWT construction: verify header, claims, signature structure
  - Token exchange: mock token endpoint, verify access token cached
  - Token caching: use `vi.useFakeTimers()`, verify refresh after 55 min
  - Token refresh on 401: mock Gmail returning 401, verify retry with new token
  - List messages: mock Gmail API, verify query and maxResults params
  - Get messages: mock concurrent fetches, verify concurrency cap
  - Error handling: missing SA key, invalid JSON, token endpoint 401, Gmail 403 (delegation error with actionable message), Gmail 429

**Acceptance criteria:**

- [ ] JWT is signed with RS256 via `node:crypto` (no npm dependencies)
- [ ] JWT contains `iss` (client_email), `sub` (user email), `scope` (gmail.readonly), `aud` (token endpoint), `iat`, `exp` (1h)
- [ ] Access token is cached and reused within 55-minute window
- [ ] Token is refreshed after 55 minutes (not 60)
- [ ] Gmail API list call uses correct query and maxResults
- [ ] Message fetching respects concurrency cap of 5
- [ ] On Gmail 401, token is refreshed and request retried once
- [ ] On Gmail 403, error message mentions domain-wide delegation setup
- [ ] Missing credentials produce actionable error messages
- [ ] Private key material never appears in error messages (D-01)
- [ ] All tests pass

**Test plan:**

- Unit: ~5 tests for JWT construction and config validation
- Integration: ~12 tests for token caching, API calls, error paths
- Maps to requirements R-04, R-05, R-06, R-07, R-09 and risks TR-01, TR-02, TR-07, TR-09

**Risks:** S-4.1 (private key exposure), R-2.2 (token refresh race), T-01 (token expiry mid-request), O-01 (delegation misconfiguration)

---

### Milestone 4: LLM Summarization

**Depends on:** M1 (uses `EmailMessage` type)
**Estimated scope:** M

**Files to create:**

- `extensions/email-brief/summarize.ts` — Two parts:
  1. **Prompt builder**: Construct system prompt with summarization instructions (priority tiers, language detection, Telegram markdown format, anti-prompt-injection instructions). Build user message from `EmailMessage[]` wrapped in `<email index="N">` tags (per D-08 mitigation). Respect total prompt budget of 30000 chars (per SC-5.1). Truncate individual emails proportionally if total exceeds budget. Urgent mode: add urgency scoring (0-10) and draft reply instructions
  2. **LLM invocation**: Dynamic import of `runEmbeddedPiAgent` (same pattern as llm-task). Call with `disableTools: true`, `timeoutMs: 60000` (per R-2.3). Extract text from `result.payloads`. Fallback to formatted email metadata list if LLM returns empty/error (per F-04 mitigation)
- `extensions/email-brief/summarize.test.ts` — Tests with mocked `runEmbeddedPiAgent`:
  - Prompt contains all email subjects
  - Prompt includes `<email>` content delimiters
  - Prompt includes anti-injection instruction
  - `disableTools: true` is always passed
  - `timeoutMs` is 60000
  - Urgent mode adds urgency scoring instructions
  - Total prompt respects 30000 char budget
  - Empty LLM payloads trigger fallback
  - LLM error payloads trigger fallback
  - Fallback format: numbered list of `[sender] subject (date)`

**Acceptance criteria:**

- [ ] `runEmbeddedPiAgent` is called with `disableTools: true`
- [ ] `timeoutMs` is 60000
- [ ] Prompt wraps email content in `<email>` tags
- [ ] Prompt includes anti-injection system instruction
- [ ] Prompt includes formatting instructions for Telegram markdown
- [ ] Total prompt does not exceed 30000 characters
- [ ] When urgent flag is set, prompt includes urgency scoring instructions
- [ ] When LLM returns empty payloads, fallback metadata list is returned
- [ ] When LLM returns error payloads, fallback metadata list is returned
- [ ] All tests pass

**Test plan:**

- Unit: ~4 tests for prompt construction
- Integration: ~6 tests for LLM invocation and fallback
- Maps to requirements R-12, R-13 and risks F-01, TR-10, CO-8.1

**Risks:** F-01 (LLM output quality), CO-8.2 (prompt quality varies across models), D-08 (prompt injection)

---

### Milestone 5: Command Handler and Integration

**Depends on:** M2, M3, M4 (uses all modules)
**Estimated scope:** M

**Files to create:**

- `extensions/email-brief/index.ts` — Plugin registration and command handler:
  1. `export default function register(api)` — register `/email_brief` command with `requireAuth: true`
  2. Handler orchestration: validate config → parse args → build query → authenticate → list messages → handle empty inbox → get message details → extract bodies → summarize → format response → chunk for Telegram
  3. Error handling waterfall: config errors → auth errors → Gmail API errors → body extraction errors (skip, continue) → LLM errors → formatting errors. Each level catches and returns a user-friendly message
  4. Error sanitization: `sanitizeError()` helper strips private key patterns (`-----BEGIN.*PRIVATE KEY-----`), access tokens (`Bearer ...`), and file paths from error messages (per D-01, S-4.3)
  5. Response chunking: if response exceeds 3900 chars, use `chunkMarkdownText()` from `src/auto-reply/chunk.ts`. Return first chunk as `text`, note total parts
  6. Config resolution: `GMAIL_USER_EMAIL` env > `pluginConfig.userEmail` > error. `GMAIL_SERVICE_ACCOUNT_KEY_PATH` > `GMAIL_SERVICE_ACCOUNT_KEY` > error. `pluginConfig.maxEmails` > 20 default
- `extensions/email-brief/index.test.ts` — E2E tests with all dependencies mocked:
  - Full happy path: 5 emails → LLM summary → formatted response
  - Authorization rejection: `isAuthorizedSender: false` → rejected, no Gmail calls
  - Missing credentials → actionable error message
  - Empty inbox → friendly "no emails found" message
  - Gmail API error → graceful error message
  - LLM timeout → fallback to metadata list
  - Long response → chunked correctly
  - Error messages do not contain private key material

**Acceptance criteria:**

- [ ] Command registered with `requireAuth: true`
- [ ] Unauthorized sender is rejected before any Gmail API calls
- [ ] Full happy path works: parse → auth → fetch → summarize → return
- [ ] Missing credentials return actionable setup instructions
- [ ] Empty inbox returns friendly message with period-widening suggestion
- [ ] Gmail API errors return graceful messages
- [ ] LLM failures fall back to metadata list
- [ ] Response exceeding 3900 chars is chunked
- [ ] Error messages never contain private key material or access tokens
- [ ] `pnpm check` passes for all files
- [ ] All tests pass

**Test plan:**

- E2E: ~8 tests covering full command flow with all mocks
- Maps to requirements R-14, R-15, R-16, R-17, R-18, R-19 and missing requirements MR-01, MR-02, MR-03, MR-08

**Risks:** S-4.4 (requireAuth bypass), MR-01 (Telegram chunking), TR-09 (private key exposure)

---

## Dependency DAG

```
M1 (Plugin Scaffold + Args Parser)
├── M2 (Query Builder + Body Extraction)
│   └── M5 (Command Handler + Integration) ← final
├── M3 (JWT Auth + Gmail API Client)
│   └── M5
└── M4 (LLM Summarization)
    └── M5
```

Simplified view:

```
    M1
   / | \
  M2 M3 M4
   \ | /
    M5
```

---

## Parallelization Opportunities

| Wave | Milestones | Can Run in Parallel | Notes                                               |
| ---- | ---------- | ------------------- | --------------------------------------------------- |
| 1    | M1         | No (foundation)     | Creates types used by all other milestones          |
| 2    | M2, M3, M4 | Yes                 | All depend only on M1 types; no mutual dependencies |
| 3    | M5         | No (integration)    | Wires together all modules from M2-M4               |

**Wave 2 parallelization details:**

- **M2** (query builder + body extraction) — Pure functions, no I/O, fully independent
- **M3** (JWT auth + Gmail client) — I/O via mocked fetch, independent of M2 and M4
- **M4** (LLM summarization) — I/O via mocked `runEmbeddedPiAgent`, independent of M2 and M3

All three Wave 2 milestones read from `types.ts` (created in M1) but do not import from each other. They can be implemented by separate Task agents in parallel.

---

## Risk Cross-Reference

| Milestone | Risks Addressed                                                                                                                                            | Risks Introduced                  |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| M1        | F-02 (arg ambiguity — documented)                                                                                                                          | None                              |
| M2        | C-1.1 (MIME depth), C-1.2 (HTML stripping), F-07 (base64url), MR-04/05/06                                                                                  | None                              |
| M3        | TR-01 (rate limits), TR-02 (delegation), TR-07 (network), TR-09 (key exposure), T-01 (token expiry), R-2.2 (refresh race), D-01 (private key sanitization) | Complexity of token caching state |
| M4        | F-01 (LLM quality), TR-10 (FM quality), CO-8.1 (disableTools), D-08 (prompt injection), D-05/D-06 (prompt truncation, PII redaction)                       | None                              |
| M5        | S-4.4 (requireAuth), MR-01 (chunking), MR-02 (truncation), MR-03 (sender auth), MR-08 (empty inbox)                                                        | Integration complexity            |

### Unaddressed Risks (P2/P3 — Post-Implementation)

| Risk                                            | ID    | Reason Deferred                               |
| ----------------------------------------------- | ----- | --------------------------------------------- |
| Setup validation command (`/email_brief_check`) | O-02  | Nice-to-have, not blocking                    |
| Promise-based mutex for token refresh           | T-06  | Single-user context, race condition is benign |
| Telegram MarkdownV2 sanitization                | I-06  | Gateway handles plain text fallback           |
| Charset encoding (windows-1251)                 | C-1.4 | Edge case, can add later                      |
| Config schema validation (Typebox)              | S-04  | JSON Schema in manifest suffices for now      |
| Bun runtime compatibility                       | P-03  | Node 22 is the primary target                 |
