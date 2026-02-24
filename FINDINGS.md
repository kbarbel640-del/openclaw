# OpenClaw Codebase Bug Scan — Findings Report

**Date:** 2026-02-24
**Branch:** `main` (097a6a83a)
**Scope:** `src/` — TypeScript codebase (~450K LoC, 3700+ files)

## Summary

Scanned the OpenClaw codebase for bugs, type safety issues, and improvement opportunities. Cross-referenced against 20 open GitHub issues. Found **19 actionable findings** across 4 severity tiers.

**PR-ready findings:** 7 high-confidence, small-scope fixes (including 1 HIGH severity)
**Needs discussion:** 5 medium-scope issues requiring maintainer input
**Informational:** 7 code smells / performance concerns

---

## Priority 0: HIGH Severity

### 0. Missing `.catch` on subagent announce flow — potential gateway crash

**File:** `src/agents/subagent-registry.ts:318-336`
**Severity:** HIGH | **Confidence:** HIGH | **Fix complexity:** Low

```ts
void runSubagentAnnounceFlow({ ... }).then((didAnnounce) => {
  void finalizeSubagentCleanup(runId, entry.cleanup, didAnnounce);
});
// Missing .catch() — rejection becomes unhandled
```

`runSubagentAnnounceFlow` is fire-and-forget with `.then()` but no `.catch()`. If it rejects (network error, model API failure), the rejection propagates as unhandled. The global handler in `src/infra/unhandled-rejections.ts` calls `process.exit(1)` for non-transient errors — a single announce failure can crash the gateway.

**Fix:** Add `.catch((err) => log.warn(...))` to the chain.

**PR potential:** HIGH — critical reliability fix, small change.

---

## Priority 1: PR-Ready Bug Fixes

### 1. Missing German abort trigger `"hör auf"` — only ASCII romanization present

**File:** `src/auto-reply/reply/abort.ts:51`
**Severity:** Medium | **Confidence:** High | **Fix complexity:** Trivial
**Related:** Recent commit 4b316c33d (multilingual abort triggers)

The abort trigger list includes `"hoer auf"` (ASCII romanization) but not `"hör auf"` (actual German with umlaut). German speakers using standard keyboard input will not trigger abort.

**Fix:** Add `"hör auf"` to `ABORT_TRIGGERS` set.

**PR potential:** HIGH — simple one-line addition, directly follows the pattern of the recent multilingual PR.

---

### 2. No Unicode NFC normalization in abort trigger matching

**File:** `src/auto-reply/reply/abort.ts:73-81`
**Severity:** Medium | **Confidence:** High | **Fix complexity:** Trivial

`normalizeAbortTriggerText()` lowercases but doesn't call `.normalize("NFC")`. On platforms delivering NFD text (macOS pasteboard, some WhatsApp/IRC clients), accented triggers like `"aufhören"`, `"arrête"`, `"detén"` silently fail because NFD `"o\u0308"` doesn't match NFC `"ö"`.

**Fix:** Add `.normalize("NFC")` to `normalizeAbortTriggerText`.

```ts
function normalizeAbortTriggerText(text: string): string {
  return text
    .normalize("NFC") // ← add this
    .trim()
    .toLowerCase();
  // ...rest unchanged
}
```

**PR potential:** HIGH — small, well-scoped fix. Combines naturally with Finding #1.

---

### 3. `applyLoggingDefaults` doesn't apply `redactSensitive` default when `logging` key is absent

**File:** `src/config/defaults.ts:360-375`
**Severity:** Medium (security) | **Confidence:** High | **Fix complexity:** Trivial

When a user has no `logging:` block in their config, the function returns early without setting `redactSensitive: "tools"`. Fresh installs have no log redaction by default — sensitive data in tool call results appears in plaintext logs.

**Fix:**

```ts
const logging = cfg.logging ?? {}; // treat missing as empty object
```

**PR potential:** HIGH — security improvement, one-line change.

---

### 4. Config snapshot path missing `applyContextPruningDefaults` + `applyCompactionDefaults`

**File:** `src/config/io.ts:933-942` vs `src/config/io.ts:723-731`
**Severity:** Medium | **Confidence:** High | **Fix complexity:** Low

The live config path applies 7 default functions; the snapshot path (used by `openclaw config set/unset` and config status) only applies 5. Missing: `applyContextPruningDefaults` and `applyCompactionDefaults`. This causes `heartbeat.every` and `compaction.mode` defaults to differ between runtime and config tooling.

**Fix:** Add the two missing functions to the snapshot pipeline.

**PR potential:** HIGH — clear asymmetry bug, easy to verify.

---

### 5. Dead code branch in `isAbortRequestText`

**File:** `src/auto-reply/reply/abort.ts:99-104`
**Severity:** Low | **Confidence:** High | **Fix complexity:** Trivial

```ts
normalizedLower === "/stop" ||
  normalizeAbortTriggerText(normalizedLower) === "/stop" || // ← dead: always covered by line above
  isAbortTrigger(normalizedLower);
```

The second condition can never be true independently of the first — `normalizeAbortTriggerText` only strips punctuation/whitespace, so if input isn't already `"/stop"`, the transform can't produce it.

**Fix:** Remove the dead branch, or add a comment.

**PR potential:** MEDIUM — trivial cleanup, could bundle with Finding #1/#2.

---

## Priority 2: Needs Maintainer Discussion

### 6. `ABORT_MEMORY` has no TTL — stale flags survive session reuse

**File:** `src/auto-reply/reply/abort.ts:69-70`
**Severity:** Medium | **Confidence:** Medium

Module-global `ABORT_MEMORY` map has LRU eviction (cap 2000) but no TTL. An abort flag set hours ago for a session key that's been reassigned (e.g., `dmScope: "main"`) persists, potentially causing the first message to a new conversation to be treated as "already aborted."

**PR potential:** MEDIUM — needs design decision on TTL duration.

---

### 7. `pendingToolTasks` not awaited in `finally` block on error path

**File:** `src/auto-reply/reply/agent-runner.ts:429-431, 731-734`
**Severity:** Medium | **Confidence:** Medium

If `runAgentTurnWithFallback` throws, the `finally` block doesn't drain `pendingToolTasks`. Orphaned tool-result delivery promises continue running in the background, potentially racing with the next queued run.

**PR potential:** MEDIUM — straightforward fix but needs testing for side effects.

---

### 8. `resolveThreadSessionKeys` drops `parentSessionKey` when `threadId` is empty

**File:** `src/routing/session-key.ts:228-231`
**Severity:** Low-Medium | **Confidence:** Medium

When `threadId` is empty, the function returns `parentSessionKey: undefined` even when the caller provides one. Could cause thread context inheritance to fail in certain Slack/Discord scenarios.

**PR potential:** LOW — need to trace all callers to confirm impact.

---

### 9. Synchronous disk read per tool-result gate check

**File:** `src/auto-reply/reply/agent-runner-helpers.ts:20-32`
**Severity:** Low-Medium (perf) | **Confidence:** High

`resolveCurrentVerboseLevel` calls `loadSessionStore` (sync disk I/O) on every tool result emission check. With many tools per run, this adds measurable latency.

**PR potential:** LOW — performance optimization, needs caching strategy discussion.

---

## Priority 3: Type Safety Issues

### 10. `as any` tool execute call bypasses type safety

**File:** `src/auto-reply/reply/get-reply-inline-actions.ts:221`
**Severity:** Medium | **Confidence:** Medium

`{command, commandName, skillName} as any` passed to `tool.execute` — if the tool's execute signature changes, this silently passes wrong args.

---

### 11. `as unknown as ChutesStoredOAuth` on partial object

**File:** `src/agents/chutes-oauth.ts:164,225`
**Severity:** Medium | **Confidence:** Medium

Returns a manually-constructed object cast to `ChutesStoredOAuth`. If the type adds required fields, callers get `undefined` at runtime without compile-time warnings.

---

### 12. Non-null assertion on potentially null `channels` in legacy migration

**File:** `src/config/legacy.migrations.part-1.ts:355-356`
**Severity:** Low | **Confidence:** Medium

`channels!.whatsapp = ...` where `channels` comes from `getRecord()` which can return null. The null check before this point only validates a sub-property, not the object itself.

---

### 13. `parsed as SignalRpcResponse<T>` after JSON.parse without validation

**File:** `src/signal/client.ts:62`
**Severity:** Low | **Confidence:** Medium

No runtime validation guard after `JSON.parse`. If the Signal CLI returns unexpected JSON, the cast silently produces a mistyped object.

---

### 10b. Discord voice: speaking event listener never removed on reconnect

**File:** `src/discord/voice/manager.ts:437`
**Severity:** Medium | **Confidence:** HIGH

`connection.receiver.speaking.on("start", speakingHandler)` is added on voice join, but `leave()` calls `connection.destroy()` without removing the listener. On reconnects, old handlers accumulate — the stale closure captures the old `entry`, causing ghost audio captures and preventing GC of old session state.

**PR potential:** MEDIUM — needs `.off("start", speakingHandler)` before `connection.destroy()`.

---

### 10c. Telegram allowlist silently fails open on disk error

**File:** `src/telegram/bot-handlers.ts:388`
**Severity:** Medium | **Confidence:** Medium

`readChannelAllowFromStore("telegram", ...).catch(() => [])` silently returns empty array on disk errors. Combined with `isSenderAllowed(..., allowWhenEmpty=true)`, a transient disk error during allowlist check opens access to all senders. No warning is logged.

**PR potential:** MEDIUM — at minimum, add `log.warn()` in the catch handler.

---

## Priority 4: Informational

### 14. LINE flex template casts (`as FlexText`, `as FlexBox`) may omit required fields

**Files:** `src/line/flex-templates/*.ts` (pervasive)
**Severity:** Low | If LINE API changes required fields, these will fail silently at runtime.

### 15. Memory flush failures logged at verbose level only

**File:** `src/auto-reply/reply/agent-runner-memory.ts:167-170`
**Severity:** Low | Failed memory flushes should log at warn level for operational visibility.

### 16. Dummy no-op timer in Telegram text fragment buffer

**File:** `src/telegram/bot-handlers.ts:664`
**Severity:** Low | `setTimeout(() => {}, ...)` created just to satisfy type, immediately replaced. Holds timer reference unnecessarily.

### 17. Known markdown blockquote triple-newline bug

**File:** `src/markdown/ir.blockquote-spacing.test.ts:15-47`
**Severity:** Low | Explicitly documented in test as "BUG" — `markdownToIR` produces triple newline after blockquotes.

### 18. `then(fn, fn)` in status reactions masks chain errors

**File:** `src/channels/status-reactions.ts:171`
**Severity:** Low | `chainPromise.then(fn, fn)` passes same handler for success and rejection, silently discarding error context.

---

## Open Issues Cross-Reference

| Finding | Related Issue                                           |
| ------- | ------------------------------------------------------- |
| #1, #2  | Follow-up to PR #25103 (multilingual abort triggers)    |
| #3      | No existing issue — new finding                         |
| #4      | No existing issue — new finding                         |
| #6      | Tangentially related to #25254 (agent abort stuck runs) |
| #7      | Related to #25254 and #25272 (compaction timeout races) |
| #10     | No existing issue                                       |

**Issues NOT addressed by these findings** (already tracked):

- #25285 (reasoning visible in Telegram) — fix already merged (e8a4d5d9b)
- #25244 (MiniMax reasoning hardcoded) — in `providers/kilocode-shared.ts`, intentional catalog entry
- #25242 (negative inputTokens) — `normalizeUsage` in `agents/usage.ts` handles this with `asFiniteNumber`; likely UI-layer issue
- #25286 (ownerAllowFrom ["*"]) — complex auth chain in `command-auth.ts`, needs dedicated investigation

---

## Recommended PR Order

1. **PR 1** (Finding #0): "agents: add missing .catch on subagent announce flow"
   - HIGH severity — prevents potential gateway crash from unhandled rejection

2. **PR 2** (Findings #1 + #2 + #5): "auto-reply: add missing German abort trigger and NFC normalization"
   - Combines naturally: abort.ts changes only, easy to test

3. **PR 3** (Finding #3): "config: apply logging redaction default when logging key is absent"
   - Security improvement, one-line change

4. **PR 4** (Finding #4): "config: align snapshot defaults pipeline with live config path"
   - Bug fix, io.ts only

5. **PR 5** (Finding #7): "auto-reply: drain pendingToolTasks in finally block"
   - Race condition fix, needs careful testing

6. **PR 6** (Finding #10b): "discord: remove speaking listener on voice disconnect"
   - Resource leak fix
