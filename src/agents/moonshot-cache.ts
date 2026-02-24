/**
 * Moonshot (Kimi) Context Caching via /v1/caching API.
 * @see https://github.com/Elarwei001/research_openclaw/blob/main/proposals/kimi-context-cache.md
 */

import { createHash } from "crypto";
import type { StreamFn } from "@mariozechner/pi-agent-core";
import { log } from "./pi-embedded-runner/logger.js";

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

type Message = { role: string; content: unknown };

const MAX_CACHE_SIZE = 1000;
const cacheStore = new Map<string, CacheEntry>();
const inflightCreation = new Map<string, Promise<string>>();

function evictIfNeeded(): void {
  while (cacheStore.size > MAX_CACHE_SIZE) {
    const key = cacheStore.keys().next().value;
    if (key) {
      cacheStore.delete(key);
    }
  }
}

function hashContent(system: string, tools: unknown[] | undefined): string {
  return createHash("sha256")
    .update(JSON.stringify({ system, tools: tools ?? [] }))
    .digest("hex")
    .slice(0, 16);
}

function toCacheModelName(modelId: string): string {
  const name = modelId.includes("/") ? modelId.split("/").pop()! : modelId;
  if (name.startsWith("moonshot-v1") || name.startsWith("kimi-k")) {
    return "moonshot-v1";
  }
  return name;
}

function shouldInvalidate(entry: CacheEntry | undefined, hash: string): boolean {
  return !entry || entry.contentHash !== hash;
}

async function createCache(params: {
  apiKey: string;
  baseUrl: string;
  model: string;
  system: string;
  tools?: unknown[];
  ttl: number;
}): Promise<string> {
  const url = `${params.baseUrl}/caching`;
  const cacheModel = toCacheModelName(params.model);
  const body: CacheCreateRequest = {
    model: cacheModel,
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

/** Get or create a cache. Uses promise coalescing to avoid duplicate creation. */
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

/** Inject cache role, replacing system message with cache reference. */
export function injectCacheRole(messages: Message[], cacheId: string, resetTtl: number): Message[] {
  return [
    { role: "cache", content: `cache_id=${cacheId};reset_ttl=${resetTtl}` },
    ...messages.filter((m) => m.role !== "system"),
  ];
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
/** Check if caching is enabled for Moonshot provider. */
export function isMoonshotCacheEnabled(
  provider: string,
  config: MoonshotCacheConfig | undefined,
): boolean {
  return provider === "moonshot" && config?.enabled === true;
}

function extractSystemMessage(messages: Message[]): string | undefined {
  const msg = messages.find((m) => m.role === "system");
  if (!msg) {
    return undefined;
  }
  if (typeof msg.content === "string") {
    return msg.content;
  }
  if (Array.isArray(msg.content)) {
    return msg.content
      .filter((c): c is { type: string; text: string } => c?.type === "text")
      .map((c) => c.text)
      .join("\n");
  }
  return undefined;
}

const MOONSHOT_BASE_URLS: Record<string, string> = {
  moonshot: "https://api.moonshot.ai/v1",
  "moonshot-cn": "https://api.moonshot.cn/v1",
};

/** Resolve cache config from extraParams. */
export function resolveMoonshotCacheConfig(
  extraParams: Record<string, unknown> | undefined,
): MoonshotCacheConfig | undefined {
  const cfg = extraParams?.contextCache;
  if (!cfg || typeof cfg !== "object" || (cfg as Record<string, unknown>).enabled !== true) {
    return undefined;
  }
  const c = cfg as Record<string, unknown>;
  return {
    enabled: true,
    ttl: typeof c.ttl === "number" ? c.ttl : 3600,
    resetTtl: typeof c.resetTtl === "number" ? c.resetTtl : undefined,
  };
}

/** Create streamFn wrapper for Moonshot context caching. */
export function createMoonshotCacheWrapper(
  baseStreamFn: StreamFn,
  config: MoonshotCacheConfig,
  modelId: string,
): StreamFn {
  const ttl = config.ttl ?? 3600;
  const resetTtl = config.resetTtl ?? ttl;

  return (model, context, options) => {
    const apiKey = options?.apiKey;
    const sessionKey = (options as Record<string, unknown> | undefined)?.sessionKey as
      | string
      | undefined;

    // Skip caching if we don't have required params
    if (!apiKey || typeof apiKey !== "string" || !sessionKey) {
      log.debug(`[moonshot-cache] Skipping cache: missing apiKey or sessionKey`);
      return baseStreamFn(model, context, options);
    }

    // Extract system message
    const messages = (context.messages ?? []) as Message[];
    const systemContent = extractSystemMessage(messages);
    if (!systemContent) {
      log.debug(`[moonshot-cache] Skipping cache: no system message found`);
      return baseStreamFn(model, context, options);
    }

    // Get tools from context
    const tools = context.tools as unknown[] | undefined;

    // Resolve base URL
    const baseUrl =
      (model.baseUrl as string | undefined) ??
      MOONSHOT_BASE_URLS[model.provider ?? "moonshot"] ??
      MOONSHOT_BASE_URLS.moonshot;

    // Resolve cache BEFORE streaming starts to avoid async onPayload race condition.
    // StreamFn allows returning Promise<stream>, so we use an async IIFE.
    return (async () => {
      let modifiedContext = context;

      try {
        const cacheId = await getOrCreateCache({
          sessionKey,
          apiKey,
          baseUrl,
          model: modelId,
          system: systemContent,
          tools,
          ttl,
        });

        // Inject cache role into messages, replacing system message.
        // Cast to context.messages type to avoid pi-ai's stricter Message type.
        const modifiedMessages = injectCacheRole(
          messages,
          cacheId,
          resetTtl,
        ) as unknown as typeof context.messages;

        modifiedContext = {
          ...context,
          messages: modifiedMessages,
        };

        log.debug(`[moonshot-cache] Injected cache ${cacheId} for session ${sessionKey}`);
      } catch (err) {
        // On cache error, fall back to normal request with original context
        log.warn(`[moonshot-cache] Cache error, falling back: ${String(err)}`);
      }

      // Delegate to underlying stream with (possibly modified) context
      return baseStreamFn(model, modifiedContext, options);
    })();
  };
}
