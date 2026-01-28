# Self-Healing Behaviors

Moltbot includes built-in resilience mechanisms that automatically recover from transient failures without operator intervention. This document describes each self-healing behavior.

## Exponential Backoff Reconnection

All network connections use exponential backoff for automatic reconnection:

### Backoff Policy

```typescript
type BackoffPolicy = {
  initialMs: number;   // First retry delay
  maxMs: number;       // Maximum delay cap
  factor: number;      // Multiplier per attempt (typically 2)
  jitter: number;      // Random variance (0.1 = 10%)
};
```

The backoff formula: `delay = min(maxMs, initialMs * factor^attempt + random * jitter)`

### Channel Reconnection

Channels automatically reconnect when connections drop:

| Channel | Initial Delay | Max Delay | Behavior |
|---------|--------------|-----------|----------|
| Signal SSE | 1s | 10s | Reconnects on stream end or error |
| Discord WebSocket | 500ms | 30s | Reconnects on rate limit (429) |
| Telegram polling | 400ms | 30s | Reconnects on transient errors |

When a connection succeeds, the attempt counter resets to zero.

### Configuration

Per-provider retry settings in `config.yaml`:

```yaml
channels:
  telegram:
    retry:
      attempts: 3
      minDelayMs: 400
      maxDelayMs: 30000
      jitter: 0.1

  discord:
    retry:
      attempts: 3
      minDelayMs: 500
      maxDelayMs: 30000
      jitter: 0.1
```

## Model Failover Cascade

When a model request fails, Moltbot automatically tries fallback models.

### How It Works

1. **Primary model attempt** - Try the configured primary model
2. **Check cooldowns** - Skip providers where all auth profiles are in cooldown
3. **Fallback cascade** - Try each configured fallback in order
4. **Error aggregation** - Collect errors from all attempts for debugging

### Configuration

```yaml
agents:
  defaults:
    model:
      primary: anthropic/claude-sonnet-4-20250514
      fallbacks:
        - anthropic/claude-3-5-haiku-latest
        - openai/gpt-4o
```

### Failover Conditions

Failover triggers on:
- Rate limit errors (HTTP 429)
- Server errors (HTTP 5xx)
- Timeout errors
- Authentication errors (credential issues)
- Model unavailable errors

Failover does **not** trigger on:
- User abort/cancel
- Invalid request errors (client bugs)
- Context overflow (not recoverable by switching models)

### Image Model Failover

Image generation has separate fallback configuration:

```yaml
agents:
  defaults:
    imageModel:
      primary: anthropic/claude-sonnet-4-20250514
      fallbacks:
        - openai/dall-e-3
```

## Auth Profile Cooldown

When API requests fail due to rate limiting or billing issues, auth profiles enter a cooldown period.

### Cooldown Progression

For rate limit/transient errors:
- 1st failure: 1 minute cooldown
- 2nd failure: 5 minutes
- 3rd failure: 25 minutes
- Maximum: 1 hour

For billing errors (longer backoff):
- Default base: 5 hours
- Maximum: 24 hours
- Uses exponential growth: `baseMs * 2^(failures-1)`

### Cooldown Behavior

- **Automatic recovery**: Cooldown clears automatically after the timeout
- **Success clears cooldown**: A successful request resets error count to zero
- **Provider skipping**: Model failover skips providers where all profiles are in cooldown
- **Failure window**: Error count resets if 24 hours pass without new failures

### Configuration

```yaml
auth:
  cooldowns:
    billingBackoffHours: 5      # Base delay for billing errors
    billingMaxHours: 24         # Maximum billing cooldown
    failureWindowHours: 24      # Reset window for error count
    billingBackoffHoursByProvider:
      openai: 12                # Provider-specific override
```

### Manual Reset

Clear cooldown for a specific profile:

```bash
clawdbot auth profiles --clear-cooldown <profile-id>
```

## Token Bucket Rate Limiting

The gateway uses token bucket rate limiting to prevent abuse while allowing burst traffic.

### How Token Bucket Works

1. Each client has a bucket with a maximum token capacity
2. Tokens refill continuously at a fixed rate (tokens per minute)
3. Each request consumes one token
4. If no tokens available, request is rate-limited

### Default Limits

| Client Type | Rate | Burst |
|-------------|------|-------|
| Unauthenticated | 60/min | 2x (120 tokens) |
| Authenticated | Unlimited | - |
| Channel messages | 200/min | 2x (400 tokens) |

### Auth Failure Backoff

After repeated authentication failures, clients are temporarily blocked:

- **Threshold**: 5 failures before backoff starts
- **Base delay**: 1 second
- **Growth**: Exponential (1s, 2s, 4s, 8s...)
- **Maximum**: 1 minute
- **Reset**: 10 minutes of inactivity clears failure count

### Configuration

```yaml
gateway:
  rateLimit:
    enabled: true
    unauthenticated: 60       # Requests per minute
    authenticated: 0          # 0 = unlimited
    channelMessages: 200      # Per channel
    burstMultiplier: 2        # Allow 2x burst
    authFailuresBeforeBackoff: 5
    authBackoffBaseMs: 1000
    authBackoffMaxMs: 60000
```

## Session Stuck Detection

The diagnostic system monitors for sessions that appear stuck in a particular state.

### How It Works

The gateway emits `session.stuck` diagnostic events when a session remains in `processing` or `waiting` state longer than expected.

```typescript
type DiagnosticSessionStuckEvent = {
  type: "session.stuck";
  sessionKey?: string;
  sessionId?: string;
  state: "idle" | "processing" | "waiting";
  ageMs: number;           // How long in this state
  queueDepth?: number;     // Pending messages
};
```

### What Triggers Detection

- Session in `processing` state for extended period
- Session in `waiting` state with no progress
- High queue depth combined with state staleness

### Monitoring Integration

Subscribe to stuck session events:

```typescript
import { onDiagnosticEvent } from 'clawdbot/diagnostic-events';

onDiagnosticEvent((event) => {
  if (event.type === 'session.stuck') {
    // Alert ops team
    alertChannel.send(`Session ${event.sessionKey} stuck for ${event.ageMs}ms`);
  }
});
```

### Prometheus Alert

```yaml
- alert: SessionStuck
  expr: clawdbot_session_stuck_total > 0
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Session appears stuck"
```

## Diagnostic Heartbeat

The gateway emits periodic heartbeat events summarizing system health:

```typescript
type DiagnosticHeartbeatEvent = {
  type: "diagnostic.heartbeat";
  webhooks: {
    received: number;    // Total webhooks received
    processed: number;   // Successfully processed
    errors: number;      // Errors encountered
  };
  active: number;        // Sessions currently processing
  waiting: number;       // Sessions waiting for user
  queued: number;        // Messages in queue
};
```

Use heartbeats to:
- Verify gateway is alive and processing
- Monitor queue backlog growth
- Track error rates over time

## Recovery Patterns Summary

| Failure Type | Self-Healing Mechanism | Time to Recover |
|--------------|------------------------|-----------------|
| Network disconnect | Exponential backoff reconnect | 1s - 30s |
| Model rate limit | Failover to backup model | Immediate |
| Model unavailable | Failover cascade | Immediate |
| Auth profile rate limit | Profile cooldown + rotation | 1min - 1hr |
| Billing error | Extended cooldown | 5hr - 24hr |
| Gateway overload | Token bucket + queue | Immediate backpressure |
| Brute-force auth | Auth failure backoff | 1s - 60s |
| Stuck session | Diagnostic event + alert | Requires operator |

## Best Practices

1. **Configure fallback models** - Always have at least one fallback for critical workflows
2. **Monitor diagnostic events** - Set up alerts for `session.stuck` and high error rates
3. **Use multiple auth profiles** - Distribute load across profiles to avoid single-profile rate limits
4. **Review cooldown settings** - Tune for your provider's rate limit behavior
5. **Enable rate limiting** - Protect against accidental or malicious overload

## Related Documentation

- [Model Failover](/concepts/model-failover) - Detailed model configuration
- [Retry Policy](/concepts/retry) - Per-provider retry settings
- [Observability](/enterprise/observability) - Metrics and alerting
- [Security Hardening](/enterprise/security-hardening) - Rate limit configuration
