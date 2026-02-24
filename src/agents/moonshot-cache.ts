/**
 * Moonshot (Kimi) Context Caching
 *
 * Implements lazy caching for Moonshot/Kimi models using the /v1/caching API.
 * Caches system prompts and tool definitions to reduce token usage.
 *
 * @see https://github.com/Elarwei001/research_openclaw/blob/main/proposals/kimi-context-cache.md
 */

import { createHash } from "crypto";
import { log } from "./pi-embedded-runner/logger.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MoonshotCacheConfig = {
  enabled: boolean;
  ttl?: number; // Default: 3600 seconds
  resetTtl?: number; // TTL to set on each request, default: same as ttl
};

type CacheEntry = {
  cacheId: string;
  contentHash: string;
};

type CacheCreateRequest = {
  model: string;
  messages: Array<{ role: string; content: string }>;
  tools?: unknown[];
  ttl?: number;
};

type CacheCreateResponse = {
  id: string;
  object: string;
  status: string;
  tokens: number;
};

type Message = {
  role: string;
  content: unknown;
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

// Maximum number of cached sessions to prevent memory leaks
const MAX_CACHE_SIZE = 1000;

// Cache store: sessionKey -> CacheEntry
const cacheStore = new Map<string, CacheEntry>();

// Inflight cache creation promises to avoid duplicate creation
const inflightCreation = new Map<string, Promise<string>>();

/**
 * Evict oldest entries if cache exceeds max size.
 * Uses simple FIFO eviction (Map maintains insertion order).
 */
function evictIfNeeded(): void {
  while (cacheStore.size > MAX_CACHE_SIZE) {
    const oldestKey = cacheStore.keys().next().value;
    if (oldestKey) {
      cacheStore.delete(oldestKey);
      log.debug(`[moonshot-cache] Evicted oldest cache entry: ${oldestKey}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hashContent(system: string, tools: unknown[] | undefined): string {
  const content = JSON.stringify({ system, tools: tools ?? [] });
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

function shouldInvalidate(entry: CacheEntry | undefined, currentHash: string): boolean {
  if (!entry) {
    return true;
  }
  return entry.contentHash !== currentHash;
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

async function createCache(params: {
  apiKey: string;
  baseUrl: string;
  model: string;
  system: string;
  tools?: unknown[];
  ttl: number;
}): Promise<string> {
  const url = `${params.baseUrl}/caching`;
  const body: CacheCreateRequest = {
    model: params.model,
    messages: [{ role: "system", content: params.system }],
    ttl: params.ttl,
  };
  if (params.tools?.length) {
    body.tools = params.tools;
  }

  log.debug(`[moonshot-cache] Creating cache for model ${params.model}`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Moonshot cache creation failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as CacheCreateResponse;
  log.debug(`[moonshot-cache] Created cache ${data.id} (${data.tokens} tokens)`);
  return data.id;
}

async function deleteCache(params: {
  apiKey: string;
  baseUrl: string;
  cacheId: string;
}): Promise<void> {
  const url = `${params.baseUrl}/caching/${params.cacheId}`;
  try {
    await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
      },
    });
    log.debug(`[moonshot-cache] Deleted cache ${params.cacheId}`);
  } catch (err) {
    // Best effort deletion, don't throw
    log.debug(`[moonshot-cache] Failed to delete cache ${params.cacheId}: ${String(err)}`);
  }
}

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

/**
 * Get or create a cache for the given session.
 * Uses inflight promise coalescing to avoid duplicate creation.
 */
export async function getOrCreateCache(params: {
  sessionKey: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  system: string;
  tools?: unknown[];
  ttl: number;
}): Promise<string> {
  const contentHash = hashContent(params.system, params.tools);
  const existing = cacheStore.get(params.sessionKey);

  // Return existing cache if valid
  if (existing && !shouldInvalidate(existing, contentHash)) {
    log.debug(`[moonshot-cache] Cache hit for session ${params.sessionKey}`);
    return existing.cacheId;
  }

  // Check if creation already in progress
  const inflight = inflightCreation.get(params.sessionKey);
  if (inflight) {
    log.debug(`[moonshot-cache] Awaiting inflight creation for session ${params.sessionKey}`);
    return inflight;
  }

  // Create new cache with inflight lock
  const creationPromise = (async () => {
    try {
      // Delete old cache if exists and clear local entry immediately
      // This prevents stale entries if createCache fails after deletion
      if (existing) {
        cacheStore.delete(params.sessionKey);
        await deleteCache({
          apiKey: params.apiKey,
          baseUrl: params.baseUrl,
          cacheId: existing.cacheId,
        });
      }

      const cacheId = await createCache({
        apiKey: params.apiKey,
        baseUrl: params.baseUrl,
        model: params.model,
        system: params.system,
        tools: params.tools,
        ttl: params.ttl,
      });

      cacheStore.set(params.sessionKey, { cacheId, contentHash });
      evictIfNeeded();
      return cacheId;
    } finally {
      inflightCreation.delete(params.sessionKey);
    }
  })();

  inflightCreation.set(params.sessionKey, creationPromise);
  return creationPromise;
}

/**
 * Inject cache reference into messages array.
 * Replaces system message with cache role reference.
 */
export function injectCacheRole(messages: Message[], cacheId: string, resetTtl: number): Message[] {
  // Filter out system messages (they're in the cache)
  const nonSystemMessages = messages.filter((m) => m.role !== "system");

  // Prepend cache reference
  return [
    {
      role: "cache",
      content: `cache_id=${cacheId};reset_ttl=${resetTtl}`,
    },
    ...nonSystemMessages,
  ];
}

/**
 * Clear cache for a specific session.
 */
export function clearSessionCache(sessionKey: string): void {
  cacheStore.delete(sessionKey);
  log.debug(`[moonshot-cache] Cleared cache for session ${sessionKey}`);
}

/**
 * Clear all caches. Used for testing.
 */
export function clearAllCaches(): void {
  cacheStore.clear();
  inflightCreation.clear();
  log.debug(`[moonshot-cache] Cleared all caches`);
}

/**
 * Check if caching is enabled for a model based on config.
 */
export function isMoonshotCacheEnabled(
  provider: string,
  config: MoonshotCacheConfig | undefined,
): boolean {
  if (provider !== "moonshot") {
    return false;
  }
  return config?.enabled === true;
}

/**
 * Extract system message content from messages array.
 */
export function extractSystemMessage(messages: Message[]): string | undefined {
  const systemMsg = messages.find((m) => m.role === "system");
  if (!systemMsg) {
    return undefined;
  }
  if (typeof systemMsg.content === "string") {
    return systemMsg.content;
  }
  // Handle array content (like Anthropic format)
  if (Array.isArray(systemMsg.content)) {
    return systemMsg.content
      .filter((c): c is { type: string; text: string } => c?.type === "text")
      .map((c) => c.text)
      .join("\n");
  }
  return undefined;
}
