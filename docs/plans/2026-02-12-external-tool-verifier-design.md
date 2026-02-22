---
title: External Tool Verifier
summary: "Pre-execution verification gateway: HTTP webhook and built-in Telegram approval for tool calls"
status: draft
date: 2026-02-12
---

# External Tool Verifier

## Problem

OpenClaw's existing security layers (tool policy, exec allowlist/safeBins, sandbox) control **what** can run and **where**. But there is no mechanism to consult an **external authority** before executing a tool call. Use cases:

- Route tool calls to another LLM for safety analysis before execution
- Send real-time approval requests to a human via Telegram (or another messaging service)
- Integrate with enterprise policy servers or audit systems

## Design

### Architecture

The verifier is a new config-driven subsystem (`tools.verifier`) that plugs into the existing `before_tool_call` hook pipeline. It runs **after** the existing security checks (tool policy, safeBins/allowlist) and **before** tool execution.

```
Tool call
  -> Tool policy filter (allow/deny/profile)
  -> safeBins/allowlist (exec only)
  -> Verifier (NEW: webhook + Telegram)
  -> Execute tool
```

This layering means the verifier never sees tool calls that are already blocked by existing policy. It only gates calls that would otherwise proceed.

### Config Schema

```jsonc
// openclaw.json
{
  "tools": {
    "verifier": {
      // Master switch
      "enabled": true,

      // Which tools require verification
      "scope": {
        // Use ONE of include/exclude (mutually exclusive)
        "include": ["exec", "write", "edit", "apply_patch"]
        // OR: "exclude": ["read", "session_status"]
      },

      // Behavior when verifier is unreachable or times out
      "failMode": "deny",  // "deny" | "allow"

      // ── Webhook verifier ──
      "webhook": {
        "url": "https://my-verifier.example.com/verify",
        "timeout": 30,  // seconds
        "headers": {
          "Authorization": "Bearer ${VERIFIER_TOKEN}"
        },
        // Optional HMAC-SHA256 request signing
        "secret": "${VERIFIER_HMAC_SECRET}"
      },

      // ── Built-in Telegram verifier ──
      "telegram": {
        "enabled": false,
        "botToken": "${TELEGRAM_VERIFIER_BOT_TOKEN}",
        "chatId": "123456789",
        "timeout": 120,  // seconds to wait for user tap
        "allowedUserIds": [123456789]  // only these users can tap Allow/Deny
      }
    }
  }
}
```

Per-agent overrides follow existing patterns: `agents.list[].tools.verifier` with the same schema. Note: `failMode` uses **most-restrictive-wins** — a per-agent `failMode: "allow"` cannot weaken a global `failMode: "deny"`.

### Webhook Protocol

**Request** (HTTP POST to `webhook.url`):

```json
{
  "version": 1,
  "timestamp": "2026-02-12T15:30:00Z",
  "requestId": "uuid-v4",
  "tool": {
    "name": "exec",
    "params": {
      "command": "curl https://example.com",
      "workdir": "/workspace"
    }
  },
  "context": {
    "agentId": "main",
    "sessionKey": "agent:main:main",
    "messageProvider": "telegram"
  }
}
```

When `secret` is configured, the request includes an `X-OpenClaw-Signature` header containing the HMAC-SHA256 hex digest of the raw request body.

**Response** (expected JSON):

```json
{
  "decision": "allow",
  "reason": "optional text shown to agent on deny"
}
```

| Condition | Behavior |
|-----------|----------|
| `decision: "allow"` | Tool call proceeds |
| `decision: "deny"` | Tool call blocked; `reason` shown as error |
| Non-2xx HTTP status | Trigger `failMode` |
| Timeout | Trigger `failMode` |
| Malformed response | Trigger `failMode` |

### Built-in Telegram Verifier

Uses the existing `grammy` dependency to:

1. Send a message to the configured `chatId` with inline keyboard buttons:
   ```
   Tool verification request

   Tool: exec
   Command: curl https://example.com
   Agent: main
   Session: agent:main:main

   [Allow]  [Deny]
   ```
2. Wait up to `timeout` seconds for a button callback
3. Return the decision to the verifier pipeline

Both webhook and Telegram can be enabled simultaneously; both must approve for the tool call to proceed.

### Scope Matching

The verifier scope uses the same normalized tool names as the existing tool policy system (`normalizeToolName` from `tool-policy.ts`).

- `scope.include`: only listed tools are verified; all others pass through
- `scope.exclude`: all tools are verified except those listed
- No scope config: all tools are verified
- `scope.include` and `scope.exclude` are mutually exclusive; config validation rejects both

### Fail Mode

- `"deny"` (fail closed): block the tool call when the verifier cannot be reached
- `"allow"` (fail open): allow the tool call when the verifier cannot be reached

Default is `"deny"` to be safe.

## Implementation Touchpoints

| File | Change |
|------|--------|
| `src/config/types.tools.ts` | Add `VerifierConfig` type to `ToolsConfig` |
| `src/config/zod-schema.core.ts` | Add verifier schema validation |
| `src/agents/verifier/` (new directory) | Core verifier logic |
| `src/agents/verifier/webhook.ts` | HTTP webhook client with HMAC signing |
| `src/agents/verifier/telegram.ts` | Telegram approval bridge using grammy |
| `src/agents/verifier/scope.ts` | Scope matching (include/exclude) |
| `src/agents/verifier/index.ts` | Verifier orchestrator (webhook + telegram) |
| `src/agents/pi-tools.before-tool-call.ts` | Wire verifier into `before_tool_call` pipeline |
| `src/commands/sandbox-explain.ts` | Show verifier status in `openclaw sandbox explain` |
| `docs/gateway/sandbox-vs-tool-policy-vs-elevated.md` | Document the verifier layer |

### What does NOT change

The existing `tool-policy.ts`, `exec-approvals.ts`, sandbox systems, and hook runner remain untouched. The verifier is purely additive.

## Approach Choice

Three approaches were evaluated:

1. **Hook-based external verifier** (chosen): Single webhook + Telegram verifier with configurable scope. Clean, focused, ships fast.
2. **Middleware chain**: Composable pipeline of verifiers. More extensible but significantly more complex.
3. **Extend exec approvals socket**: Minimal change, but limited to exec tool only.

Approach 1 was chosen for its balance of scope and simplicity.

## Security Considerations

Based on tech lead review:

### Param Redaction
Tool params sent to webhook/Telegram are redacted before transmission:
- `write`/`edit`/`apply_patch`: `content` field replaced with `[REDACTED: N chars]`
- This prevents file contents and secrets from leaking to external endpoints

### HTTPS Enforcement
- Webhook URLs using `http://` are **rejected in production** (`NODE_ENV=production`)
- In development, a warning is logged but the URL is accepted (for local testing)
- Rationale: HTTP responses are unauthenticated — a network attacker could swap `"deny"` for `"allow"`

### Telegram Sender Validation
- `telegram.allowedUserIds` restricts who can tap Allow/Deny buttons
- Without this field, any user with access to the chat can respond
- Unauthorized button taps receive an alert: "You are not authorized to approve/deny this request"

### Telegram Bot Architecture
- Uses direct `bot.api` calls (no long-polling) to avoid:
  - Competing bot instances causing 409 Conflict errors
  - Race conditions between `sendMessage` and `bot.start()`
  - Lost callbacks from `drop_pending_updates`
- Polls for callback query updates via `getUpdates`, correlated by `message_id`

### failMode: Most-Restrictive-Wins
- Per-agent `failMode` cannot weaken global setting
- `global: "deny"` + `agent: "allow"` → effective `"deny"`
- Prevents misconfigured agents from silently downgrading security

### Response Limits
- Webhook response body capped at 64 KB
- `reason` field truncated to 500 chars
- Prevents memory abuse from malicious/buggy webhook endpoints

## Open Questions

- Should the verifier cache recent decisions (e.g., "allow `ls` for 5 minutes")?
- Should there be a CLI command like `openclaw verifier test` to validate webhook connectivity?
- Should audit logging be added as a follow-up (log all verifier decisions to a file)?
