# Plan: Add `heartbeatPreHook` Support to Warelay

**Date:** 2025-12-01  
**Status:** Complete  
**Feature:** Allow users to run a custom script before each heartbeat that gathers context (like email summaries) to inject into the heartbeat prompt

---

## Overview

### Motivation
Users want to inject dynamic context into heartbeat prompts. The primary use case is fetching unread Office 365 emails since the last heartbeat and summarizing them, so the AI assistant can proactively inform users about important communications.

### Behavior Summary
1. Before each heartbeat fires, run the configured pre-hook command
2. Capture stdout from the command
3. If stdout is non-empty, prepend it to the heartbeat prompt:
   - Normal: `HEARTBEAT ultrathink`
   - With context: `HEARTBEAT ultrathink\n\n---\nContext from pre-hook:\n{stdout}`
4. If the pre-hook fails or times out, log a warning but still send the basic heartbeat
5. If stdout is empty, just send the normal heartbeat prompt

---

## Plan Updates (2025-12-02)

- Centralize pre-hook execution in `runWebHeartbeatOnce`; callers like `runReplyHeartbeat` should pass `skipPreHook: true` to avoid double runs in fallback flows.
- Run pre-hook only after confirming a heartbeat recipient and after queue/interval guards, so skipped heartbeats do not trigger scripts.
- Add `cfg?` (or injected `loadConfig`) plus `skipPreHook`/`overrideBody` gates to the Twilio path; ensure tests can stub config to avoid reading real user config.
- Add an in-flight guard to prevent overlapping heartbeats when pre-hook runs long.
- Keep the pre-hook module’s logging minimal and let callers emit structured heartbeat logs; optionally accept a logger/context parameter.
- Cap injected context size (chars/lines) before prompt injection and include a short stderr preview in warnings for easier debugging.
- Expand tests for skip conditions (queue > 0), fallback double-run prevention, and manual override skipping in both providers.

## Task Breakdown

### Phase 1: Config Schema Changes

#### 1.1 Update TypeScript Types
- [x] Add `heartbeatPreHook?: string[]` to `SessionConfig` type in `src/config/config.ts`
- [x] Add `heartbeatPreHookTimeoutSeconds?: number` to `SessionConfig` type (default: 30)

**File:** `src/config/config.ts`

```typescript
// Add to SessionConfig type (around line 12-25)
export type SessionConfig = {
  scope?: SessionScope;
  resetTriggers?: string[];
  idleMinutes?: number;
  heartbeatIdleMinutes?: number;
  store?: string;
  sessionArgNew?: string[];
  sessionArgResume?: string[];
  sessionArgBeforeBody?: boolean;
  sendSystemOnce?: boolean;
  sessionIntro?: string;
  typingIntervalSeconds?: number;
  heartbeatMinutes?: number;
  // NEW:
  heartbeatPreHook?: string[];           // Command + args to run before heartbeat
  heartbeatPreHookTimeoutSeconds?: number; // Default: 30
};
```

#### 1.2 Update Zod Schema
- [x] Add `heartbeatPreHook` array validation to `ReplySchema.session` object
- [x] Add `heartbeatPreHookTimeoutSeconds` positive integer validation

**File:** `src/config/config.ts`

```typescript
// Add to session schema (around line 90-106)
.object({
  scope: z.union([z.literal("per-sender"), z.literal("global")]).optional(),
  resetTriggers: z.array(z.string()).optional(),
  idleMinutes: z.number().int().positive().optional(),
  heartbeatIdleMinutes: z.number().int().positive().optional(),
  store: z.string().optional(),
  sessionArgNew: z.array(z.string()).optional(),
  sessionArgResume: z.array(z.string()).optional(),
  sessionArgBeforeBody: z.boolean().optional(),
  sendSystemOnce: z.boolean().optional(),
  sessionIntro: z.string().optional(),
  typingIntervalSeconds: z.number().int().positive().optional(),
  // NEW:
  heartbeatPreHook: z.array(z.string()).optional(),
  heartbeatPreHookTimeoutSeconds: z.number().int().positive().optional(),
})
```

---

### Phase 2: Create Shared Pre-Hook Module

#### 2.1 Create New Module
- [x] Create `src/auto-reply/heartbeat-prehook.ts` with shared logic for both providers
- [x] Allow optional logger/context input; keep internal logging minimal (debug-level only); let callers log structured summaries
- [x] Cap stdout before injection (e.g., max chars/lines) and include a short stderr preview in warnings

**New File:** `src/auto-reply/heartbeat-prehook.ts`

```typescript
import { logVerbose, danger } from "../globals.js";
import { logDebug, logWarn } from "../logger.js";
import { runCommandWithTimeout, type SpawnResult } from "../process/exec.js";
import type { WarelayConfig } from "../config/config.js";

export type PreHookResult = {
  context?: string;      // stdout to prepend to heartbeat
  durationMs: number;
  error?: string;        // error message if failed
  timedOut?: boolean;
};

const DEFAULT_PREHOOK_TIMEOUT_SECONDS = 30;

export function buildHeartbeatPrompt(
  basePrompt: string,
  preHookContext?: string,
): string {
  if (!preHookContext?.trim()) {
    return basePrompt;
  }
  return `${basePrompt}\n\n---\nContext from pre-hook:\n${preHookContext.trim()}`;
}

export async function runHeartbeatPreHook(
  cfg: WarelayConfig,
  commandRunner: typeof runCommandWithTimeout = runCommandWithTimeout,
): Promise<PreHookResult> {
  const sessionCfg = cfg.inbound?.reply?.session;
  const preHookCommand = sessionCfg?.heartbeatPreHook;
  
  if (!preHookCommand?.length) {
    return { durationMs: 0 };
  }

  const timeoutSeconds = sessionCfg?.heartbeatPreHookTimeoutSeconds ?? DEFAULT_PREHOOK_TIMEOUT_SECONDS;
  const timeoutMs = timeoutSeconds * 1000;
  const started = Date.now();

  logVerbose(`Running heartbeat pre-hook: ${preHookCommand.join(" ")}`);

  try {
    const result: SpawnResult = await commandRunner(preHookCommand, { timeoutMs });
    const durationMs = Date.now() - started;
    
    if (result.killed || result.signal === "SIGKILL") {
      logWarn(`Heartbeat pre-hook timed out after ${timeoutSeconds}s`);
      return {
        durationMs,
        timedOut: true,
        error: `Pre-hook timed out after ${timeoutSeconds}s`,
      };
    }

    if ((result.code ?? 0) !== 0) {
      const errorMsg = `Pre-hook exited with code ${result.code}`;
      logWarn(errorMsg);
      logVerbose(`Pre-hook stderr: ${result.stderr?.trim() || "(empty)"}`);
      return {
        durationMs,
        error: errorMsg,
      };
    }

    const stdout = result.stdout?.trim();
    logVerbose(`Pre-hook completed in ${durationMs}ms, output length: ${stdout?.length ?? 0}`);
    
    if (stdout) {
      logDebug(`Pre-hook output: ${stdout.slice(0, 200)}${stdout.length > 200 ? "..." : ""}`);
    }

    return {
      context: stdout || undefined,
      durationMs,
    };
  } catch (err) {
    const durationMs = Date.now() - started;
    const anyErr = err as { killed?: boolean; signal?: string };
    
    if (anyErr.killed || anyErr.signal === "SIGKILL") {
      return {
        durationMs,
        timedOut: true,
        error: `Pre-hook timed out after ${timeoutSeconds}s`,
      };
    }

    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(danger(`Heartbeat pre-hook failed: ${errorMsg}`));
    
    return {
      durationMs,
      error: errorMsg,
    };
  }
}
```

---

### Phase 3: Integrate Pre-Hook into Web Provider

#### 3.1 Update Web Heartbeat
- [x] Import `runHeartbeatPreHook` and `buildHeartbeatPrompt` in `src/web/auto-reply.ts`
- [x] Centralize pre-hook execution inside `runWebHeartbeatOnce`; call from `runReplyHeartbeat` with `skipPreHook: true` to avoid double runs in fallback flow
- [x] Run pre-hook only after queue/interval guards and after a recipient is determined
- [x] Add in-flight guard to prevent overlapping heartbeats when pre-hook runs long
- [x] Log pre-hook outcomes via the existing heartbeat logger (structured), keeping the hook’s own logging minimal

**File:** `src/web/auto-reply.ts`

Add import at top:
```typescript
import { runHeartbeatPreHook, buildHeartbeatPrompt } from "../auto-reply/heartbeat-prehook.js";
```

Modify `runReplyHeartbeat` function (around line 797):
```typescript
const runReplyHeartbeat = async () => {
  const queued = getQueueSize();
  if (queued > 0) {
    heartbeatLogger.info(
      { connectionId, reason: "requests-in-flight", queued },
      "reply heartbeat skipped",
    );
    console.log(success("heartbeat: skipped (requests in flight)"));
    return;
  }
  if (!replyHeartbeatMinutes) return;
  const tickStart = Date.now();
  
  // NEW: Run pre-hook to gather context
  const preHookResult = await runHeartbeatPreHook(cfg);
  if (preHookResult.error) {
    heartbeatLogger.warn(
      { connectionId, error: preHookResult.error, durationMs: preHookResult.durationMs, timedOut: preHookResult.timedOut },
      "heartbeat pre-hook failed (continuing with basic heartbeat)",
    );
  } else if (preHookResult.context) {
    heartbeatLogger.info(
      { connectionId, contextLength: preHookResult.context.length, durationMs: preHookResult.durationMs },
      "heartbeat pre-hook succeeded",
    );
  }
  
  // Build heartbeat prompt with optional pre-hook context
  const heartbeatPrompt = buildHeartbeatPrompt(HEARTBEAT_PROMPT, preHookResult.context);
  
  // ... rest of function, replace HEARTBEAT_PROMPT with heartbeatPrompt ...
```

Also update `runWebHeartbeatOnce` (around line 98) to support pre-hook:
```typescript
export async function runWebHeartbeatOnce(opts: {
  cfg?: ReturnType<typeof loadConfig>;
  to: string;
  verbose?: boolean;
  replyResolver?: typeof getReplyFromConfig;
  runtime?: RuntimeEnv;
  sender?: typeof sendMessageWeb;
  sessionId?: string;
  overrideBody?: string;
  dryRun?: boolean;
  skipPreHook?: boolean;  // NEW: allow skipping for manual/override cases
}) {
  // ... existing setup code ...
  
  // NEW: Run pre-hook unless skipped or overrideBody provided
  let heartbeatPrompt = HEARTBEAT_PROMPT;
  if (!overrideBody && !opts.skipPreHook) {
    const preHookResult = await runHeartbeatPreHook(cfg);
    if (preHookResult.error) {
      heartbeatLogger.warn(
        { to, error: preHookResult.error, durationMs: preHookResult.durationMs },
        "heartbeat pre-hook failed",
      );
    }
    heartbeatPrompt = buildHeartbeatPrompt(HEARTBEAT_PROMPT, preHookResult.context);
  }
  
  // ... use heartbeatPrompt instead of HEARTBEAT_PROMPT in replyResolver call ...
```

---

### Phase 4: Integrate Pre-Hook into Twilio Provider

#### 4.1 Update Twilio Heartbeat
- [x] Import `runHeartbeatPreHook` and `buildHeartbeatPrompt` in `src/twilio/heartbeat.ts`
- [x] Add `cfg?` (or injected `loadConfig`) plus `skipPreHook` and `overrideBody` gates; avoid loading real user config in tests
- [x] Modify `runTwilioHeartbeatOnce()` to call pre-hook (with size-capped stdout) and log via structured logger/context

**File:** `src/twilio/heartbeat.ts`

Add import at top:
```typescript
import { runHeartbeatPreHook, buildHeartbeatPrompt } from "../auto-reply/heartbeat-prehook.js";
import { loadConfig } from "../config/config.js";
```

Modify `runTwilioHeartbeatOnce` function:
```typescript
export async function runTwilioHeartbeatOnce(opts: {
  to: string;
  verbose?: boolean;
  runtime?: RuntimeEnv;
  replyResolver?: ReplyResolver;
  overrideBody?: string;
  dryRun?: boolean;
  skipPreHook?: boolean;  // NEW
}) {
  const {
    to,
    verbose: _verbose = false,
    runtime = defaultRuntime,
    overrideBody,
    dryRun = false,
    skipPreHook = false,  // NEW
  } = opts;
  const replyResolver = opts.replyResolver ?? getReplyFromConfig;
  const cfg = loadConfig();  // NEW: load config for pre-hook

  // ... existing overrideBody handling ...

  // NEW: Run pre-hook unless skipped
  let heartbeatPrompt = HEARTBEAT_PROMPT;
  if (!skipPreHook) {
    const preHookResult = await runHeartbeatPreHook(cfg);
    if (preHookResult.error) {
      logInfo(`Pre-hook failed: ${preHookResult.error} (continuing)`, runtime);
    }
    heartbeatPrompt = buildHeartbeatPrompt(HEARTBEAT_PROMPT, preHookResult.context);
  }

  const replyResult = await replyResolver(
    {
      Body: heartbeatPrompt,  // Use dynamic prompt
      From: to,
      To: to,
      MessageSid: undefined,
    },
    undefined,
  );
  
  // ... rest unchanged ...
```

---

### Phase 5: Unit Tests

#### 5.1 Test Pre-Hook Module
- [x] Create `src/auto-reply/heartbeat-prehook.test.ts`

**New File:** `src/auto-reply/heartbeat-prehook.test.ts`

```typescript
import { describe, expect, it, vi } from "vitest";
import { buildHeartbeatPrompt, runHeartbeatPreHook } from "./heartbeat-prehook.js";
import type { WarelayConfig } from "../config/config.js";
import type { SpawnResult } from "../process/exec.js";

describe("buildHeartbeatPrompt", () => {
  it("returns base prompt when no context", () => {
    expect(buildHeartbeatPrompt("HEARTBEAT ultrathink")).toBe("HEARTBEAT ultrathink");
    expect(buildHeartbeatPrompt("HEARTBEAT ultrathink", "")).toBe("HEARTBEAT ultrathink");
    expect(buildHeartbeatPrompt("HEARTBEAT ultrathink", "   ")).toBe("HEARTBEAT ultrathink");
  });

  it("appends context when provided", () => {
    const result = buildHeartbeatPrompt("HEARTBEAT ultrathink", "You have 3 unread emails");
    expect(result).toBe("HEARTBEAT ultrathink\n\n---\nContext from pre-hook:\nYou have 3 unread emails");
  });

  it("trims context whitespace", () => {
    const result = buildHeartbeatPrompt("HEARTBEAT", "  context with spaces  ");
    expect(result).toContain("context with spaces");
    expect(result).not.toContain("  context");
  });
});

describe("runHeartbeatPreHook", () => {
  it("returns empty result when no pre-hook configured", async () => {
    const cfg: WarelayConfig = {};
    const result = await runHeartbeatPreHook(cfg);
    expect(result.durationMs).toBe(0);
    expect(result.context).toBeUndefined();
    expect(result.error).toBeUndefined();
  });

  it("returns stdout as context on success", async () => {
    const cfg: WarelayConfig = {
      inbound: {
        reply: {
          mode: "command",
          command: ["echo"],
          session: {
            heartbeatPreHook: ["echo", "email summary"],
          },
        },
      },
    };
    const mockRunner = vi.fn().mockResolvedValue({
      stdout: "email summary\n",
      stderr: "",
      code: 0,
      signal: null,
      killed: false,
    } satisfies SpawnResult);

    const result = await runHeartbeatPreHook(cfg, mockRunner);
    expect(result.context).toBe("email summary");
    expect(result.error).toBeUndefined();
    expect(mockRunner).toHaveBeenCalledWith(
      ["echo", "email summary"],
      { timeoutMs: 30000 },
    );
  });

  it("returns error on non-zero exit", async () => {
    const cfg: WarelayConfig = {
      inbound: {
        reply: {
          mode: "command",
          command: ["echo"],
          session: {
            heartbeatPreHook: ["failing-script"],
          },
        },
      },
    };
    const mockRunner = vi.fn().mockResolvedValue({
      stdout: "",
      stderr: "error output",
      code: 1,
      signal: null,
      killed: false,
    } satisfies SpawnResult);

    const result = await runHeartbeatPreHook(cfg, mockRunner);
    expect(result.context).toBeUndefined();
    expect(result.error).toContain("exited with code 1");
  });

  it("handles timeout gracefully", async () => {
    const cfg: WarelayConfig = {
      inbound: {
        reply: {
          mode: "command",
          command: ["echo"],
          session: {
            heartbeatPreHook: ["slow-script"],
            heartbeatPreHookTimeoutSeconds: 5,
          },
        },
      },
    };
    const mockRunner = vi.fn().mockResolvedValue({
      stdout: "",
      stderr: "",
      code: null,
      signal: "SIGKILL",
      killed: true,
    } satisfies SpawnResult);

    const result = await runHeartbeatPreHook(cfg, mockRunner);
    expect(result.timedOut).toBe(true);
    expect(result.error).toContain("timed out");
    expect(result.context).toBeUndefined();
  });

  it("uses custom timeout from config", async () => {
    const cfg: WarelayConfig = {
      inbound: {
        reply: {
          mode: "command",
          command: ["echo"],
          session: {
            heartbeatPreHook: ["script"],
            heartbeatPreHookTimeoutSeconds: 60,
          },
        },
      },
    };
    const mockRunner = vi.fn().mockResolvedValue({
      stdout: "ok",
      stderr: "",
      code: 0,
      signal: null,
      killed: false,
    } satisfies SpawnResult);

    await runHeartbeatPreHook(cfg, mockRunner);
    expect(mockRunner).toHaveBeenCalledWith(
      ["script"],
      { timeoutMs: 60000 },
    );
  });

  it("returns empty context for whitespace-only stdout", async () => {
    const cfg: WarelayConfig = {
      inbound: {
        reply: {
          mode: "command",
          command: ["echo"],
          session: {
            heartbeatPreHook: ["script"],
          },
        },
      },
    };
    const mockRunner = vi.fn().mockResolvedValue({
      stdout: "   \n\n   ",
      stderr: "",
      code: 0,
      signal: null,
      killed: false,
    } satisfies SpawnResult);

    const result = await runHeartbeatPreHook(cfg, mockRunner);
    expect(result.context).toBeUndefined();
    expect(result.error).toBeUndefined();
  });
});
```

#### 5.2 Update Existing Tests
- [x] Add pre-hook tests to `src/twilio/heartbeat.test.ts` (cfg injection, override skips hook)
- [ ] Add pre-hook tests to `src/web/auto-reply.test.ts` (skip on queue>0, no double-run in fallback, override skips hook, in-flight guard)

---

### Phase 6: Documentation

#### 6.1 Update Config Documentation
- [ ] Document new config options in `README.md` or dedicated docs
- [ ] Add example pre-hook script patterns

**Example Config:**
```json5
{
  "inbound": {
    "reply": {
      "mode": "command",
      "command": ["claude", "{{Body}}"],
      "session": {
        "scope": "per-sender",
        "heartbeatMinutes": 30,
        // NEW: Pre-hook configuration
        "heartbeatPreHook": ["./scripts/fetch-unread-emails.sh"],
        "heartbeatPreHookTimeoutSeconds": 45
      }
    }
  }
}
```

---

## Office 365 Email Integration Options

### Background
The pre-hook feature is designed to be script-agnostic. Users can write any executable that outputs context to stdout. Below are options for Office 365 email integration.

### Option 1: Microsoft Graph API with Device Code Flow (Recommended for Personal Use)

**Pros:**
- Works without admin consent for personal accounts
- One-time interactive authentication, then refresh tokens
- Full access to mailbox

**Implementation:**
```bash
#!/bin/bash
# fetch-unread-emails.sh

# Uses Azure CLI or custom OAuth token management
# Prerequisites: az login with device code, or store refresh token

ACCESS_TOKEN=$(az account get-access-token --resource https://graph.microsoft.com --query accessToken -o tsv)

curl -s -H "Authorization: Bearer $ACCESS_TOKEN" \
  "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?\$filter=isRead eq false&\$top=5&\$select=subject,from,receivedDateTime" \
  | jq -r '.value[] | "- \(.receivedDateTime | split("T")[0]): \(.from.emailAddress.name // .from.emailAddress.address): \(.subject)"'
```

**Setup Steps:**
1. Register an Azure AD app (single-tenant or multi-tenant)
2. Add `Mail.Read` delegated permission
3. Use device code flow for initial auth: `az login --scope https://graph.microsoft.com/Mail.Read`
4. Store refresh token securely for unattended use

### Option 2: Application Permissions (Admin Consent Required)

**Pros:**
- No user interaction needed after setup
- Works with client credentials flow

**Cons:**
- Requires Azure AD admin consent
- Grants access to all mailboxes (use with caution)

**Implementation:**
```bash
#!/bin/bash
# fetch-emails-app-auth.sh

CLIENT_ID="your-app-id"
CLIENT_SECRET="your-secret"
TENANT_ID="your-tenant"
USER_EMAIL="user@domain.com"

# Get token
TOKEN=$(curl -s -X POST \
  "https://login.microsoftonline.com/$TENANT_ID/oauth2/v2.0/token" \
  -d "client_id=$CLIENT_ID" \
  -d "client_secret=$CLIENT_SECRET" \
  -d "scope=https://graph.microsoft.com/.default" \
  -d "grant_type=client_credentials" \
  | jq -r '.access_token')

# Fetch emails
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://graph.microsoft.com/v1.0/users/$USER_EMAIL/mailFolders/inbox/messages?\$filter=isRead eq false&\$top=5" \
  | jq -r '.value[] | "- \(.from.emailAddress.name): \(.subject)"'
```

### Option 3: Using `msgraph-cli` (Easiest Setup)

Microsoft provides an official CLI tool:

```bash
# Install
pip install msgraph-cli

# Login (one-time, uses device code)
mgc login --scopes Mail.Read

# Fetch unread emails
mgc users mail-folders messages list \
  --user-id me \
  --mail-folder-id inbox \
  --filter "isRead eq false" \
  --top 5 \
  --select subject,from,receivedDateTime \
  --output json | jq -r '.value[] | "- \(.subject)"'
```

### Option 4: IMAP (Legacy, but Simple)

If OAuth is too complex, IMAP with app passwords works:

```bash
#!/bin/bash
# fetch-imap-emails.sh
# Requires: curl with IMAP support, or python imaplib

python3 << 'EOF'
import imaplib
import email
from email.header import decode_header

mail = imaplib.IMAP4_SSL("outlook.office365.com")
mail.login("user@domain.com", "app-password-here")
mail.select("inbox")

_, messages = mail.search(None, "UNSEEN")
for num in messages[0].split()[:5]:
    _, msg = mail.fetch(num, "(RFC822)")
    email_msg = email.message_from_bytes(msg[0][1])
    subject = decode_header(email_msg["Subject"])[0][0]
    if isinstance(subject, bytes):
        subject = subject.decode()
    print(f"- {email_msg['From']}: {subject}")

mail.logout()
EOF
```

### Recommended Script Structure

```bash
#!/bin/bash
# ~/.warelay/scripts/email-context.sh
# Output format: plain text summary for AI consumption

set -e

# Track last check time
LAST_CHECK_FILE="$HOME/.warelay/last-email-check"
if [ -f "$LAST_CHECK_FILE" ]; then
  SINCE=$(cat "$LAST_CHECK_FILE")
else
  SINCE=$(date -u -v-1H +"%Y-%m-%dT%H:%M:%SZ")  # Default: last hour
fi

# Fetch emails (using your preferred method)
EMAILS=$(fetch_unread_emails_since "$SINCE")

# Update last check time
date -u +"%Y-%m-%dT%H:%M:%SZ" > "$LAST_CHECK_FILE"

# Output summary if any emails found
if [ -n "$EMAILS" ]; then
  echo "Unread emails since last heartbeat:"
  echo "$EMAILS"
fi

# Exit cleanly even with no emails (empty stdout = no context added)
exit 0
```

---

## Implementation Order

```
Phase 1: Config Schema (1-2 hours)
    |
    v
Phase 2: Pre-Hook Module (2-3 hours)
    |
    v
Phase 3: Web Provider Integration (1-2 hours)
    |
    v
Phase 4: Twilio Provider Integration (1 hour)
    |
    v
Phase 5: Unit Tests (2-3 hours)
    |
    v
Phase 6: Documentation (1 hour)
```

**Total Estimated Time:** 8-12 hours

---

## Validation Criteria

### Config Validation
- [ ] `pnpm lint` passes with new schema
- [ ] `pnpm build` compiles without errors
- [ ] Invalid config (e.g., negative timeout) produces clear error message

### Functional Validation
- [ ] Pre-hook runs before each heartbeat when configured
- [ ] Pre-hook stdout appears in Claude's context (visible in verbose logs)
- [ ] Pre-hook timeout doesn't block heartbeat (basic heartbeat still sends)
- [ ] Pre-hook failure doesn't block heartbeat (basic heartbeat still sends)
- [ ] Empty pre-hook output results in normal heartbeat prompt
- [ ] Pre-hook respects configured timeout value

### Test Validation
- [ ] `pnpm test` passes all new tests
- [ ] Coverage thresholds maintained (70% lines/branches/functions/statements)

### Manual Testing
1. Configure a simple pre-hook: `["echo", "Test context"]`
2. Run `warelay relay --provider web --verbose`
3. Wait for heartbeat or trigger with `warelay heartbeat`
4. Verify logs show pre-hook execution and context injection
5. Test timeout with: `["sleep", "60"]` and `heartbeatPreHookTimeoutSeconds: 2`
6. Verify heartbeat still fires after timeout

---

## Code References

### Internal Files to Modify
| File | Purpose |
|------|---------|
| `src/config/config.ts` | Add new config types and Zod schema |
| `src/auto-reply/heartbeat-prehook.ts` | **NEW** - Shared pre-hook logic |
| `src/auto-reply/heartbeat-prehook.test.ts` | **NEW** - Unit tests |
| `src/web/auto-reply.ts` | Integrate pre-hook into web heartbeat |
| `src/twilio/heartbeat.ts` | Integrate pre-hook into Twilio heartbeat |
| `src/twilio/heartbeat.test.ts` | Add pre-hook test cases |

### External References
| Resource | URL |
|----------|-----|
| Microsoft Graph Mail API | https://learn.microsoft.com/en-us/graph/api/resources/mail-api-overview |
| Device Code Flow | https://learn.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-device-code |
| Microsoft Graph CLI | https://github.com/microsoftgraph/msgraph-cli |
| Azure CLI | https://learn.microsoft.com/en-us/cli/azure/install-azure-cli |

### Relevant Existing Patterns
| Pattern | File | Purpose |
|---------|------|---------|
| `runCommandWithTimeout` | `src/process/exec.ts` | Execute commands with timeout |
| `loadConfig` | `src/config/config.ts` | Load and validate config |
| Zod schemas | `src/config/config.ts` | Config validation patterns |
| Heartbeat constants | `src/web/auto-reply.ts` | `HEARTBEAT_PROMPT`, `HEARTBEAT_TOKEN` |

---

## Notes

- The pre-hook is intentionally script-agnostic to support any context source (email, calendar, RSS, etc.)
- The `---\nContext from pre-hook:` separator helps Claude distinguish injected context from the heartbeat command
- Pre-hook failures are logged but don't block heartbeats - this is intentional for reliability
- Consider adding `heartbeatPreHookCwd` in the future if users need to run scripts from specific directories
