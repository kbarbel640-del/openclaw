# External Tool Verifier — Handoff Document

> **Purpose:** Everything needed to continue this work in a fresh context window.

## What We're Building

An **external tool verification gateway** for OpenClaw that consults an HTTP webhook and/or a Telegram approval bot before any tool call executes. It's a new `tools.verifier` config subsystem that plugs into the existing `before_tool_call` hook pipeline.

**Use cases:**
- Route tool calls to another LLM for safety analysis
- Human-in-the-loop approval via Telegram inline keyboard (Allow/Deny)
- Enterprise policy server / OPA integration
- Audit logging

## Current State

| Artifact | Path | Status |
|----------|------|--------|
| Design doc | `docs/plans/2026-02-12-external-tool-verifier-design.md` | Committed to `main` |
| Implementation plan | `docs/plans/2026-02-12-external-tool-verifier-plan.md` | Committed (original), updated with security fixes (unstaged) |
| HTML plan rendering | `docs/plans/2026-02-12-external-tool-verifier-plan.html` | Created, not committed |
| Visual brief | `docs/plans/2026-02-12-external-tool-verifier-brief.html` | Created, not committed |
| This handoff | `docs/plans/2026-02-12-external-tool-verifier-handoff.md` | Created, not committed |
| Implementation code | — | **Not started** |

### Git State

The design doc and original plan were committed in previous commits:
```
git log --oneline -5
```
The plan.md has been updated with security review fixes but those changes are **unstaged**. The HTML files and this handoff are untracked.

## Architecture

```
Tool call
  -> Layer 1: Tool Policy (allow/deny/profile)
  -> Layer 2: safeBins/allowlist (exec only)
  -> Layer 3: Verifier (NEW — webhook + Telegram)
  -> Layer 4: Execute tool
```

The verifier runs **after** existing security checks and **before** tool execution. It's purely additive — existing `tool-policy.ts`, `exec-approvals.ts`, sandbox systems remain untouched.

## Key Files in the Codebase

These are the files you need to understand and modify:

| File | Role | What Changes |
|------|------|-------------|
| `src/config/types.tools.ts` | Config type definitions | Add `VerifierConfig` types (~line 196), add `verifier?` field to `AgentToolsConfig` (~198) and `ToolsConfig` (~326) |
| `src/config/zod-schema.agent-runtime.ts` | Zod validation | Add `VerifierSchema` (~line 260), add to `AgentToolsSchema` (~304) and `ToolsSchema` (~561) |
| `src/agents/tool-policy.ts` | Tool groups/normalization | **No changes** — reuse `normalizeToolName`, `expandToolGroups` |
| `src/agents/pi-tools.before-tool-call.ts` | Hook pipeline | Add `verifierConfig` param, call `runVerifier()` after plugin hooks |
| `src/agents/pi-tools.ts` | Tool creation/wiring | Pass `verifierConfig` + `globalVerifierConfig` into `wrapToolWithBeforeToolCallHook` (~line 442) |
| `src/plugins/hooks.ts` | Plugin hook runner | **No changes** |
| `src/infra/exec-approvals.ts` | Exec approval system | **No changes** |
| `src/telegram/bot.ts` | Existing Telegram bot | **No changes** — verifier uses separate bot instance with direct API calls |

### New Files to Create

```
src/agents/verifier/
  scope.ts          — include/exclude scope matcher
  scope.test.ts
  webhook.ts        — HTTP webhook client with HMAC signing + param redaction
  webhook.test.ts
  telegram.ts       — Telegram approval (direct API, no long-polling)
  telegram.test.ts
  index.ts          — Orchestrator (coordinates webhook + Telegram)
  index.test.ts
  integration.test.ts

src/agents/pi-tools.verifier.test.ts  — Pipeline integration tests
```

## Implementation Plan (9 Tasks)

Full code is in `docs/plans/2026-02-12-external-tool-verifier-plan.md`. Summary:

1. **Config Types** — Add `VerifierConfig`, `VerifierScopeConfig`, `VerifierWebhookConfig`, `VerifierTelegramConfig` to `types.tools.ts`
2. **Zod Schema** — Validation with HTTPS enforcement (reject `http://` in production), `allowedUserIds`, mutual exclusivity check for include/exclude
3. **Scope Matcher** — `isToolInVerifierScope()` using `normalizeToolName` + `expandToolGroups`
4. **Webhook Client** — `callWebhookVerifier()` with HMAC-SHA256, `redactToolParams()` for write/edit content, 64KB response limit, 500-char reason truncation
5. **Telegram Verifier** — `callTelegramVerifier()` using direct `bot.api.getUpdates()` polling (NOT `bot.start()` long-polling), `isAllowedSender()` validation, `formatTelegramApprovalMessage()`
6. **Orchestrator** — `runVerifier()` coordinates webhook→Telegram, `resolveFailMode()` with most-restrictive-wins, `resolveVerifierConfig()`
7. **Pipeline Wiring** — Add verifier to `pi-tools.before-tool-call.ts`, pass config from `pi-tools.ts`
8. **Docs** — Add verifier section to `docs/gateway/sandbox-vs-tool-policy-vs-elevated.md`
9. **Integration Tests** — End-to-end with real HTTP server

Each task follows TDD: write failing test → implement → verify pass → commit.

## Security Review Findings (Incorporated)

A tech lead review identified these issues, all addressed in the updated plan:

### P0 (Fixed)
- **Telegram bot lifecycle:** Original created `new Bot()` + `bot.start()` per request → 409 Conflict errors, competing polling connections, lost callbacks. **Fix:** Use direct `bot.api` calls with `getUpdates` polling, correlated by `message_id`.
- **Telegram callback race:** Message sent before polling started → callbacks lost by `drop_pending_updates`. **Fix:** Eliminated by not using long-polling at all.

### P1 (Fixed)
- **HTTPS enforcement:** Zod rejects `http://` webhook URLs in production, warns in dev.
- **Param redaction:** `redactToolParams()` strips `content` from write/edit/apply_patch before sending to external endpoints.
- **Sender validation:** `telegram.allowedUserIds` restricts who can tap Allow/Deny. Unauthorized taps get alert.
- **failMode most-restrictive-wins:** `resolveFailMode()` ensures per-agent `"allow"` cannot weaken global `"deny"`.

### Acknowledged Risks (Not Addressed Yet)
- Webhook as exfiltration channel (receives all tool params for verified tools)
- Webhook as DoS vector (unreachable + failMode deny blocks all verified tools)
- TOCTOU gap between verifier approval and execution (largely theoretical in single-threaded Node)
- No retry/backoff for transient webhook failures (429, 503)
- No webhook response signing (only request signing via HMAC)

## Config Schema

```jsonc
{
  "tools": {
    "verifier": {
      "enabled": true,
      "failMode": "deny",           // "deny" (default) | "allow"
      "scope": {
        "include": ["exec", "write", "edit"]  // OR "exclude": [...]
      },
      "webhook": {
        "url": "https://my-verifier.example.com/verify",
        "timeout": 30,
        "headers": { "Authorization": "Bearer ${VERIFIER_TOKEN}" },
        "secret": "${VERIFIER_HMAC_SECRET}"
      },
      "telegram": {
        "enabled": true,
        "botToken": "${TELEGRAM_BOT_TOKEN}",
        "chatId": "123456789",
        "timeout": 120,
        "allowedUserIds": [123456789]
      }
    }
  }
}
```

Per-agent override: `agents.list[].tools.verifier` (same schema, most-restrictive-wins for failMode).

## Webhook Protocol

**Request** (POST):
```json
{
  "version": 1,
  "timestamp": "2026-02-12T15:30:00Z",
  "requestId": "uuid-v4",
  "tool": {
    "name": "exec",
    "params": { "command": "curl example.com" }
  },
  "context": {
    "agentId": "main",
    "sessionKey": "agent:main:main",
    "messageProvider": "telegram"
  }
}
```

Note: `params` are **redacted** — write/edit `content` field replaced with `[REDACTED: N chars]`.

**Response**: `{ "decision": "allow" }` or `{ "decision": "deny", "reason": "..." }`

HMAC signature in `X-OpenClaw-Signature` header when `secret` is configured.

## Future Form Factors Discussed

Beyond the two built-in verifiers (webhook + Telegram), we discussed:

| Form Factor | Ship As | Notes |
|------------|---------|-------|
| Web dashboard with passkeys | **Candidate for built-in** | Most compelling next built-in — self-contained, high-security, rich context |
| Slack / Discord bot | Example webhook backend | Richer UIs (Block Kit), workplace-native |
| OPA policy engine | Example webhook backend | Automated, no human needed, best for production scale |
| Desktop notifications | Example | macOS/Linux native, zero deps, no auth |
| Email magic links | Example | High latency, good for deploy gates |
| CLI prompt | Consider | Generalization of existing exec ask modes |

## How to Continue

### Option A: Execute the Plan
```
# In this conversation or a new one:
# Use superpowers:executing-plans skill with the plan file
```

### Option B: Start Fresh Implementation
Read the plan at `docs/plans/2026-02-12-external-tool-verifier-plan.md` and implement task by task. Each task has complete code, exact file paths, test commands, and commit messages.

### First Steps
1. Commit the updated plan.md (has security fixes)
2. Optionally create a worktree/branch for the implementation
3. Start with Task 1 (config types) — it's the foundation everything else depends on

## Test Commands

```bash
# Run specific test file
pnpm vitest run --config vitest.unit.config.ts -- src/agents/verifier/scope.test.ts

# Run all config tests (after Tasks 1-2)
pnpm vitest run --config vitest.unit.config.ts -- src/config

# Run full fast test suite
pnpm test:fast
```

## Dependencies (Already in Project)

- `grammy` — Telegram Bot API
- `undici` — HTTP client
- `zod` — Schema validation
- `vitest` — Testing
