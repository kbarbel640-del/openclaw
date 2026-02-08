# 🍗 The Fried Chicken Error — Auth-Based Rate Limit Misclassification

## What Is It?

When using Anthropic via auth-based (session/cookie) access rather than API keys, rate limit errors can be misclassified as "Context overflow" errors. This prevents the model fallback chain from triggering, showing users a false error message instead of gracefully degrading to a fallback model.

We nicknamed it the "Fried Chicken Error" because the false "Context overflow" message looks like a real, substantial error (a whole meal) — but it's actually just a rate limit with nothing behind it (just gas). The name stuck because it perfectly captures the frustration: you think something serious is wrong with your context window, but the real problem is just temporary throttling.

There's also a practical reason for the alias: the bug is self-referential. Discussing the error by its real name (e.g., quoting the "Context overflow" message) can _trigger_ the very bug being discussed, because `sanitizeUserFacingText()` pattern-matches against all text content — including agent replies. Using "Fried Chicken Error" sidesteps this entirely. See [#3594](https://github.com/openclaw/openclaw/issues/3594) for that related bug.

## Who's Affected?

- Users authenticating to Anthropic via OAuth/session tokens (Claude Pro/Max subscriptions)
- NOT users with direct API keys (those return proper 429 status codes)

## Symptoms

- Every other message shows: `⚠️ Context overflow — prompt too large for this model`
- The error appears even with short messages
- Fallback models never activate despite being configured
- The pattern correlates with heavy usage (rate limiting), not actual context size

## Root Cause

OpenClaw's error handling checks for context overflow **before** checking for rate limits. When Anthropic's auth pathway returns an error that textually matches context overflow patterns (but is actually a rate limit), the error gets trapped in the context overflow handler, which:

1. Attempts auto-compaction (unnecessary, wastes time)
2. Returns an error to the user
3. **Never throws a `FailoverError`**, so the fallback chain never runs

## The Fix

In `src/agents/pi-embedded-runner/run.ts`, we added a guard that checks `classifyFailoverReason()` before entering the context overflow handler:

```typescript
// Before (broken):
if (isContextOverflowError(errorText)) {
  // ... compaction, return error — fallback chain never reached
}

// After (fixed):
const earlyFailoverReason = classifyFailoverReason(errorText);
const isAlsoFailover = earlyFailoverReason !== null;
if (isContextOverflowError(errorText) && !isAlsoFailover) {
  // ... only for genuine context overflow errors
}
// Rate limits now fall through to the existing failover machinery ✅
```

Same guard applied to `formatAssistantErrorText()` and `sanitizeUserFacingText()` in `errors.ts`.

## Recommended Fallback Configuration

For auth-based Anthropic users, order your fallback chain to try **same-provider models first**. When Opus is rate-limited, Sonnet and Haiku on the same auth typically still work:

```json
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "anthropic/claude-opus-4-6",
        "fallbacks": [
          "anthropic/claude-sonnet-4-5",
          "anthropic/claude-haiku-4-5",
          "groq/llama-3.3-70b-versatile",
          "gemini/gemini-2.0-flash",
          "openrouter/qwen/qwen3-next-80b-a3b-instruct:free"
        ]
      }
    }
  }
}
```

**Why this order matters:** Anthropic throttles per-model, not per-account. If Opus hits a rate limit, Sonnet and Haiku are likely still available on the same auth session. Falling back to Groq or Gemini first means losing tool capabilities and context that Anthropic models handle natively.

## Related Issues

- [#3594](https://github.com/openclaw/openclaw/issues/3594) — `sanitizeUserFacingText` false positives
- [#8847](https://github.com/openclaw/openclaw/issues/8847) — Same bug on Telegram

## Testing

The fix activates when you next hit a rate limit on an auth-based provider. Instead of seeing the false "Context overflow" error, you should see the fallback chain engage (potentially with a brief delay as it tries each model).

To verify the fix is working, check logs after a rate limit event:

```bash
openclaw logs --follow | grep "fried-chicken\|failover\|fallback"
```

The `[fried-chicken]` log prefix indicates the fix detected an ambiguous error and correctly routed it to the fallback chain.
