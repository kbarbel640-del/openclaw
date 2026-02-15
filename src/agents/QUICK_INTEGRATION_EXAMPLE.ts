/**
 * QUICK INTEGRATION EXAMPLE
 * Copy-paste ready code snippets for integrating provider metrics.
 */

// =============================================================================
// 1. ADD ROUTES TO ELYSIA APP (src/index.ts or wherever routes are mounted)
// =============================================================================

/*
import { metricsRoutes } from "./agents/metrics-routes.js";

// Add this line where other routes are mounted (Elysia plugin)
app.use(metricsRoutes);
// The plugin is configured with prefix: "/metrics", so routes will be at /metrics, /metrics/summary
*/

// =============================================================================
// 2. WRAP PROVIDER CALLS (Example: get-reply-run.ts)
// =============================================================================

/*
import { instrumentProviderCall, estimateCost } from "../../agents/provider-instrumentation.js";

// BEFORE (existing code):
const result = await runReplyAgent({
  sessionEntry,
  cfg,
  agentCfg,
  provider: normalizedProvider,
  model,
  ...otherParams,
});

// AFTER (wrapped with instrumentation):
const result = await instrumentProviderCall(
  { provider: normalizedProvider, model },
  async () => {
    return await runReplyAgent({
      sessionEntry,
      cfg,
      agentCfg,
      provider: normalizedProvider,
      model,
      ...otherParams,
    });
  },
  (result) => {
    // Extract response data for metrics
    const inputTokens = result.usage?.input_tokens ?? result.usage?.prompt_tokens ?? 0;
    const outputTokens = result.usage?.output_tokens ?? result.usage?.completion_tokens ?? 0;
    const cost = estimateCost({
      provider: normalizedProvider,
      model,
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
*/

// =============================================================================
// 3. TEST METRICS COLLECTION
// =============================================================================

/*
// After integration, trigger some AI requests, then:

// Get quick summary
curl http://localhost:3000/api/models/metrics/summary

// Get full snapshot
curl http://localhost:3000/api/models/metrics

// Get Prometheus format
curl "http://localhost:3000/api/models/metrics?format=prometheus"

// Filter by provider
curl "http://localhost:3000/api/models/metrics?provider=openai"

// Filter by model
curl "http://localhost:3000/api/models/metrics?provider=openai&model=gpt-4o"
*/

// =============================================================================
// 4. MANUAL INSTRUMENTATION (Alternative approach)
// =============================================================================

/*
import { startProviderRequest, completeProviderRequest, estimateCost } from "../../agents/provider-instrumentation.js";

const request = startProviderRequest(provider, model);
const startTime = Date.now();

try {
  const result = await callProviderSDK();
  
  completeProviderRequest(request, {
    success: true,
    latencyMs: Date.now() - startTime,
    tokens: {
      input: result.usage.input_tokens,
      output: result.usage.output_tokens,
    },
    cost: estimateCost({
      provider,
      model,
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
      type: error.name || "Error",
      message: error.message || String(error),
    },
  });
  throw error;
}
*/

// =============================================================================
// 5. FALLBACK TRACKING
// =============================================================================

/*
import { completeProviderRequest, recordRateLimit } from "../../agents/provider-instrumentation.js";

// When fallback is triggered
const primaryRequest = startProviderRequest(primaryProvider, primaryModel);
try {
  return await callPrimary();
} catch (error) {
  // Track failure + fallback target
  completeProviderRequest(primaryRequest, {
    success: false,
    latencyMs: Date.now() - primaryRequest.startTime,
    error: { type: error.name, message: error.message },
    fallbackTo: `${fallbackProvider}/${fallbackModel}`,
  });

  // If error was rate limit, track it
  if (error.name === "RateLimitError") {
    recordRateLimit(primaryProvider, primaryModel);
  }

  // Try fallback
  return await callFallback();
}
*/

// =============================================================================
// 6. DISABLE METRICS (if needed for testing)
// =============================================================================

/*
import { setProviderMetrics, createNoopProviderMetrics } from "./agents/provider-metrics.js";

// Disable metrics globally
setProviderMetrics(createNoopProviderMetrics());
*/

// =============================================================================
// DONE! That's it. Provider metrics will now auto-collect.
// =============================================================================

// This file contains example code snippets for documentation purposes.
// The examples above show how to integrate provider metrics with your app.

const _exampleFile = true;
