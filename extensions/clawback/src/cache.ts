import { createHash } from "node:crypto";
import type { CacheEntry } from "./types.js";

const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ENTRIES = 200;
const MAX_ENTRY_SIZE = 1024 * 1024; // 1 MB

const cache = new Map<string, CacheEntry>();

// ---------------------------------------------------------------------------
// Cache key generation: SHA-256 of model + messages + temperature
// ---------------------------------------------------------------------------

export function makeCacheKey(model: string, messages: unknown[], temperature?: number): string {
  const hash = createHash("sha256");
  hash.update(model);
  hash.update(JSON.stringify(messages));
  if (temperature !== undefined) {
    hash.update(String(temperature));
  }
  return hash.digest("hex");
}

// ---------------------------------------------------------------------------
// Cache operations
// ---------------------------------------------------------------------------

export function getCached<T = unknown>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) {
    return undefined;
  }

  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }

  // Move to end for LRU behavior (Map preserves insertion order)
  cache.delete(key);
  cache.set(key, entry);

  return entry.response as T;
}

export function setCached(key: string, response: unknown, ttlMs = DEFAULT_TTL_MS): boolean {
  const json = JSON.stringify(response);
  const size = json.length;

  if (size > MAX_ENTRY_SIZE) {
    return false;
  }

  // Evict oldest entries if at capacity
  while (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) {
      cache.delete(oldest);
    } else {
      break;
    }
  }

  cache.set(key, {
    response,
    size,
    expiresAt: Date.now() + ttlMs,
  });

  return true;
}

// ---------------------------------------------------------------------------
// Eligibility check: only cache non-streaming, non-tool-use responses
// ---------------------------------------------------------------------------

export function isCacheable(request: Record<string, unknown>): boolean {
  if (request.stream === true) {
    return false;
  }

  // Check for tool use in messages
  const messages = request.messages;
  if (Array.isArray(messages)) {
    for (const msg of messages) {
      const m = msg as Record<string, unknown>;
      if (m.tool_calls || m.tool_call_id) {
        return false;
      }
      if (m.role === "tool") {
        return false;
      }
    }
  }

  // Check for tool definitions
  if (Array.isArray(request.tools) && request.tools.length > 0) {
    return false;
  }

  return true;
}

export function clearCache(): void {
  cache.clear();
}

export function cacheSize(): number {
  return cache.size;
}
