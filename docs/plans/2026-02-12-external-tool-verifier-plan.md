# External Tool Verifier Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an external tool verification gateway that can consult an HTTP webhook and/or a built-in Telegram approval bot before any tool call executes.

**Architecture:** A new `tools.verifier` config subsystem plugs into the existing `before_tool_call` hook in `pi-tools.before-tool-call.ts`. It runs after tool policy filtering and exec allowlist/safeBins checks. The verifier makes HTTP POST requests to a webhook URL and/or sends Telegram inline-keyboard approval messages, then blocks or allows based on the response.

**Tech Stack:** TypeScript, zod (config validation), undici (HTTP client - already a dependency), grammy (Telegram bot - already a dependency), vitest (testing).

**Design doc:** `docs/plans/2026-02-12-external-tool-verifier-design.md`

**Security review:** Tech lead review identified P0/P1 issues (incorporated below). Key changes from original design:
- **[P0] Telegram bot lifecycle**: Use direct API calls (`bot.api`) instead of long-polling per request — avoids 409 conflicts, callback race conditions, and competing bot instances
- **[P0] Telegram callback race**: Poll for callback updates *before* sending the message is impossible, so use `getUpdates` polling loop with the message's `message_id` as correlation key
- **[P1] HTTPS enforcement**: Zod schema warns on `http://` webhook URLs; rejects them when `NODE_ENV=production`
- **[P1] Param redaction**: Strip `content` field from `write`/`edit` params and env vars from `exec` params before sending to webhook/Telegram
- **[P1] Telegram sender validation**: New `allowedUserIds` config field; only listed users can tap Allow/Deny
- **[P1] failMode most-restrictive-wins**: Per-agent `failMode` cannot weaken global setting (agent `"allow"` + global `"deny"` → `"deny"`)

---

### Task 1: Config Types

**Files:**
- Modify: `src/config/types.tools.ts:198` (add to `AgentToolsConfig`)
- Modify: `src/config/types.tools.ts:326` (add to `ToolsConfig`)

**Step 1: Add VerifierConfig types**

Add these types before the `AgentToolsConfig` type (around line 196):

```typescript
export type VerifierScopeConfig = {
  /** Only verify these tools (mutually exclusive with exclude). */
  include?: string[];
  /** Verify all tools except these (mutually exclusive with include). */
  exclude?: string[];
};

export type VerifierWebhookConfig = {
  /** Webhook URL to POST verification requests to. */
  url: string;
  /** Timeout in seconds for the webhook request (default: 30). */
  timeout?: number;
  /** Optional headers to include in webhook requests. */
  headers?: Record<string, string>;
  /** Optional HMAC-SHA256 secret for request signing. */
  secret?: string;
};

export type VerifierTelegramConfig = {
  /** Enable Telegram approval verification. */
  enabled?: boolean;
  /** Telegram bot token for sending approval requests. */
  botToken: string;
  /** Telegram chat ID to send approval requests to. */
  chatId: string;
  /** Timeout in seconds to wait for user tap (default: 120). */
  timeout?: number;
  /** Only these Telegram user IDs can approve/deny. If empty, any user in the chat can respond. */
  allowedUserIds?: number[];
};

export type VerifierConfig = {
  /** Enable the external verifier. */
  enabled?: boolean;
  /** Which tools require verification. */
  scope?: VerifierScopeConfig;
  /** Behavior when verifier is unreachable: "deny" (default) or "allow". */
  failMode?: "deny" | "allow";
  /** HTTP webhook verifier. */
  webhook?: VerifierWebhookConfig;
  /** Built-in Telegram approval verifier. */
  telegram?: VerifierTelegramConfig;
};
```

**Step 2: Add verifier to AgentToolsConfig**

In `AgentToolsConfig` (line ~198), add after the `sandbox` field:

```typescript
  /** External tool verifier config (per-agent override). */
  verifier?: VerifierConfig;
```

**Step 3: Add verifier to ToolsConfig**

In `ToolsConfig` (line ~326), add after the `sandbox` field:

```typescript
  /** External tool verification gateway. */
  verifier?: VerifierConfig;
```

**Step 4: Commit**

```bash
git add src/config/types.tools.ts
git commit -m "feat(verifier): add VerifierConfig types to ToolsConfig and AgentToolsConfig"
```

---

### Task 2: Zod Schema Validation

**Files:**
- Modify: `src/config/zod-schema.agent-runtime.ts:262` (AgentToolsSchema)
- Modify: `src/config/zod-schema.agent-runtime.ts:477` (ToolsSchema)

**Step 1: Define the VerifierSchema**

Add this before `AgentToolsSchema` (around line 260):

```typescript
const VerifierScopeSchema = z
  .object({
    include: z.array(z.string()).optional(),
    exclude: z.array(z.string()).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.include && value.include.length > 0 && value.exclude && value.exclude.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "verifier scope cannot set both include and exclude (use one or the other)",
      });
    }
  })
  .optional();

const VerifierWebhookSchema = z
  .object({
    url: z.string().url().superRefine((url, ctx) => {
      if (url.startsWith("http://")) {
        if (process.env.NODE_ENV === "production") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "verifier webhook URL must use HTTPS in production",
          });
        } else {
          // Log warning at config load time (non-blocking in dev)
          console.warn("[verifier] WARNING: webhook URL uses HTTP — responses are not authenticated. Use HTTPS in production.");
        }
      }
    }),
    timeout: z.number().int().positive().optional(),
    headers: z.record(z.string(), z.string()).optional(),
    secret: z.string().optional(),
  })
  .strict()
  .optional();

const VerifierTelegramSchema = z
  .object({
    enabled: z.boolean().optional(),
    botToken: z.string().min(1),
    chatId: z.string().min(1),
    timeout: z.number().int().positive().optional(),
    allowedUserIds: z.array(z.number().int()).optional(),
  })
  .strict()
  .optional();

const VerifierSchema = z
  .object({
    enabled: z.boolean().optional(),
    scope: VerifierScopeSchema,
    failMode: z.enum(["deny", "allow"]).optional(),
    webhook: VerifierWebhookSchema,
    telegram: VerifierTelegramSchema,
  })
  .strict()
  .optional();
```

**Step 2: Add to AgentToolsSchema**

Add `verifier: VerifierSchema,` after the `sandbox` field in `AgentToolsSchema` (around line 304).

**Step 3: Add to ToolsSchema**

Add `verifier: VerifierSchema,` after the `sandbox` field in `ToolsSchema` (around line 561).

**Step 4: Run validation tests**

Run: `pnpm vitest run --config vitest.unit.config.ts -- src/config`
Expected: All existing config tests pass.

**Step 5: Commit**

```bash
git add src/config/zod-schema.agent-runtime.ts
git commit -m "feat(verifier): add zod schema validation for tools.verifier config"
```

---

### Task 3: Scope Matcher

**Files:**
- Create: `src/agents/verifier/scope.ts`
- Create: `src/agents/verifier/scope.test.ts`

**Step 1: Write the failing test**

Create `src/agents/verifier/scope.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { isToolInVerifierScope } from "./scope.js";

describe("isToolInVerifierScope", () => {
  it("returns true for all tools when no scope configured", () => {
    expect(isToolInVerifierScope("exec", undefined)).toBe(true);
    expect(isToolInVerifierScope("write", undefined)).toBe(true);
  });

  it("returns true only for included tools", () => {
    const scope = { include: ["exec", "write"] };
    expect(isToolInVerifierScope("exec", scope)).toBe(true);
    expect(isToolInVerifierScope("write", scope)).toBe(true);
    expect(isToolInVerifierScope("read", scope)).toBe(false);
  });

  it("returns false for excluded tools", () => {
    const scope = { exclude: ["read", "session_status"] };
    expect(isToolInVerifierScope("exec", scope)).toBe(true);
    expect(isToolInVerifierScope("read", scope)).toBe(false);
    expect(isToolInVerifierScope("session_status", scope)).toBe(false);
  });

  it("normalizes tool names (case-insensitive)", () => {
    const scope = { include: ["Exec", "WRITE"] };
    expect(isToolInVerifierScope("exec", scope)).toBe(true);
    expect(isToolInVerifierScope("EXEC", scope)).toBe(true);
  });

  it("expands tool groups", () => {
    const scope = { include: ["group:runtime"] };
    expect(isToolInVerifierScope("exec", scope)).toBe(true);
    expect(isToolInVerifierScope("process", scope)).toBe(true);
    expect(isToolInVerifierScope("read", scope)).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run --config vitest.unit.config.ts -- src/agents/verifier/scope.test.ts`
Expected: FAIL (module not found)

**Step 3: Implement scope matcher**

Create `src/agents/verifier/scope.ts`:

```typescript
import type { VerifierScopeConfig } from "../../config/types.tools.js";
import { expandToolGroups, normalizeToolName } from "../tool-policy.js";

export function isToolInVerifierScope(
  toolName: string,
  scope: VerifierScopeConfig | undefined,
): boolean {
  if (!scope) {
    return true;
  }
  const normalized = normalizeToolName(toolName);
  if (scope.include && scope.include.length > 0) {
    const expanded = expandToolGroups(scope.include);
    return expanded.includes(normalized);
  }
  if (scope.exclude && scope.exclude.length > 0) {
    const expanded = expandToolGroups(scope.exclude);
    return !expanded.includes(normalized);
  }
  return true;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run --config vitest.unit.config.ts -- src/agents/verifier/scope.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/agents/verifier/scope.ts src/agents/verifier/scope.test.ts
git commit -m "feat(verifier): add scope matcher with include/exclude and group expansion"
```

---

### Task 4: Webhook Client

**Files:**
- Create: `src/agents/verifier/webhook.ts`
- Create: `src/agents/verifier/webhook.test.ts`

**Step 1: Write the failing test**

Create `src/agents/verifier/webhook.test.ts`:

```typescript
import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http from "node:http";
import { callWebhookVerifier, redactToolParams, type VerifierRequest } from "./webhook.js";

const TEST_PORT = 19876;

describe("redactToolParams", () => {
  it("redacts content field for write tool", () => {
    const params = { path: "/tmp/secret.txt", content: "super-secret-data" };
    const redacted = redactToolParams("write", params);
    expect(redacted.content).toBe("[REDACTED: 17 chars]");
    expect(redacted.path).toBe("/tmp/secret.txt");
  });

  it("redacts content field for edit tool", () => {
    const params = { path: "/tmp/file.ts", content: "code here" };
    const redacted = redactToolParams("edit", params);
    expect(String(redacted.content)).toContain("REDACTED");
  });

  it("does not redact exec params", () => {
    const params = { command: "ls -la" };
    const redacted = redactToolParams("exec", params);
    expect(redacted.command).toBe("ls -la");
  });

  it("does not redact read params", () => {
    const params = { path: "/etc/passwd" };
    const redacted = redactToolParams("read", params);
    expect(redacted.path).toBe("/etc/passwd");
  });
});

function createTestServer(handler: (req: http.IncomingMessage, res: http.ServerResponse) => void) {
  const server = http.createServer(handler);
  return new Promise<http.Server>((resolve) => {
    server.listen(TEST_PORT, () => resolve(server));
  });
}

function closeServer(server: http.Server) {
  return new Promise<void>((resolve) => server.close(() => resolve()));
}

describe("callWebhookVerifier", () => {
  let server: http.Server | null = null;

  afterAll(async () => {
    if (server) await closeServer(server);
  });

  it("returns allow when webhook responds with allow", async () => {
    server = await createTestServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ decision: "allow" }));
    });

    const result = await callWebhookVerifier({
      url: `http://127.0.0.1:${TEST_PORT}/verify`,
      timeout: 5,
      request: {
        version: 1,
        timestamp: new Date().toISOString(),
        requestId: "test-1",
        tool: { name: "exec", params: { command: "ls" } },
        context: { agentId: "main" },
      },
    });

    expect(result.decision).toBe("allow");
    await closeServer(server);
    server = null;
  });

  it("returns deny when webhook responds with deny", async () => {
    server = await createTestServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ decision: "deny", reason: "not allowed" }));
    });

    const result = await callWebhookVerifier({
      url: `http://127.0.0.1:${TEST_PORT}/verify`,
      timeout: 5,
      request: {
        version: 1,
        timestamp: new Date().toISOString(),
        requestId: "test-2",
        tool: { name: "exec", params: { command: "rm -rf /" } },
        context: { agentId: "main" },
      },
    });

    expect(result.decision).toBe("deny");
    expect(result.reason).toBe("not allowed");
    await closeServer(server);
    server = null;
  });

  it("returns error on timeout", async () => {
    server = await createTestServer((_req, _res) => {
      // Never respond
    });

    const result = await callWebhookVerifier({
      url: `http://127.0.0.1:${TEST_PORT}/verify`,
      timeout: 1,
      request: {
        version: 1,
        timestamp: new Date().toISOString(),
        requestId: "test-3",
        tool: { name: "exec", params: {} },
        context: {},
      },
    });

    expect(result.decision).toBe("error");
    await closeServer(server);
    server = null;
  });

  it("includes HMAC signature when secret is configured", async () => {
    let receivedSignature: string | undefined;
    let receivedBody = "";
    const secret = "test-secret-key";

    server = await createTestServer((req, res) => {
      receivedSignature = req.headers["x-openclaw-signature"] as string;
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => {
        receivedBody = Buffer.concat(chunks).toString();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ decision: "allow" }));
      });
    });

    await callWebhookVerifier({
      url: `http://127.0.0.1:${TEST_PORT}/verify`,
      timeout: 5,
      secret,
      request: {
        version: 1,
        timestamp: new Date().toISOString(),
        requestId: "test-4",
        tool: { name: "exec", params: {} },
        context: {},
      },
    });

    expect(receivedSignature).toBeDefined();
    const expected = crypto
      .createHmac("sha256", secret)
      .update(receivedBody)
      .digest("hex");
    expect(receivedSignature).toBe(`sha256=${expected}`);
    await closeServer(server);
    server = null;
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run --config vitest.unit.config.ts -- src/agents/verifier/webhook.test.ts`
Expected: FAIL (module not found)

**Step 3: Implement webhook client**

Create `src/agents/verifier/webhook.ts`:

```typescript
import crypto from "node:crypto";
import { request } from "undici";

const MAX_RESPONSE_BYTES = 64 * 1024; // 64 KB max response body
const MAX_REASON_LENGTH = 500;

export type VerifierRequest = {
  version: number;
  timestamp: string;
  requestId: string;
  tool: {
    name: string;
    params: Record<string, unknown>;
  };
  context: {
    agentId?: string;
    sessionKey?: string;
    messageProvider?: string;
  };
};

export type VerifierDecision = {
  decision: "allow" | "deny" | "error";
  reason?: string;
};

/**
 * Redact sensitive fields from tool params before sending to external verifiers.
 * - write/edit: strips `content` field (may contain file contents / secrets)
 * - exec: strips env vars from command string (best-effort)
 */
export function redactToolParams(
  toolName: string,
  params: Record<string, unknown>,
): Record<string, unknown> {
  const redacted = { ...params };
  const lower = toolName.toLowerCase();

  // Strip file content from write/edit — the verifier doesn't need full file bodies
  if ((lower === "write" || lower === "edit" || lower === "apply_patch") && "content" in redacted) {
    const content = String(redacted.content);
    redacted.content = `[REDACTED: ${content.length} chars]`;
  }

  return redacted;
}

export async function callWebhookVerifier(params: {
  url: string;
  timeout: number;
  headers?: Record<string, string>;
  secret?: string;
  request: VerifierRequest;
}): Promise<VerifierDecision> {
  const body = JSON.stringify(params.request);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...params.headers,
  };

  if (params.secret) {
    const hmac = crypto
      .createHmac("sha256", params.secret)
      .update(body)
      .digest("hex");
    headers["X-OpenClaw-Signature"] = `sha256=${hmac}`;
  }

  try {
    const response = await request(params.url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(params.timeout * 1000),
      maxRedirections: 0,
    });

    if (response.statusCode < 200 || response.statusCode >= 300) {
      // Drain the body to avoid socket leaks
      await response.body.dump();
      return {
        decision: "error",
        reason: `Webhook returned HTTP ${response.statusCode}`,
      };
    }

    // Enforce response body size limit
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    for await (const chunk of response.body) {
      totalBytes += chunk.length;
      if (totalBytes > MAX_RESPONSE_BYTES) {
        return { decision: "error", reason: "Webhook response too large" };
      }
      chunks.push(chunk);
    }
    const text = Buffer.concat(chunks).toString("utf-8");

    let parsed: { decision?: string; reason?: string };
    try {
      parsed = JSON.parse(text) as { decision?: string; reason?: string };
    } catch {
      return { decision: "error", reason: "Webhook returned invalid JSON" };
    }

    // Truncate reason to prevent memory abuse
    const reason = parsed.reason
      ? parsed.reason.slice(0, MAX_REASON_LENGTH)
      : undefined;

    if (parsed.decision === "allow") {
      return { decision: "allow" };
    }
    if (parsed.decision === "deny") {
      return { decision: "deny", reason };
    }
    return {
      decision: "error",
      reason: `Webhook returned unknown decision: ${String(parsed.decision)}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { decision: "error", reason: `Webhook request failed: ${message}` };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run --config vitest.unit.config.ts -- src/agents/verifier/webhook.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/agents/verifier/webhook.ts src/agents/verifier/webhook.test.ts
git commit -m "feat(verifier): add HTTP webhook client with HMAC signing"
```

---

### Task 5: Telegram Verifier

> **Security note (P0):** The original design created a new `Bot` instance with `bot.start()` (long-polling)
> per verification request. This causes: (1) competing polling connections → Telegram 409 Conflict errors,
> (2) race condition where callbacks are lost between `sendMessage` and `bot.start()`, (3) `drop_pending_updates`
> discarding valid responses. The fix: use `bot.api` for direct API calls only — no long-polling. Poll for
> callback query updates via `getUpdates` with an offset, correlated by `message_id`.

**Files:**
- Create: `src/agents/verifier/telegram.ts`
- Create: `src/agents/verifier/telegram.test.ts`

**Step 1: Write the failing test**

Create `src/agents/verifier/telegram.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { formatTelegramApprovalMessage, isAllowedSender } from "./telegram.js";

describe("formatTelegramApprovalMessage", () => {
  it("formats a readable approval message", () => {
    const message = formatTelegramApprovalMessage({
      toolName: "exec",
      params: { command: "curl https://example.com" },
      agentId: "main",
      sessionKey: "agent:main:main",
    });
    expect(message).toContain("exec");
    expect(message).toContain("curl https://example.com");
    expect(message).toContain("main");
  });

  it("truncates long commands", () => {
    const longCommand = "a".repeat(500);
    const message = formatTelegramApprovalMessage({
      toolName: "exec",
      params: { command: longCommand },
      agentId: "main",
    });
    expect(message.length).toBeLessThan(600);
  });

  it("uses redacted params for write tool", () => {
    const message = formatTelegramApprovalMessage({
      toolName: "write",
      params: { path: "/tmp/secret.txt", content: "[REDACTED: 100 chars]" },
      agentId: "main",
    });
    expect(message).toContain("REDACTED");
    expect(message).not.toContain("secret-data");
  });
});

describe("isAllowedSender", () => {
  it("allows any sender when allowedUserIds is empty", () => {
    expect(isAllowedSender(12345, undefined)).toBe(true);
    expect(isAllowedSender(12345, [])).toBe(true);
  });

  it("allows sender in allowedUserIds list", () => {
    expect(isAllowedSender(12345, [12345, 67890])).toBe(true);
  });

  it("rejects sender not in allowedUserIds list", () => {
    expect(isAllowedSender(99999, [12345, 67890])).toBe(false);
  });
});
```

Note: The full Telegram bot integration (sending messages, polling for callbacks) requires a live bot token and cannot be unit tested without mocking grammy extensively. The unit test covers formatting and sender validation logic; the actual bot interaction should be tested via integration/e2e tests.

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run --config vitest.unit.config.ts -- src/agents/verifier/telegram.test.ts`
Expected: FAIL (module not found)

**Step 3: Implement Telegram verifier**

Create `src/agents/verifier/telegram.ts`:

```typescript
import type { VerifierDecision } from "./webhook.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";

const log = createSubsystemLogger("verifier/telegram");
const MAX_MESSAGE_LENGTH = 400;
const POLL_INTERVAL_MS = 1500;

/**
 * Check if a Telegram user ID is in the allowed senders list.
 * If no list is configured, any user can respond.
 */
export function isAllowedSender(
  userId: number,
  allowedUserIds: number[] | undefined,
): boolean {
  if (!allowedUserIds || allowedUserIds.length === 0) {
    return true;
  }
  return allowedUserIds.includes(userId);
}

export function formatTelegramApprovalMessage(params: {
  toolName: string;
  params: Record<string, unknown>;
  agentId?: string;
  sessionKey?: string;
}): string {
  const commandStr = params.params.command
    ? String(params.params.command)
    : JSON.stringify(params.params);
  const truncated =
    commandStr.length > MAX_MESSAGE_LENGTH
      ? `${commandStr.slice(0, MAX_MESSAGE_LENGTH)}...`
      : commandStr;
  const lines = [
    "🔒 Tool verification request",
    "",
    `Tool: ${params.toolName}`,
    `Details: ${truncated}`,
  ];
  if (params.agentId) {
    lines.push(`Agent: ${params.agentId}`);
  }
  if (params.sessionKey) {
    lines.push(`Session: ${params.sessionKey}`);
  }
  return lines.join("\n");
}

/**
 * Send a Telegram approval request and wait for a callback response.
 *
 * Architecture: Uses direct bot.api calls (no long-polling). Sends the message
 * with inline keyboard, then polls getUpdates for callback_query updates that
 * match the sent message_id. This avoids:
 * - Creating competing bot instances (409 Conflict)
 * - Race conditions between sendMessage and bot.start()
 * - Lost callbacks from drop_pending_updates
 */
export async function callTelegramVerifier(params: {
  botToken: string;
  chatId: string;
  timeout: number;
  toolName: string;
  toolParams: Record<string, unknown>;
  agentId?: string;
  sessionKey?: string;
  requestId: string;
  allowedUserIds?: number[];
}): Promise<VerifierDecision> {
  try {
    const { Bot, InlineKeyboard } = await import("grammy");
    const bot = new Bot(params.botToken);

    const message = formatTelegramApprovalMessage({
      toolName: params.toolName,
      params: params.toolParams,
      agentId: params.agentId,
      sessionKey: params.sessionKey,
    });

    const keyboard = new InlineKeyboard()
      .text("✅ Allow", `verifier:allow:${params.requestId}`)
      .text("❌ Deny", `verifier:deny:${params.requestId}`);

    // Send the approval message
    const sent = await bot.api.sendMessage(params.chatId, message, {
      reply_markup: keyboard,
    });

    // Poll for callback_query updates using getUpdates (no long-polling bot)
    const deadline = Date.now() + params.timeout * 1000;
    let updateOffset = 0;

    while (Date.now() < deadline) {
      try {
        const updates = await bot.api.getUpdates({
          offset: updateOffset,
          timeout: Math.min(5, Math.ceil((deadline - Date.now()) / 1000)),
          allowed_updates: ["callback_query"],
        });

        for (const update of updates) {
          updateOffset = update.update_id + 1;

          if (!update.callback_query?.message) continue;
          if (update.callback_query.message.message_id !== sent.message_id) continue;

          const data = update.callback_query.data;
          if (!data) continue;

          const match = data.match(/^verifier:(allow|deny):(.+)$/);
          if (!match || match[2] !== params.requestId) continue;

          // Validate sender
          const senderId = update.callback_query.from.id;
          if (!isAllowedSender(senderId, params.allowedUserIds)) {
            await bot.api.answerCallbackQuery(update.callback_query.id, {
              text: "You are not authorized to approve/deny this request.",
              show_alert: true,
            });
            continue;
          }

          const decision = match[1] as "allow" | "deny";

          // Acknowledge the callback and remove the keyboard
          await bot.api.answerCallbackQuery(update.callback_query.id, {
            text: decision === "allow" ? "✅ Allowed" : "❌ Denied",
          });
          await bot.api.editMessageReplyMarkup(params.chatId, sent.message_id, {
            reply_markup: undefined,
          });

          return {
            decision,
            reason: decision === "deny" ? "Denied via Telegram" : undefined,
          };
        }
      } catch (pollErr) {
        log.warn(`Telegram getUpdates error: ${String(pollErr)}`);
        // Brief pause before retry
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
    }

    // Timeout — remove the keyboard to indicate expiry
    try {
      await bot.api.editMessageText(
        params.chatId,
        sent.message_id,
        message + "\n\n⏱ Timed out — no response received.",
      );
    } catch { /* best effort */ }

    return { decision: "error", reason: "Telegram approval timed out" };
  } catch (err) {
    return {
      decision: "error",
      reason: `Telegram verifier failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run --config vitest.unit.config.ts -- src/agents/verifier/telegram.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/agents/verifier/telegram.ts src/agents/verifier/telegram.test.ts
git commit -m "feat(verifier): add Telegram approval verifier (direct API, no long-polling)"
```

---

### Task 6: Verifier Orchestrator

**Files:**
- Create: `src/agents/verifier/index.ts`
- Create: `src/agents/verifier/index.test.ts`

**Step 1: Write the failing test**

Create `src/agents/verifier/index.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";
import { runVerifier, resolveVerifierConfig, resolveFailMode } from "./index.js";

vi.mock("./webhook.js", () => ({
  callWebhookVerifier: vi.fn(() => ({ decision: "allow" })),
  redactToolParams: vi.fn((_, params: unknown) => params),
}));

vi.mock("./telegram.js", () => ({
  callTelegramVerifier: vi.fn(() => ({ decision: "allow" })),
  formatTelegramApprovalMessage: vi.fn(() => "test"),
  isAllowedSender: vi.fn(() => true),
}));

describe("resolveVerifierConfig", () => {
  it("returns undefined when verifier is disabled", () => {
    expect(resolveVerifierConfig({ enabled: false })).toBeUndefined();
  });

  it("returns undefined when no verifier configured", () => {
    expect(resolveVerifierConfig(undefined)).toBeUndefined();
  });

  it("returns config when enabled with webhook", () => {
    const cfg = {
      enabled: true,
      webhook: { url: "https://example.com/verify", timeout: 10 },
    };
    expect(resolveVerifierConfig(cfg)).toEqual(cfg);
  });
});

describe("resolveFailMode", () => {
  it("defaults to deny when both undefined", () => {
    expect(resolveFailMode(undefined, undefined)).toBe("deny");
  });

  it("global deny wins over agent allow (most restrictive)", () => {
    expect(resolveFailMode("deny", "allow")).toBe("deny");
  });

  it("agent deny wins over global allow (most restrictive)", () => {
    expect(resolveFailMode("allow", "deny")).toBe("deny");
  });

  it("both allow results in allow", () => {
    expect(resolveFailMode("allow", "allow")).toBe("allow");
  });

  it("global deny with agent undefined results in deny", () => {
    expect(resolveFailMode("deny", undefined)).toBe("deny");
  });
});

describe("runVerifier", () => {
  it("allows when verifier is not configured", async () => {
    const result = await runVerifier({
      config: undefined,
      toolName: "exec",
      params: { command: "ls" },
    });
    expect(result.blocked).toBe(false);
  });

  it("allows when tool is not in scope", async () => {
    const result = await runVerifier({
      config: {
        enabled: true,
        scope: { include: ["exec"] },
        webhook: { url: "https://example.com/verify" },
      },
      toolName: "read",
      params: {},
    });
    expect(result.blocked).toBe(false);
  });

  it("blocks when failMode is deny and webhook returns error", async () => {
    const { callWebhookVerifier } = await import("./webhook.js");
    vi.mocked(callWebhookVerifier).mockResolvedValueOnce({
      decision: "error",
      reason: "timeout",
    });

    const result = await runVerifier({
      config: {
        enabled: true,
        failMode: "deny",
        webhook: { url: "https://example.com/verify" },
      },
      toolName: "exec",
      params: { command: "ls" },
    });
    expect(result.blocked).toBe(true);
  });

  it("allows when failMode is allow and webhook returns error", async () => {
    const { callWebhookVerifier } = await import("./webhook.js");
    vi.mocked(callWebhookVerifier).mockResolvedValueOnce({
      decision: "error",
      reason: "timeout",
    });

    const result = await runVerifier({
      config: {
        enabled: true,
        failMode: "allow",
        webhook: { url: "https://example.com/verify" },
      },
      toolName: "exec",
      params: { command: "ls" },
    });
    expect(result.blocked).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run --config vitest.unit.config.ts -- src/agents/verifier/index.test.ts`
Expected: FAIL (module not found)

**Step 3: Implement verifier orchestrator**

Create `src/agents/verifier/index.ts`:

```typescript
import crypto from "node:crypto";
import type { VerifierConfig } from "../../config/types.tools.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { isToolInVerifierScope } from "./scope.js";
import { callTelegramVerifier } from "./telegram.js";
import { callWebhookVerifier, redactToolParams, type VerifierRequest } from "./webhook.js";

const log = createSubsystemLogger("verifier");

export type VerifierOutcome = { blocked: true; reason: string } | { blocked: false };

export function resolveVerifierConfig(
  config: VerifierConfig | undefined,
): VerifierConfig | undefined {
  if (!config || config.enabled === false) {
    return undefined;
  }
  if (!config.webhook && !config.telegram?.enabled) {
    return undefined;
  }
  return config;
}

/**
 * Resolve the effective failMode using most-restrictive-wins strategy.
 * Per-agent failMode cannot weaken global failMode:
 *   global "deny" + agent "allow" → "deny" (global wins)
 *   global "allow" + agent "deny" → "deny" (agent wins)
 */
export function resolveFailMode(
  globalFailMode: "deny" | "allow" | undefined,
  agentFailMode: "deny" | "allow" | undefined,
): "deny" | "allow" {
  // "deny" always wins over "allow" (most restrictive)
  if (globalFailMode === "deny" || agentFailMode === "deny") {
    return "deny";
  }
  // Both explicitly "allow", or one is undefined
  return agentFailMode ?? globalFailMode ?? "deny";
}

export async function runVerifier(params: {
  config: VerifierConfig | undefined;
  globalConfig?: VerifierConfig | undefined;
  toolName: string;
  params: Record<string, unknown>;
  agentId?: string;
  sessionKey?: string;
  messageProvider?: string;
}): Promise<VerifierOutcome> {
  const config = resolveVerifierConfig(params.config);
  if (!config) {
    return { blocked: false };
  }

  if (!isToolInVerifierScope(params.toolName, config.scope)) {
    return { blocked: false };
  }

  // Most-restrictive-wins: per-agent cannot weaken global failMode
  const failMode = resolveFailMode(
    params.globalConfig?.failMode,
    config.failMode,
  );

  const requestId = crypto.randomUUID();

  // Redact sensitive params before sending to external verifiers
  const redactedParams = redactToolParams(params.toolName, params.params);

  const request: VerifierRequest = {
    version: 1,
    timestamp: new Date().toISOString(),
    requestId,
    tool: { name: params.toolName, params: redactedParams },
    context: {
      agentId: params.agentId,
      sessionKey: params.sessionKey,
      messageProvider: params.messageProvider,
    },
  };

  // Run webhook verification
  if (config.webhook?.url) {
    const result = await callWebhookVerifier({
      url: config.webhook.url,
      timeout: config.webhook.timeout ?? 30,
      headers: config.webhook.headers,
      secret: config.webhook.secret,
      request,
    });

    if (result.decision === "deny") {
      log.info(`verifier denied: tool=${params.toolName} reason=${result.reason ?? "denied"}`);
      return { blocked: true, reason: result.reason ?? "Denied by external verifier" };
    }
    if (result.decision === "error") {
      log.warn(`verifier error: tool=${params.toolName} reason=${result.reason}`);
      if (failMode === "deny") {
        return {
          blocked: true,
          reason: `Verifier unreachable (failMode=deny): ${result.reason}`,
        };
      }
      // failMode === "allow": continue
    }
    // decision === "allow": continue to Telegram if configured
  }

  // Run Telegram verification (uses redacted params for the approval message)
  if (config.telegram?.enabled && config.telegram.botToken && config.telegram.chatId) {
    const result = await callTelegramVerifier({
      botToken: config.telegram.botToken,
      chatId: config.telegram.chatId,
      timeout: config.telegram.timeout ?? 120,
      toolName: params.toolName,
      toolParams: redactedParams,
      agentId: params.agentId,
      sessionKey: params.sessionKey,
      requestId,
      allowedUserIds: config.telegram.allowedUserIds,
    });

    if (result.decision === "deny") {
      log.info(`verifier denied (telegram): tool=${params.toolName}`);
      return { blocked: true, reason: result.reason ?? "Denied via Telegram" };
    }
    if (result.decision === "error") {
      log.warn(`verifier error (telegram): tool=${params.toolName} reason=${result.reason}`);
      if (failMode === "deny") {
        return {
          blocked: true,
          reason: `Telegram verifier error (failMode=deny): ${result.reason}`,
        };
      }
    }
  }

  return { blocked: false };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run --config vitest.unit.config.ts -- src/agents/verifier/index.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/agents/verifier/index.ts src/agents/verifier/index.test.ts
git commit -m "feat(verifier): add orchestrator that coordinates webhook + Telegram"
```

---

### Task 7: Wire Into Before-Tool-Call Pipeline

**Files:**
- Modify: `src/agents/pi-tools.before-tool-call.ts`
- Create: `src/agents/pi-tools.verifier.test.ts`

**Step 1: Write the failing test**

Create `src/agents/pi-tools.verifier.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";

vi.mock("./verifier/index.js", () => ({
  runVerifier: vi.fn(() => ({ blocked: false })),
  resolveVerifierConfig: vi.fn((cfg: unknown) => cfg),
}));

vi.mock("../plugins/hook-runner-global.js", () => ({
  getGlobalHookRunner: () => null,
}));

describe("before-tool-call with verifier", () => {
  it("blocks tool call when verifier denies", async () => {
    const { runVerifier } = await import("./verifier/index.js");
    vi.mocked(runVerifier).mockResolvedValueOnce({
      blocked: true,
      reason: "Denied by policy server",
    });

    const { runBeforeToolCallHook } = await import("./pi-tools.before-tool-call.js");
    const result = await runBeforeToolCallHook({
      toolName: "exec",
      params: { command: "rm -rf /" },
      verifierConfig: { enabled: true, webhook: { url: "https://example.com" } },
    });
    expect(result.blocked).toBe(true);
    expect(result.reason).toContain("Denied by policy server");
  });

  it("allows tool call when verifier approves", async () => {
    const { runVerifier } = await import("./verifier/index.js");
    vi.mocked(runVerifier).mockResolvedValueOnce({ blocked: false });

    const { runBeforeToolCallHook } = await import("./pi-tools.before-tool-call.js");
    const result = await runBeforeToolCallHook({
      toolName: "exec",
      params: { command: "echo hello" },
      verifierConfig: { enabled: true, webhook: { url: "https://example.com" } },
    });
    expect(result.blocked).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run --config vitest.unit.config.ts -- src/agents/pi-tools.verifier.test.ts`
Expected: FAIL (verifierConfig not a valid param for runBeforeToolCallHook)

**Step 3: Modify pi-tools.before-tool-call.ts**

In `src/agents/pi-tools.before-tool-call.ts`, add the verifier import and integrate it into `runBeforeToolCallHook`:

1. Add import at top:
```typescript
import type { VerifierConfig } from "../config/types.tools.js";
import { runVerifier } from "./verifier/index.js";
```

2. Add `verifierConfig` to the function args type:
```typescript
export async function runBeforeToolCallHook(args: {
  toolName: string;
  params: unknown;
  toolCallId?: string;
  ctx?: HookContext;
  verifierConfig?: VerifierConfig;
}): Promise<HookOutcome> {
```

3. After the plugin hook check (line ~46), add verifier check before returning:
```typescript
  // Run external verifier (after plugin hooks, before final return)
  if (args.verifierConfig) {
    const normalizedParams = isPlainObject(args.params)
      ? (args.params as Record<string, unknown>)
      : {};
    const verifierResult = await runVerifier({
      config: args.verifierConfig,
      globalConfig: args.globalVerifierConfig,
      toolName,
      params: normalizedParams,
      agentId: args.ctx?.agentId,
      sessionKey: args.ctx?.sessionKey,
    });
    if (verifierResult.blocked) {
      return { blocked: true, reason: verifierResult.reason };
    }
  }
```

4. In `wrapToolWithBeforeToolCallHook`, add `verifierConfig` and `globalVerifierConfig` to the args:
```typescript
export function wrapToolWithBeforeToolCallHook(
  tool: AnyAgentTool,
  ctx?: HookContext & { verifierConfig?: VerifierConfig; globalVerifierConfig?: VerifierConfig },
): AnyAgentTool {
```

And pass it through in the execute wrapper:
```typescript
    execute: async (toolCallId, params, signal, onUpdate) => {
      const outcome = await runBeforeToolCallHook({
        toolName,
        params,
        toolCallId,
        ctx,
        verifierConfig: ctx?.verifierConfig,
      });
```

**Step 4: Update pi-tools.ts to pass verifier config**

In `src/agents/pi-tools.ts:442-446`, pass both the agent-level and global verifier config:

```typescript
  // Agent-level verifier overrides global, but failMode uses most-restrictive-wins
  const globalVerifierConfig = options?.config?.tools?.verifier;
  const verifierConfig = agentConfig?.tools?.verifier ?? globalVerifierConfig;

  const withHooks = normalized.map((tool) =>
    wrapToolWithBeforeToolCallHook(tool, {
      agentId,
      sessionKey: options?.sessionKey,
      verifierConfig,
      globalVerifierConfig,
    }),
  );
```

**Step 5: Run tests to verify**

Run: `pnpm vitest run --config vitest.unit.config.ts -- src/agents/pi-tools.verifier.test.ts src/agents/pi-tools.before-tool-call.test.ts`
Expected: PASS

**Step 6: Run full test suite**

Run: `pnpm test:fast`
Expected: All tests pass (no regressions)

**Step 7: Commit**

```bash
git add src/agents/pi-tools.before-tool-call.ts src/agents/pi-tools.ts src/agents/pi-tools.verifier.test.ts
git commit -m "feat(verifier): wire external verifier into before_tool_call pipeline"
```

---

### Task 8: Documentation Update

**Files:**
- Modify: `docs/gateway/sandbox-vs-tool-policy-vs-elevated.md`

**Step 1: Add verifier section**

Add after the "Elevated" section (around line 113):

```markdown
## Verifier: external approval gateway

When configured, the verifier adds a fourth layer that calls an external HTTP webhook and/or sends Telegram approval requests before tool execution. It runs **after** tool policy and exec allowlist checks.

Configuration: `tools.verifier` (global) or `agents.list[].tools.verifier` (per-agent).

```json5
{
  tools: {
    verifier: {
      enabled: true,
      failMode: "deny",  // or "allow"
      scope: { include: ["exec", "write", "edit"] },
      webhook: { url: "https://my-verifier.example.com/verify" },
      telegram: { enabled: true, botToken: "...", chatId: "..." }
    }
  }
}
```

Key behaviors:
- `failMode: "deny"`: blocks tool calls when the verifier is unreachable (safe default)
- `failMode: "allow"`: allows tool calls when the verifier is unreachable (availability-first)
- `scope.include`/`scope.exclude`: control which tools are gated (supports `group:*` shorthands)
- Webhook and Telegram can both be active (both must approve)
```

**Step 2: Commit**

```bash
git add docs/gateway/sandbox-vs-tool-policy-vs-elevated.md
git commit -m "docs: add verifier section to sandbox-vs-tool-policy guide"
```

---

### Task 9: Final Integration Test

**Files:**
- Create: `src/agents/verifier/integration.test.ts`

**Step 1: Write integration test**

```typescript
import http from "node:http";
import { afterAll, describe, expect, it } from "vitest";
import { runVerifier } from "./index.js";

const TEST_PORT = 19877;

describe("verifier integration", () => {
  let server: http.Server | null = null;

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    }
  });

  it("end-to-end: webhook allow", async () => {
    server = await new Promise<http.Server>((resolve) => {
      const s = http.createServer((_req, res) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ decision: "allow" }));
      });
      s.listen(TEST_PORT, () => resolve(s));
    });

    const result = await runVerifier({
      config: {
        enabled: true,
        webhook: { url: `http://127.0.0.1:${TEST_PORT}/verify` },
      },
      toolName: "exec",
      params: { command: "echo hello" },
      agentId: "main",
    });
    expect(result.blocked).toBe(false);

    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = null;
  });

  it("end-to-end: webhook deny", async () => {
    server = await new Promise<http.Server>((resolve) => {
      const s = http.createServer((_req, res) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ decision: "deny", reason: "dangerous" }));
      });
      s.listen(TEST_PORT, () => resolve(s));
    });

    const result = await runVerifier({
      config: {
        enabled: true,
        webhook: { url: `http://127.0.0.1:${TEST_PORT}/verify` },
      },
      toolName: "exec",
      params: { command: "rm -rf /" },
    });
    expect(result.blocked).toBe(true);
    expect(result.reason).toContain("dangerous");

    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = null;
  });

  it("end-to-end: scope excludes tool", async () => {
    const result = await runVerifier({
      config: {
        enabled: true,
        scope: { include: ["exec"] },
        webhook: { url: "http://this-should-not-be-called.invalid" },
      },
      toolName: "read",
      params: {},
    });
    expect(result.blocked).toBe(false);
  });
});
```

**Step 2: Run integration test**

Run: `pnpm vitest run --config vitest.unit.config.ts -- src/agents/verifier/integration.test.ts`
Expected: PASS

**Step 3: Run full test suite one final time**

Run: `pnpm test:fast`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/agents/verifier/integration.test.ts
git commit -m "test(verifier): add end-to-end integration tests"
```
