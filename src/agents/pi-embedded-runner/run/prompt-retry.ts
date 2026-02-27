import type { OutboundRetryConfig } from "../../../config/types.base.js";
import { sleepWithAbort } from "../../../infra/backoff.js";
import { isRateLimitErrorMessage } from "../../pi-embedded-helpers/errors.js";
import { log } from "../logger.js";

/**
 * Simplified rate limit recovery wrapper with exponential backoff.
 *
 * Works with pi-ai SDK error formats:
 * - Object: { status: 429, message: "Rate limit exceeded" }
 * - Error: new Error("429: Too Many Requests")
 * - String: "TPM limit reached"
 *
 * Adds an external retry layer on top of the SDK's internal retry mechanism.
 *
 * Retry history is tracked internally and logged on final failure for diagnostics.
 */
function isRetryableStatusCode(code: number): boolean {
  // 429: Rate limit exceeded
  // 500: Internal server error
  // 502: Bad gateway (temporary overload)
  // 503: Service unavailable (temporary overload)
  // 504: Gateway timeout (temporary)
  const retryableCodes = [429, 500, 502, 503, 504];
  return retryableCodes.includes(code);
}

function extractStatusCode(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) {
    return undefined;
  }

  const errObj = err as Record<string, unknown>;

  // Direct status property (e.g., { status: 429, ... })
  if (typeof errObj.status === "number") {
    return errObj.status;
  }

  // Nested in error object
  if (errObj.error && typeof errObj.error === "object") {
    const nested = errObj.error as Record<string, unknown>;
    if (typeof nested.status === "number") {
      return nested.status;
    }
  }

  return undefined;
}

function isRateLimitError(err: unknown): boolean {
  if (!err) {
    return false;
  }

  // Check HTTP status code first (most reliable indicator for retry decisions)
  const statusCode = extractStatusCode(err);
  if (statusCode !== undefined && isRetryableStatusCode(statusCode)) {
    return true;
  }

  // Check string errors directly (isRateLimitErrorMessage handles case normalization)
  if (typeof err === "string") {
    return isRateLimitErrorMessage(err);
  }

  // Check Error instances - pass message directly since isRateLimitErrorMessage normalizes case
  if (err instanceof Error && err.message) {
    return isRateLimitErrorMessage(err.message);
  }

  // Handle object errors with various shapes
  if (typeof err === "object") {
    const errObj = err as Record<string, unknown>;

    // Check nested error structure: { error: { message: "...", status: ... } }
    if (errObj.error && typeof errObj.error === "object") {
      const nested = errObj.error as Record<string, unknown>;
      const nestedMsg = nested.message ?? nested.error;
      if (typeof nestedMsg === "string" && isRateLimitErrorMessage(nestedMsg)) {
        return true;
      }
    }

    // Check direct message/error properties
    const directMsg = errObj.message ?? errObj.error;
    if (typeof directMsg === "string" && isRateLimitErrorMessage(directMsg)) {
      return true;
    }
  }

  return false;
}

function applyJitter(delayMs: number, jitter: number): number {
  if (jitter <= 0 || !jitter) {
    return delayMs;
  }
  const offset = (Math.random() * 2 - 1) * jitter;
  return Math.max(0, Math.round(delayMs * (1 + offset)));
}

function resolveDelay(config: OutboundRetryConfig, attempt: number): number {
  const minDelay = config.minDelayMs ?? 5000;
  const maxDelay = config.maxDelayMs ?? 60000;
  const jitter = config.jitter ?? 0;

  // Use exponential backoff: minDelay, minDelay*2, minDelay*4, ...
  const baseDelay = minDelay * Math.pow(2, attempt - 1);
  const delay = applyJitter(baseDelay, jitter);
  // Clamp to maxDelay
  return Math.min(delay, maxDelay);
}

export function getRetryConfig(
  provider: string,
  config?: { models?: { providers?: Record<string, { retry?: OutboundRetryConfig }> } },
): OutboundRetryConfig | undefined {
  return config?.models?.providers?.[provider]?.retry;
}

/**
 * Default rate limit recovery config (conservative settings suitable for TPM limits).
 * - 5 attempts with exponential backoff starting at 5s
 * - 30% jitter to prevent thundering herd on recovery
 */
const DEFAULT_RECOVERY_CONFIG: OutboundRetryConfig = {
  attempts: 5,
  minDelayMs: 5000,
  maxDelayMs: 60000,
  jitter: 0.3,
};

/**
 * Tracks individual retry attempts for diagnostics.
 */
interface RetryAttempt {
  attempt: number;
  delayMs: number;
  errorMessage: string;
}

export async function runWithPromptRetry<T>(
  fn: () => Promise<T>,
  retryConfig?: OutboundRetryConfig,
  signal?: AbortSignal,
): Promise<T> {
  const config = retryConfig ?? DEFAULT_RECOVERY_CONFIG;
  const attempts = config.attempts ?? 5;
  const retryHistory: RetryAttempt[] = [];
  let lastError: unknown;
  let lastErrorMessage = "";

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      // Extract error message for history
      if (err instanceof Error) {
        lastErrorMessage = err.message;
      } else if (typeof err === "string") {
        lastErrorMessage = err;
      } else if (typeof err === "object" && err !== null) {
        const msgProp = (err as Record<string, unknown>).message;
        lastErrorMessage = typeof msgProp === "string" ? msgProp : "(object error)";
      } else {
        lastErrorMessage = String(err);
      }

      // Check if it's a rate limit error
      if (!isRateLimitError(err)) {
        // Non-rate-limit error, don't retry
        throw err;
      }

      // Rate limit error - wait and retry
      if (attempt >= attempts) {
        // Last attempt, give up - log full history for diagnostics
        log.info(`[rate-limit] exhausted ${attempts} attempts, last error: ${lastErrorMessage}`);
        throw err;
      }

      const delay = resolveDelay(config, attempt);

      // Track retry attempt for diagnostics
      retryHistory.push({
        attempt,
        delayMs: delay,
        errorMessage: lastErrorMessage,
      });

      log.info(
        `[rate-limit] retry attempt ${attempt}/${attempts} after ${delay}ms, ` +
          `reason: ${lastErrorMessage.slice(0, 100)}`,
      );

      await sleepWithAbort(delay, signal);
    }
  }

  // Should not reach here, but TypeScript needs this
  throw lastError;
}

export type { OutboundRetryConfig };
