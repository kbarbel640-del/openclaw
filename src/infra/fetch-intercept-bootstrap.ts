/**
 * This module MUST be imported before any other modules that use fetch.
 * It wraps globalThis.fetch to capture Anthropic rate limit headers.
 *
 * Import at the very top of src/index.ts:
 *   import "./infra/fetch-intercept-bootstrap.js";
 */

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const CONFIG_DIR = path.join(os.homedir(), ".clawdis");
const SNAPSHOT_PATH = path.join(CONFIG_DIR, "rate-limits.json");
const FETCH_WRAPPED = Symbol.for("clawdis.anthropicRateLimitFetch");

const HEADER_LIMIT_REQUESTS = "x-ratelimit-limit-requests";
const HEADER_LIMIT_TOKENS = "x-ratelimit-limit-tokens";
const HEADER_REMAINING_REQUESTS = "x-ratelimit-remaining-requests";
const HEADER_REMAINING_TOKENS = "x-ratelimit-remaining-tokens";
const HEADER_RESET_REQUESTS = "x-ratelimit-reset-requests";
const HEADER_RESET_TOKENS = "x-ratelimit-reset-tokens";

type RateLimitWindow = {
  limit?: number;
  remaining?: number;
  resetAt?: string;
};

type RateLimitSnapshot = {
  provider: "anthropic";
  capturedAt: string;
  source?: { url?: string };
  requests?: RateLimitWindow;
  tokens?: RateLimitWindow;
};

const parseHeaderNumber = (value: string | null): number | undefined => {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseResetAt = (value: string | null): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const numeric = Number(trimmed);
  if (Number.isFinite(numeric)) {
    const ms = numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
    const date = new Date(ms);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
    return undefined;
  }
  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString();
};

const buildSnapshot = (
  headers: Headers,
  url?: string,
): RateLimitSnapshot | null => {
  const limitRequests = parseHeaderNumber(headers.get(HEADER_LIMIT_REQUESTS));
  const limitTokens = parseHeaderNumber(headers.get(HEADER_LIMIT_TOKENS));
  const remainingRequests = parseHeaderNumber(headers.get(HEADER_REMAINING_REQUESTS));
  const remainingTokens = parseHeaderNumber(headers.get(HEADER_REMAINING_TOKENS));
  const resetRequests = parseResetAt(headers.get(HEADER_RESET_REQUESTS));
  const resetTokens = parseResetAt(headers.get(HEADER_RESET_TOKENS));

  const hasAny =
    limitRequests !== undefined ||
    limitTokens !== undefined ||
    remainingRequests !== undefined ||
    remainingTokens !== undefined ||
    resetRequests !== undefined ||
    resetTokens !== undefined;

  if (!hasAny) return null;

  const snapshot: RateLimitSnapshot = {
    provider: "anthropic",
    capturedAt: new Date().toISOString(),
  };
  if (url) snapshot.source = { url };

  if (limitRequests !== undefined || remainingRequests !== undefined || resetRequests !== undefined) {
    snapshot.requests = {
      limit: limitRequests,
      remaining: remainingRequests,
      resetAt: resetRequests,
    };
  }

  if (limitTokens !== undefined || remainingTokens !== undefined || resetTokens !== undefined) {
    snapshot.tokens = {
      limit: limitTokens,
      remaining: remainingTokens,
      resetAt: resetTokens,
    };
  }

  return snapshot;
};

const writeSnapshot = async (snapshot: RateLimitSnapshot): Promise<void> => {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
    await fs.writeFile(SNAPSHOT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, {
      mode: 0o600,
    });
  } catch {
    // Ignore write errors
  }
};

// Wrap fetch immediately on module load
const originalFetch = globalThis.fetch;
if (typeof originalFetch === "function" && !(originalFetch as any)[FETCH_WRAPPED]) {
  const wrappedFetch: typeof fetch = async (input, init) => {
    const response = await originalFetch.call(undefined, input, init);
    try {
      const snapshot = buildSnapshot(response.headers, response.url || undefined);
      if (snapshot) {
        void writeSnapshot(snapshot);
      }
    } catch {
      // Ignore capture errors
    }
    return response;
  };
  (wrappedFetch as any)[FETCH_WRAPPED] = true;
  globalThis.fetch = wrappedFetch;
}

export {};
