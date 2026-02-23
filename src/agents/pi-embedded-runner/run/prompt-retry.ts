import type { OutboundRetryConfig } from "../../../config/types.base.js";
import { retryAsync } from "../../../infra/retry.js";
import { log } from "../logger.js";

const DEFAULT_RETRY_CONFIG: OutboundRetryConfig = {
  attempts: 10,
  minDelayMs: 1000,
  maxDelayMs: 60000,
  jitter: 0.2,
};

/**
 * Extract error message from various error formats across different LLM providers.
 * Handles:
 * - String errors: "TPM limit exceeded"
 * - Error objects: new Error("message") or { message: "message" }
 * - API response objects: { type: "error", error: { type: "rate_limit_error", message: "..." } }
 * - JSON stringified errors: '{"type":"error",...}'
 */
function extractErrorMessage(err: unknown): string {
  if (err === null || err === undefined) {
    return "";
  }
  // Handle string errors
  if (typeof err === "string") {
    return err;
  }
  // Handle Error objects
  if (err instanceof Error && err.message) {
    return err.message;
  }
  // Handle plain objects with error properties
  if (typeof err === "object") {
    const errObj = err as Record<string, unknown>;
    // Try nested error structure (common in Anthropic/OpenAI SDK)
    if (errObj.error && typeof errObj.error === "object") {
      const nested = errObj.error as Record<string, unknown>;
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      for (const key of ["message", "error", "type", "code"]) {
        const value = nested[key] ?? errObj[key];
        if (typeof value === "string" && value) {
          return value;
        }
      }
      // Fallback to JSON stringification
      return JSON.stringify(errObj.error);
    }
    // Direct properties
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    for (const key of ["message", "error", "code", "reason", "type"]) {
      const value = errObj[key];
      if (typeof value === "string" && value) {
        return value;
      }
    }
    // Fallback to JSON stringification
    return JSON.stringify(errObj);
  }
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  return String(err);
}

/**
 * Check if error is a rate limit / TPM limit error.
 * Supports all major LLM providers:
 * - Anthropic: rate_limit_error,_overloaded_error
 * - OpenAI: rate_limit_error,insufficient_quota
 * - Google: 429 Too Many Requests
 * - AWS Bedrock: ThrottlingException
 * - Generic: TPM, quota, 429
 */
function isRetryableError(err: unknown): boolean {
  const msg = extractErrorMessage(err).toLowerCase();

  // Rate limit type patterns (explicit error types from various SDKs)
  const retryableTypes = [
    "rate_limit_error",
    "rate_limit_exceeded",
    "rate_limit",
    "overloaded_error",
    "overloaded",
    "throttling_exception",
    "throttled",
    "insufficient_quota",
    "resource_exhausted",
    "resource_has_been_exhausted",
    "usage_limit",
    "tokens_per_minute",
  ];

  // Check if message contains any retryable type
  for (const type of retryableTypes) {
    if (msg.includes(type)) {
      return true;
    }
  }

  // Check for Chinese patterns (toLowerCase doesn't affect Chinese)
  if (
    msg.includes("请求额度超限") ||
    msg.includes("请求频率超限") ||
    msg.includes("限流") ||
    msg.includes("速率限制")
  ) {
    return true;
  }

  // Check for common rate limit patterns in text
  const rateLimitPatterns = [
    /tpm\s*limit/i,
    /rate\s*limit/i,
    /too\s*many\s*requests?/i,
    /quota\s*(?:exceeded|reached)/i,
    /usage\s*limit/i,
    /\b429\b/,
    /\b502\b.*\bBad\s*Gateway\b/i, // Sometimes indicates temporary overload
    /\b503\b.*\bService\s*(?:Unavailable|Temporarily\s*Overloaded)/i,
    /resource\s*(?:has\s*been\s*)?exhausted/i,
  ];

  return rateLimitPatterns.some((pattern) => pattern.test(msg));
}

/**
 * Extract retry_after value from error for appropriate backoff.
 */
function getRetryAfterMs(err: unknown): number | undefined {
  const msg = extractErrorMessage(err);

  // Explicit retry_after field
  if (typeof err === "object" && err !== null) {
    const errObj = err as Record<string, unknown>;
    // Direct retry_after property
    if (typeof errObj.retry_after === "number") {
      return errObj.retry_after * 1000;
    }
    if (typeof errObj.retry_after === "string") {
      const parsed = Number(errObj.retry_after);
      if (!Number.isNaN(parsed)) {
        return parsed * 1000;
      }
    }
    // Nested in error object
    if (errObj.error && typeof errObj.error === "object") {
      const nested = errObj.error as Record<string, unknown>;
      if (typeof nested.retry_after === "number") {
        return nested.retry_after * 1000;
      }
      if (typeof nested.retry_after === "string") {
        const parsed = Number(nested.retry_after);
        if (!Number.isNaN(parsed)) {
          return parsed * 1000;
        }
      }
    }
  }

  // Match "retry_after: N" or "retry after N" in message
  const match = msg.match(/retry_after[:\s]*(\d+)/i) ?? msg.match(/retry\s*after[:\s]*(\d+)/i);
  if (match) {
    return Number(match[1]) * 1000;
  }

  return undefined;
}

export function getRetryConfig(
  provider: string,
  config?: { models?: { providers?: Record<string, { retry?: OutboundRetryConfig }> } },
): OutboundRetryConfig | undefined {
  return config?.models?.providers?.[provider]?.retry;
}

export async function runWithPromptRetry<T>(
  fn: () => Promise<T>,
  provider: string,
  modelId: string,
  retryConfig?: OutboundRetryConfig,
): Promise<T> {
  // First check for config-based retry, fall back to default
  const effectiveConfig = retryConfig ?? DEFAULT_RETRY_CONFIG;

  const attempts = effectiveConfig.attempts ?? DEFAULT_RETRY_CONFIG.attempts!;
  const minDelayMs = effectiveConfig.minDelayMs ?? DEFAULT_RETRY_CONFIG.minDelayMs!;
  const maxDelayMs = effectiveConfig.maxDelayMs ?? DEFAULT_RETRY_CONFIG.maxDelayMs!;
  const jitter = effectiveConfig.jitter ?? DEFAULT_RETRY_CONFIG.jitter!;

  return retryAsync(fn, {
    attempts,
    minDelayMs,
    maxDelayMs,
    jitter,
    shouldRetry: isRetryableError,
    retryAfterMs: getRetryAfterMs,
    onRetry: (info) => {
      log.warn(
        `[prompt-retry] provider=${provider} model=${modelId} ` +
          `attempt=${info.attempt}/${info.maxAttempts} delay=${info.delayMs}ms`,
      );
    },
  });
}

export type { OutboundRetryConfig };
