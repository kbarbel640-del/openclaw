# Spec 03: Per-Sender Message Rate Limiting

## Agent Assignment: Agent 3 — "Rate Limiter Agent"

## Objective

Implement per-sender and per-session message rate limiting at the inbound dispatch layer. This prevents resource exhaustion (API credit burn, compute abuse) from any single sender, even authorized ones. Addresses **T-IMPACT-002** (Resource Exhaustion / DoS, rated High) where the threat model explicitly notes "No rate limiting" as the current mitigation.

---

## Threat Context

| Field              | Value                                             |
| ------------------ | ------------------------------------------------- |
| Threat ID          | T-IMPACT-002                                      |
| ATLAS ID           | AML.T0031                                         |
| Current risk       | High — no per-sender rate limiting                |
| Attack vector      | Automated message flooding, expensive tool calls  |
| Current mitigation | Auth-level rate limiting only (failed handshakes) |

---

## Scope of Changes

### Files to CREATE

| File                                      | Purpose                                            |
| ----------------------------------------- | -------------------------------------------------- |
| `src/security/message-rate-limit.ts`      | Per-sender/per-session sliding-window rate limiter |
| `src/security/message-rate-limit.test.ts` | Unit tests                                         |
| `src/security/cost-budget.ts`             | Optional cost-based budget tracking per sender     |
| `src/security/cost-budget.test.ts`        | Unit tests                                         |

### Files to MODIFY

| File                                 | Lines            | What to change                                           |
| ------------------------------------ | ---------------- | -------------------------------------------------------- |
| `src/auto-reply/dispatch.ts`         | 97               | Insert rate limit check before `dispatchReplyFromConfig` |
| `src/gateway/server-methods/chat.ts` | (gateway chat)   | Insert rate limit check for WebSocket/HTTP chat messages |
| `src/config/types.gateway.ts`        | 337              | Add `RateLimitConfig` to top-level or session config     |
| `src/security/audit.ts`              | 677              | Add audit check for rate limiting being disabled         |
| `src/security/dm-policy-shared.ts`   | (access control) | Pass rate limit result into access decision pipeline     |

### Files to READ (do not modify)

| File                                | Why                                                                                      |
| ----------------------------------- | ---------------------------------------------------------------------------------------- |
| `src/gateway/auth-rate-limit.ts`    | 234 lines — Reference for existing rate limiter pattern (sliding window, prune, dispose) |
| `src/channels/allow-from.ts`        | Understand sender identity format per channel                                            |
| `src/web/inbound/access-control.ts` | Understand WhatsApp inbound flow                                                         |
| `src/telegram/bot-access.ts`        | Understand Telegram sender identity                                                      |
| `src/discord/monitor/allow-list.ts` | Understand Discord sender identity                                                       |
| `src/slack/monitor/allow-list.ts`   | Understand Slack sender identity                                                         |

---

## Design

### Rate Limiter Architecture

```
Channel inbound
     │
     ▼
┌─────────────────────────────┐
│  Access Control (existing)  │  ← allowFrom, dmPolicy, groupPolicy
│  (pass/reject)              │
└─────────────┬───────────────┘
              │ pass
              ▼
┌─────────────────────────────┐
│  MESSAGE RATE LIMITER (NEW) │  ← per-sender sliding window
│  (pass/throttle/reject)     │
└─────────────┬───────────────┘
              │ pass
              ▼
┌─────────────────────────────┐
│  dispatchReplyFromConfig    │  ← existing dispatch pipeline
└─────────────────────────────┘
```

### Rate Limit Identity

Each sender is identified by a composite key that's channel-specific:

```typescript
type RateLimitIdentity = {
  channel: string; // "whatsapp" | "telegram" | "discord" | "slack" | "signal" | "imessage" | "webchat"
  accountId: string; // multi-account support
  senderId: string; // channel-specific sender ID (phone, user ID, etc.)
  sessionKey?: string; // optional: rate limit per session instead of per sender
};

function buildRateLimitKey(identity: RateLimitIdentity): string {
  // e.g. "whatsapp:default:+1234567890" or "discord:main:user123"
  return `${identity.channel}:${identity.accountId}:${identity.senderId}`;
}
```

### Core API (`src/security/message-rate-limit.ts`)

Follow the exact pattern from the existing `src/gateway/auth-rate-limit.ts`:

```typescript
export type MessageRateLimitConfig = {
  enabled?: boolean; // default: true
  maxMessagesPerMinute?: number; // default: 20
  maxMessagesPerHour?: number; // default: 200
  burstLimit?: number; // default: 5 (max messages in 10s window)
  cooldownMs?: number; // default: 60_000 (1 min cooldown after burst)
  exemptSenders?: string[]; // sender IDs exempt from rate limiting
  exemptChannels?: string[]; // channels exempt (e.g. "webchat" for local use)
  pruneIntervalMs?: number; // default: 60_000
  perChannel?: Record<
    string,
    {
      // per-channel overrides
      maxMessagesPerMinute?: number;
      maxMessagesPerHour?: number;
      burstLimit?: number;
    }
  >;
};

export type MessageRateLimitResult = {
  allowed: boolean;
  remaining: number; // messages remaining in current window
  retryAfterMs?: number; // when throttled, how long to wait
  reason?: "burst" | "per-minute" | "per-hour" | "cooldown";
  budget?: CostBudgetStatus; // if cost budgets enabled
};

export type MessageRateLimiter = {
  check(key: string): MessageRateLimitResult;
  record(key: string): void; // record a message (call after successful dispatch)
  reset(key: string): void;
  resetAll(): void;
  size(): number;
  prune(): void;
  dispose(): void;
  getStats(key: string): SenderRateLimitStats | null;
};

export type SenderRateLimitStats = {
  messagesLastMinute: number;
  messagesLastHour: number;
  burstCount: number;
  cooldownUntil?: number;
  lastMessageAt?: number;
};

export function createMessageRateLimiter(config?: MessageRateLimitConfig): MessageRateLimiter;
```

### Cost Budget (Optional Enhancement) (`src/security/cost-budget.ts`)

```typescript
export type CostBudgetConfig = {
  enabled?: boolean; // default: false
  maxDailyCostCents?: number; // e.g. 500 ($5.00/day)
  maxPerMessageCostCents?: number; // e.g. 100 ($1.00/message)
  resetHourUtc?: number; // default: 0 (midnight UTC)
};

export type CostBudgetStatus = {
  dailySpentCents: number;
  dailyRemainingCents: number;
  overBudget: boolean;
};

export type CostBudgetTracker = {
  recordCost(key: string, costCents: number): void;
  checkBudget(key: string): CostBudgetStatus;
  reset(key: string): void;
  dispose(): void;
};

export function createCostBudgetTracker(config?: CostBudgetConfig): CostBudgetTracker;
```

**Note**: Cost tracking is best-effort. Actual API costs are estimated from token counts. This is a guardrail, not a billing system.

### Config schema addition

```typescript
// Add to top-level OpenClawConfig or under "security"
type SecurityConfig = {
  // ... existing ...
  messageRateLimit?: MessageRateLimitConfig;
  costBudget?: CostBudgetConfig;
};
```

### Dispatch integration

In `src/auto-reply/dispatch.ts`, add rate limit check:

```typescript
// In dispatchInboundMessage, after finalizeInboundContext:
const rateLimitKey = buildRateLimitKey({
  channel: ctx.channel,
  accountId: ctx.accountId,
  senderId: ctx.sender,
});

const rateLimitResult = rateLimiter.check(rateLimitKey);
if (!rateLimitResult.allowed) {
  // Log throttled message
  log.info(
    `Rate limited ${rateLimitKey}: ${rateLimitResult.reason}, retry after ${rateLimitResult.retryAfterMs}ms`,
  );
  return { status: "rate-limited", retryAfterMs: rateLimitResult.retryAfterMs };
}

// ... existing dispatch logic ...

// After successful dispatch:
rateLimiter.record(rateLimitKey);
```

### Throttle Response Behavior

When a sender is rate limited:

| Channel  | Behavior                                                                   |
| -------- | -------------------------------------------------------------------------- |
| WhatsApp | Silently drop (no reply) — avoids rate limit on WhatsApp's side            |
| Telegram | Reply with "Please slow down" once, then silently drop for cooldown period |
| Discord  | Reply with ephemeral "Rate limited" message                                |
| Slack    | Reply with ephemeral "Rate limited" message                                |
| Signal   | Silently drop                                                              |
| WebChat  | Return `{ error: "rate_limited", retryAfterMs }` in WebSocket response     |

The throttle response behavior should be configurable per channel:

```typescript
type ThrottleResponseMode = "silent" | "notify-once" | "notify-always";
```

---

## Integration Points with Other Specs

| Spec                     | Integration                                                                   |
| ------------------------ | ----------------------------------------------------------------------------- |
| 02 (Scoped Tokens)       | Scoped token `sub` field can map to rate limit identity for gateway API calls |
| 04 (Config Integrity)    | Config integrity should cover rate limit config                               |
| 05 (Plugin Capabilities) | Plugin channels should integrate with the same rate limiter                   |

---

## Security Audit Integration

| checkId                                  | Severity | Condition                                |
| ---------------------------------------- | -------- | ---------------------------------------- |
| `security.message_rate_limit_disabled`   | warn     | Rate limiting explicitly disabled        |
| `security.message_rate_limit_high_burst` | info     | Burst limit > 10 messages/10s            |
| `security.message_rate_limit_exempt_all` | warn     | All channels exempted from rate limiting |
| `security.cost_budget_disabled`          | info     | Cost budgets not enabled (informational) |

---

## Test Plan

### Unit tests (`src/security/message-rate-limit.test.ts`)

1. **Under limit**: 5 messages in 1 minute → all allowed
2. **Burst detection**: 6 messages in 2 seconds → last one throttled (default burst=5)
3. **Per-minute limit**: 21 messages in 1 minute → 21st throttled (default=20)
4. **Per-hour limit**: 201 messages spread over 59 minutes → 201st throttled (default=200)
5. **Cooldown**: after burst, messages rejected for `cooldownMs`
6. **Cooldown expiry**: after cooldown period, messages allowed again
7. **Per-channel override**: discord has custom limit, whatsapp uses default
8. **Exempt sender**: exempt sender bypasses all limits
9. **Exempt channel**: exempt channel bypasses all limits
10. **Prune**: old entries cleaned up after `pruneIntervalMs`
11. **Stats**: `getStats` returns correct counts
12. **Reset**: `reset(key)` clears specific sender, `resetAll` clears all

### Cost budget tests (`src/security/cost-budget.test.ts`)

13. **Under budget**: record costs → `overBudget: false`
14. **Over budget**: exceed daily limit → `overBudget: true`
15. **Daily reset**: after reset hour, budget refreshes

### Integration tests

16. **Dispatch with rate limiting**: send 25 messages rapidly → first 20 dispatched, rest rate-limited
17. **WebSocket chat rate limiting**: rapid WebSocket messages → rate limit response
18. **Multi-channel isolation**: rate limit on WhatsApp doesn't affect Telegram for same user concept

---

## Dependencies

- No new npm dependencies (uses same patterns as existing `auth-rate-limit.ts`)

---

## Acceptance Criteria

- [ ] Per-sender sliding-window rate limiting at the dispatch layer
- [ ] Configurable per-minute, per-hour, and burst limits
- [ ] Per-channel overrides supported
- [ ] Exempt senders and channels configurable
- [ ] Throttle response behavior configurable per channel
- [ ] Rate limiter follows exact pattern of existing `auth-rate-limit.ts` (sliding window, prune, dispose)
- [ ] `openclaw security audit` warns when rate limiting is disabled
- [ ] Cost budget tracking (optional, off by default)
- [ ] All tests pass
- [ ] No new npm dependencies
- [ ] Gateway chat (WebSocket) also rate limited, not just channel inbound
