# OpenClaw Fork - Custom Modifications

**Fork:** https://github.com/10x-oss/openclaw
**Upstream:** https://github.com/openclaw/openclaw

This document tracks custom modifications made to this OpenClaw fork.

## Modifications

### 1. Tool Activity Streaming (Progress Visibility)

**Date Added:** 2026-02-05
**Status:** Local modification (not submitted upstream yet)
**Purpose:** Show real-time tool activity in Telegram draft bubble during agent execution

**Problem:** When the agent runs agentic tasks (reading files, running commands, searching), the user only sees "typing..." with no visibility into what's actually happening. This makes long-running tasks feel opaque.

**Solution:** Added `onToolActivity` callback that fires when tools start/end execution. The Telegram dispatch layer updates the draft bubble with human-readable summaries like:

- 📖 Reading config.ts...
- ⚡ Running: npm test
- 🔍 Searching: \*.tsx
- 🌐 Searching: web query

**Files Modified:**

- `src/auto-reply/types.ts` - Added `ToolActivityEvent` type and `onToolActivity` callback
- `src/auto-reply/reply/agent-runner-execution.ts` - Added `formatToolActivitySummary()` helper and wired up tool events
- `src/telegram/bot-message-dispatch.ts` - Connected callback to draft stream

**How it works:**

1. Agent runs a tool (read, write, bash, etc.)
2. `onAgentEvent` receives the tool start event
3. `formatToolActivitySummary()` creates a human-readable message
4. `onToolActivity` callback is fired
5. If draft streaming is available: shows in the draft bubble
6. If draft streaming is unavailable: sends an actual message (silent notification), then auto-deletes after 3 seconds
7. When response text starts streaming, it replaces the tool activity

**Config options:**

```json
"telegram": {
  "toolActivity": "persist"  // "off" | "persist" | "transient"
}
```

---

### 2. Thinking Indicator (Agent Start Visibility)

**Date Added:** 2026-02-05
**Status:** Local modification (not submitted upstream yet)
**Purpose:** Show when the agent starts processing a message

**Problem:** Users don't know when the agent begins working on their message until tool calls start or the response streams.

**Solution:** Added `thinkingIndicator` config that sends "🤔 Thinking..." when processing begins.

**Config options:**

```json
"telegram": {
  "thinkingIndicator": "persist"  // "off" | "persist" | "transient"
}
```

- `"off"` (default): no indicator
- `"persist"`: message stays in chat history
- `"transient"`: message auto-deletes when response arrives

**Files Modified:**

- `src/config/types.telegram.ts` - Added `thinkingIndicator` config type
- `src/config/zod-schema.providers-core.ts` - Schema validation
- `src/telegram/bot-message-dispatch.ts` - Send indicator and cleanup

---

## Upgrade Notes

When upgrading from upstream OpenClaw:

1. Check if similar functionality has been added upstream
2. If added upstream, remove our modifications and use the official implementation
3. If not added, re-apply these changes after merging upstream

**Re-apply steps:**

```bash
git fetch upstream
git checkout main
git merge upstream/main
# If conflicts, manually re-apply the changes from this FORK.md
```

**Files to check for conflicts:**

- `src/auto-reply/types.ts`
- `src/auto-reply/reply/agent-runner-execution.ts`
- `src/telegram/bot-message-dispatch.ts`
- `src/config/types.telegram.ts`
- `src/config/zod-schema.providers-core.ts`
