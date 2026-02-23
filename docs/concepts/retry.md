---
summary: "Retry policy for outbound provider calls"
read_when:
  - Updating provider retry behavior or defaults
  - Debugging provider send errors or rate limits
title: "Retry Policy"
---

# Retry policy

## Goals

- Retry per HTTP request, not per multi-step flow.
- Preserve ordering by retrying only the current step.
- Avoid duplicating non-idempotent operations.

## Defaults

- Attempts: 3
- Max delay cap: 30000 ms
- Jitter: 0.1 (10 percent)
- Provider defaults:
  - Telegram min delay: 400 ms
  - Discord min delay: 500 ms

## Behavior

### Discord

- Retries only on rate-limit errors (HTTP 429).
- Uses Discord `retry_after` when available, otherwise exponential backoff.

### Telegram

- Retries on transient errors (429, timeout, connect/reset/closed, temporarily unavailable).
- Uses `retry_after` when available, otherwise exponential backoff.
- Markdown parse errors are not retried; they fall back to plain text.

## Configuration

Set retry policy per provider in `~/.openclaw/openclaw.json`:

```json5
{
  channels: {
    telegram: {
      retry: {
        attempts: 3,
        minDelayMs: 400,
        maxDelayMs: 30000,
        jitter: 0.1,
      },
    },
    discord: {
      retry: {
        attempts: 3,
        minDelayMs: 500,
        maxDelayMs: 30000,
        jitter: 0.1,
      },
    },
  },
}
```

## LLM Completion Retry

Transient LLM provider errors (overloaded, 529, 503, 502, 504, timeouts, rate limits)
are retried with exponential backoff **before** falling over to the next auth profile
or fallback model. Non-retryable errors (auth, billing, format, model not found) skip
retry and fail immediately.

### Completion retry defaults

- Attempts: 3
- Min delay: 2000 ms
- Max delay cap: 30000 ms
- Jitter: 0.1 (10 percent)
- Total timeout: 60000 ms

### Backoff formula

```
delay = min(minDelayMs * 2^(attempt-1), maxDelayMs) * (1 + jitter * random(-1, 1))
```

When the error message contains a `Retry-After` hint (e.g. "retry after 30s"),
the hinted delay is used instead of the exponential calculation (still clamped
to `maxDelayMs`).

### Completion retry configuration

Set LLM completion retry policy in `~/.openclaw/openclaw.json`:

```json5
{
  agents: {
    defaults: {
      completionRetry: {
        attempts: 3, // max retries before failover/error
        minDelayMs: 2000, // initial backoff delay
        maxDelayMs: 30000, // max backoff delay cap
        jitter: 0.1, // jitter factor (0-1)
        timeoutMs: 60000, // total timeout across all retry attempts
      },
    },
  },
}
```

### Retryable errors

- Overloaded (`overloaded_error`, "service unavailable", "high demand")
- Transient HTTP (500, 502, 503, 504, 521-524, 529)
- Timeouts ("timed out", "deadline exceeded")
- Rate limits (429, "too many requests", "quota exceeded")

### Non-retryable errors

- Auth errors (401, 403, invalid API key)
- Billing errors (402, insufficient credits)
- Format errors (tool call ID mismatch)
- Model not found

## Notes

- Channel retries apply per request (message send, media upload, reaction, poll, sticker).
- Composite flows do not retry completed steps.
- LLM completion retries happen before auth profile rotation and model failover.
