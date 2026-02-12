/**
 * Provider instrumentation layer.
 * Wraps AI provider calls to automatically track metrics (latency, success/error, tokens, cost).
 */

import { getProviderMetrics } from "./provider-metrics.js";

// ============================================================================
// Instrumentation Types
// ============================================================================

export interface InstrumentedRequest {
  provider: string;
  model: string;
  startTime: number;
}

export interface InstrumentedResponse {
  success: boolean;
  latencyMs: number;
  tokens?: {
    input?: number;
    output?: number;
    total?: number;
  };
  cost?: number;
  error?: {
    type: string;
    message: string;
  };
  fallbackTo?: string;
}

// ============================================================================
// Instrumentation Helpers
// ============================================================================

/**
 * Start tracking a provider request.
 * Call this at the beginning of a provider call.
 */
export function startProviderRequest(provider: string, model: string): InstrumentedRequest {
  const metrics = getProviderMetrics();
  const startTime = Date.now();

  metrics.emit("request.started", 1, { provider, model });

  return {
    provider,
    model,
    startTime,
  };
}

/**
 * Complete tracking a provider request.
 * Call this when the provider call finishes (success or error).
 */
export function completeProviderRequest(
  request: InstrumentedRequest,
  response: InstrumentedResponse,
): void {
  const metrics = getProviderMetrics();
  const { provider, model } = request;
  const latencyMs = response.latencyMs ?? Date.now() - request.startTime;

  // Record latency
  metrics.emit("request.latency", latencyMs, { provider, model });

  // Record success/error
  if (response.success) {
    metrics.emit("request.success", 1, { provider, model });
  } else {
    const error_type = response.error?.type ?? "unknown";
    metrics.emit("request.error", 1, { provider, model, error_type });
  }

  // Record tokens
  if (response.tokens) {
    if (response.tokens.input !== undefined && response.tokens.input > 0) {
      metrics.emit("tokens.input", response.tokens.input, { provider, model });
    }
    if (response.tokens.output !== undefined && response.tokens.output > 0) {
      metrics.emit("tokens.output", response.tokens.output, { provider, model });
    }
    if (
      response.tokens.total !== undefined &&
      response.tokens.total > 0 &&
      !response.tokens.input &&
      !response.tokens.output
    ) {
      // Only record total if input/output weren't provided separately
      metrics.emit("tokens.total", response.tokens.total, { provider, model });
    }
  }

  // Record cost
  if (response.cost !== undefined && response.cost > 0) {
    metrics.emit("cost.estimated", response.cost, { provider, model });
  }

  // Record fallback
  if (response.fallbackTo) {
    metrics.emit("fallback.triggered", 1, { provider, model, fallback_to: response.fallbackTo });
  }
}

/**
 * Record a rate limit hit.
 */
export function recordRateLimit(provider: string, model: string): void {
  const metrics = getProviderMetrics();
  metrics.emit("rate_limit.hit", 1, { provider, model });
}

// ============================================================================
// Wrapper for Async Functions
// ============================================================================

/**
 * Wrap an async provider function to automatically track metrics.
 *
 * Usage:
 * ```ts
 * const result = await instrumentProviderCall(
 *   { provider: "openai", model: "gpt-4o" },
 *   async () => {
 *     return await callOpenAI(...);
 *   },
 *   (result) => ({
 *     success: true,
 *     tokens: { input: result.usage.prompt_tokens, output: result.usage.completion_tokens },
 *   })
 * );
 * ```
 */
export async function instrumentProviderCall<T>(
  params: { provider: string; model: string },
  fn: () => Promise<T>,
  extractResponse: (
    result: T,
  ) => Omit<InstrumentedResponse, "latencyMs"> | Promise<Omit<InstrumentedResponse, "latencyMs">>,
): Promise<T> {
  const request = startProviderRequest(params.provider, params.model);
  const startTime = Date.now();

  try {
    const result = await fn();
    const latencyMs = Date.now() - startTime;
    const responseData = await extractResponse(result);

    completeProviderRequest(request, {
      ...responseData,
      latencyMs,
    });

    return result;
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorType =
      error instanceof Error ? error.name : typeof error === "string" ? error : "unknown";
    const errorMessage = error instanceof Error ? error.message : String(error);

    completeProviderRequest(request, {
      success: false,
      latencyMs,
      error: {
        type: errorType,
        message: errorMessage,
      },
    });

    throw error;
  }
}

// ============================================================================
// Cost Estimation Helpers
// ============================================================================

/**
 * Estimate cost for a provider request based on token usage.
 * This is a best-effort estimate using known pricing as of Feb 2026.
 * Real costs may vary.
 */
export function estimateCost(params: {
  provider: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}): number {
  const { provider, model, inputTokens = 0, outputTokens = 0 } = params;

  // Cost per 1M tokens (USD)
  const pricing: Record<string, { input: number; output: number }> = {
    // Anthropic
    "anthropic/claude-opus-4": { input: 15.0, output: 75.0 },
    "anthropic/claude-opus-4-5": { input: 15.0, output: 75.0 },
    "anthropic/claude-opus-4-6": { input: 15.0, output: 75.0 },
    "anthropic/claude-sonnet-4": { input: 3.0, output: 15.0 },
    "anthropic/claude-sonnet-4-5": { input: 3.0, output: 15.0 },
    "anthropic/claude-haiku-4": { input: 0.8, output: 4.0 },
    "anthropic/claude-3-5-sonnet-20241022": { input: 3.0, output: 15.0 },
    "anthropic/claude-3-5-haiku-20241022": { input: 0.8, output: 4.0 },

    // OpenAI
    "openai/gpt-4o": { input: 2.5, output: 10.0 },
    "openai/gpt-4o-mini": { input: 0.15, output: 0.6 },
    "openai/gpt-4-turbo": { input: 10.0, output: 30.0 },
    "openai/gpt-4": { input: 30.0, output: 60.0 },
    "openai/gpt-3.5-turbo": { input: 0.5, output: 1.5 },
    "openai/o1": { input: 15.0, output: 60.0 },
    "openai/o1-mini": { input: 3.0, output: 12.0 },
    "openai/o3-mini": { input: 1.1, output: 4.4 },

    // Google
    "google/gemini-2.0-flash-exp": { input: 0.0, output: 0.0 }, // Free tier
    "google/gemini-1.5-pro": { input: 1.25, output: 5.0 },
    "google/gemini-1.5-flash": { input: 0.075, output: 0.3 },

    // Deepseek
    "deepseek/deepseek-chat": { input: 0.14, output: 0.28 },
    "deepseek/deepseek-reasoner": { input: 0.55, output: 2.19 },

    // X.AI
    "xai/grok-2": { input: 2.0, output: 10.0 },
    "xai/grok-beta": { input: 5.0, output: 15.0 },
  };

  const key = `${provider.toLowerCase()}/${model.toLowerCase()}`;
  const rates = pricing[key];

  if (!rates) {
    // Unknown model - no cost estimate
    return 0;
  }

  const inputCost = (inputTokens / 1_000_000) * rates.input;
  const outputCost = (outputTokens / 1_000_000) * rates.output;

  return inputCost + outputCost;
}
