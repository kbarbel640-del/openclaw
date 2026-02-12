# Provider Metrics Integration Guide

## Overview

Provider metrics track observability data for AI provider calls: latency, success/error rates, token usage, and estimated costs.

**Delivered files:**

- `provider-metrics.ts` — Core metrics collector (in-memory storage, percentile tracking)
- `provider-instrumentation.ts` — Helpers to wrap provider calls
- `metrics-routes.ts` — Express routes for `/api/models/metrics`

---

## Quick Start

### 1. Wrap provider calls

Use `instrumentProviderCall()` to automatically track metrics:

```typescript
import { instrumentProviderCall, estimateCost } from "./provider-instrumentation.js";

const result = await instrumentProviderCall(
  { provider: "openai", model: "gpt-4o" },
  async () => {
    // Your existing provider call
    return await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [...],
    });
  },
  (result) => {
    // Extract response data for metrics
    const inputTokens = result.usage?.prompt_tokens ?? 0;
    const outputTokens = result.usage?.completion_tokens ?? 0;
    const cost = estimateCost({
      provider: "openai",
      model: "gpt-4o",
      inputTokens,
      outputTokens,
    });

    return {
      success: true,
      tokens: {
        input: inputTokens,
        output: outputTokens,
      },
      cost,
    };
  },
);
```

### 2. Manual instrumentation (alternative)

If you need more control:

```typescript
import { startProviderRequest, completeProviderRequest } from "./provider-instrumentation.js";

const request = startProviderRequest("anthropic", "claude-sonnet-4-5");
const startTime = Date.now();

try {
  const result = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    messages: [...],
  });

  completeProviderRequest(request, {
    success: true,
    latencyMs: Date.now() - startTime,
    tokens: {
      input: result.usage.input_tokens,
      output: result.usage.output_tokens,
    },
    cost: estimateCost({
      provider: "anthropic",
      model: "claude-sonnet-4-5",
      inputTokens: result.usage.input_tokens,
      outputTokens: result.usage.output_tokens,
    }),
  });

  return result;
} catch (error) {
  completeProviderRequest(request, {
    success: false,
    latencyMs: Date.now() - startTime,
    error: {
      type: error.name,
      message: error.message,
    },
  });
  throw error;
}
```

### 3. Track fallbacks

```typescript
import { completeProviderRequest, recordRateLimit } from "./provider-instrumentation.js";

// When fallback is triggered
completeProviderRequest(request, {
  success: false,
  latencyMs: Date.now() - startTime,
  error: { type: "RateLimitError", message: "..." },
  fallbackTo: "google/gemini-2.0-flash-exp", // Track which model we fell back to
});

// Standalone rate limit tracking
recordRateLimit("openai", "gpt-4o");
```

---

## API Routes

### GET `/api/models/metrics`

Get full metrics snapshot.

**Query params:**

- `provider` (optional) — Filter by provider (e.g., `openai`)
- `model` (optional) — Filter by model (requires `provider`)
- `format` (optional) — `json` (default) or `prometheus`

**Response:**

```json
{
  "providers": {
    "openai": {
      "models": {
        "gpt-4o": {
          "requests": {
            "started": 150,
            "success": 148,
            "error": 2,
            "successRate": 0.9866666666666667,
            "errorRate": 0.013333333333333334
          },
          "latency": {
            "p50": 1250,
            "p95": 2500,
            "p99": 3200,
            "count": 150
          },
          "tokens": {
            "input": 50000,
            "output": 75000,
            "total": 125000
          },
          "cost": {
            "estimated": 0.875
          },
          "errors": {
            "RateLimitError": 2
          },
          "fallbacks": {
            "triggered": 2,
            "targets": {
              "google/gemini-2.0-flash-exp": 2
            }
          },
          "rateLimits": 2,
          "lastRequestAt": 1707744000000
        }
      },
      "totals": {
        "requests": { "started": 150, "success": 148, "error": 2, ... },
        "tokens": { "input": 50000, "output": 75000, "total": 125000 },
        "cost": { "estimated": 0.875 },
        "fallbacks": 2,
        "rateLimits": 2
      }
    }
  },
  "global": {
    "requests": { "started": 320, "success": 315, "error": 5, ... },
    "tokens": { "input": 120000, "output": 180000, "total": 300000 },
    "cost": { "estimated": 2.45 },
    "fallbacks": 5,
    "rateLimits": 5,
    "activeProviders": 3,
    "activeModels": 7
  },
  "snapshotAt": 1707744000000
}
```

**Prometheus format:**

```bash
curl "http://localhost:3000/api/models/metrics?format=prometheus"
```

### GET `/api/models/metrics/summary`

Quick summary of top providers/models.

**Response:**

```json
{
  "global": { ... },
  "topProviders": [
    { "provider": "openai", "requests": 150, "successRate": 0.986, "tokens": 125000, "cost": 0.875 },
    { "provider": "anthropic", "requests": 100, "successRate": 0.99, "tokens": 95000, "cost": 1.2 }
  ],
  "topModels": [
    { "provider": "openai", "model": "gpt-4o", "requests": 150, "successRate": 0.986, "latencyP95": 2500, ... },
    ...
  ],
  "errors": [
    { "provider": "openai", "model": "gpt-4o", "errors": 2, "errorRate": 0.0133, "errorTypes": { "RateLimitError": 2 } }
  ],
  "snapshotAt": 1707744000000
}
```

### DELETE `/api/models/metrics`

Reset metrics (admin only).

**Query params:**

- `provider` (optional) — Reset specific provider
- `model` (optional) — Reset specific model (requires `provider`)

```bash
# Reset all
curl -X DELETE http://localhost:3000/api/models/metrics

# Reset provider
curl -X DELETE "http://localhost:3000/api/models/metrics?provider=openai"

# Reset model
curl -X DELETE "http://localhost:3000/api/models/metrics?provider=openai&model=gpt-4o"
```

---

## Integration Checklist

### Backend Integration

1. **Import routes** in `src/index.ts`:

   ```typescript
   import { metricsRoutes } from "./agents/metrics-routes.js";
   app.use("/api/models", metricsRoutes);
   ```

2. **Wrap provider calls** in key locations:
   - `src/auto-reply/reply/get-reply-run.ts` (main completion calls)
   - `src/agents/pi-embedded.ts` (embedded agent calls)
   - Any direct provider SDK usage

3. **Test metrics collection**:
   ```bash
   # Trigger some AI requests
   curl http://localhost:3000/api/models/metrics/summary
   ```

### Prometheus Integration (Optional)

1. **Add Prometheus scrape config**:

   ```yaml
   scrape_configs:
     - job_name: "openclaw-ai-metrics"
       static_configs:
         - targets: ["localhost:3000"]
       metrics_path: "/api/models/metrics"
       params:
         format: ["prometheus"]
       scrape_interval: 15s
   ```

2. **Grafana dashboard** (see `GRAFANA_DASHBOARD.md`)

---

## Configuration

Metrics are **always enabled** by default (zero-config). To disable:

```typescript
import { setProviderMetrics, createNoopProviderMetrics } from "./provider-metrics.js";

// Disable metrics globally
setProviderMetrics(createNoopProviderMetrics());
```

---

## Cost Estimation

Costs are estimated using **Feb 2026 pricing** for supported providers:

- Anthropic (Claude Opus, Sonnet, Haiku)
- OpenAI (GPT-4o, GPT-4, o1, o3-mini)
- Google (Gemini 2.0, 1.5)
- Deepseek (Chat, Reasoner)
- X.AI (Grok)

**Note:** Costs are estimates. Actual billing may differ based on:

- Volume discounts
- Batching
- Caching (prompt caching reduces input token costs)
- Pricing changes

---

## Performance Impact

- **In-memory storage**: No external dependencies
- **Latency overhead**: &lt;1ms per request (emit + percentile update)
- **Memory footprint**: ~1KB per model (up to 1000 latency samples)
- **Thread-safe**: No locks (single-threaded Node.js event loop)

---

## Example Integration Points

### 1. `get-reply-run.ts` (main completions)

```typescript
import { instrumentProviderCall, estimateCost } from "../../agents/provider-instrumentation.js";

// Wrap the runReplyAgent call
const result = await instrumentProviderCall(
  { provider: normalizedProvider, model },
  async () => {
    return await runReplyAgent({
      sessionEntry,
      cfg,
      agentCfg,
      provider: normalizedProvider,
      model,
      ...
    });
  },
  (result) => {
    const inputTokens = result.usage?.input_tokens ?? 0;
    const outputTokens = result.usage?.output_tokens ?? 0;
    const cost = estimateCost({
      provider: normalizedProvider,
      model,
      inputTokens,
      outputTokens,
    });

    return {
      success: true,
      tokens: { input: inputTokens, output: outputTokens },
      cost,
    };
  },
);
```

### 2. Fallback handler

```typescript
import { completeProviderRequest } from "../../agents/provider-instrumentation.js";

// When primary model fails
const primaryRequest = startProviderRequest(primaryProvider, primaryModel);
try {
  return await callPrimary();
} catch (error) {
  // Track failure + fallback
  completeProviderRequest(primaryRequest, {
    success: false,
    latencyMs: Date.now() - primaryRequest.startTime,
    error: { type: error.name, message: error.message },
    fallbackTo: `${fallbackProvider}/${fallbackModel}`,
  });

  // Try fallback
  return await callFallback();
}
```

---

## Next Steps

1. **Integrate routes** (Carlos) — Add to main Express app
2. **Wrap provider calls** — Instrument key call sites
3. **Test metrics** — Verify snapshot endpoint works
4. **Prometheus setup** (optional) — Connect to Grafana
5. **Document cost estimation** — Update pricing as needed

---

## Questions?

Ping @Thiago (devops-engineer) or @Rafael (sre) for support.
