export type DedupeCache = {
  check: (key: string | undefined | null, now?: number) => boolean;
  clear: () => void;
  size: () => number;
};

type DedupeCacheOptions = {
  ttlMs: number;
  maxSize: number;
};

type GlobalDedupeCacheOptions = DedupeCacheOptions & {
  /**
   * Unique key used to store the cache on `globalThis`.
   * When a cache already exists under this key (e.g. after a SIGUSR1
   * in-process restart that re-evaluates the module), the existing
   * instance is reused so previously-recorded entries survive the
   * restart cycle.
   */
  globalKey: string;
};

const GLOBAL_DEDUPE_REGISTRY_KEY = "__openclaw_dedupe_caches__";

function getGlobalRegistry(): Map<string, DedupeCache> {
  const g = globalThis as Record<string, unknown>;
  let registry = g[GLOBAL_DEDUPE_REGISTRY_KEY] as Map<string, DedupeCache> | undefined;
  if (!registry) {
    registry = new Map<string, DedupeCache>();
    g[GLOBAL_DEDUPE_REGISTRY_KEY] = registry;
  }
  return registry;
}

/**
 * Create a dedupe cache that survives in-process restarts (SIGUSR1).
 *
 * On first call the cache is created normally and stored in a
 * `globalThis` registry keyed by `globalKey`.  Subsequent calls with
 * the same key return the **existing** instance, preserving all
 * previously-recorded entries.
 */
export function createGlobalDedupeCache(options: GlobalDedupeCacheOptions): DedupeCache {
  const registry = getGlobalRegistry();
  const existing = registry.get(options.globalKey);
  if (existing) {
    return existing;
  }
  const cache = createDedupeCache(options);
  registry.set(options.globalKey, cache);
  return cache;
}

export function createDedupeCache(options: DedupeCacheOptions): DedupeCache {
  const ttlMs = Math.max(0, options.ttlMs);
  const maxSize = Math.max(0, Math.floor(options.maxSize));
  const cache = new Map<string, number>();

  const touch = (key: string, now: number) => {
    cache.delete(key);
    cache.set(key, now);
  };

  const prune = (now: number) => {
    const cutoff = ttlMs > 0 ? now - ttlMs : undefined;
    if (cutoff !== undefined) {
      for (const [entryKey, entryTs] of cache) {
        if (entryTs < cutoff) {
          cache.delete(entryKey);
        }
      }
    }
    if (maxSize <= 0) {
      cache.clear();
      return;
    }
    while (cache.size > maxSize) {
      const oldestKey = cache.keys().next().value;
      if (!oldestKey) {
        break;
      }
      cache.delete(oldestKey);
    }
  };

  return {
    check: (key, now = Date.now()) => {
      if (!key) {
        return false;
      }
      const existing = cache.get(key);
      if (existing !== undefined && (ttlMs <= 0 || now - existing < ttlMs)) {
        touch(key, now);
        return true;
      }
      touch(key, now);
      prune(now);
      return false;
    },
    clear: () => {
      cache.clear();
    },
    size: () => cache.size,
  };
}
