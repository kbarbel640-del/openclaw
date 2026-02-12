import { describe, it, expect, beforeEach } from "vitest";
import { createDedupeCache, createGlobalDedupeCache } from "./dedupe.js";

const GLOBAL_REGISTRY_KEY = "__openclaw_dedupe_caches__";

function clearGlobalRegistry() {
  delete (globalThis as Record<string, unknown>)[GLOBAL_REGISTRY_KEY];
}

describe("createDedupeCache", () => {
  it("returns false on first check, true on duplicate", () => {
    const cache = createDedupeCache({ ttlMs: 60_000, maxSize: 100 });
    expect(cache.check("a", 1000)).toBe(false);
    expect(cache.check("a", 1500)).toBe(true);
  });

  it("expires entries after ttl", () => {
    const cache = createDedupeCache({ ttlMs: 1000, maxSize: 100 });
    expect(cache.check("a", 1000)).toBe(false);
    // Within TTL → duplicate
    expect(cache.check("a", 1500)).toBe(true);
    // Beyond TTL → treated as new
    expect(cache.check("a", 2500)).toBe(false);
  });

  it("evicts oldest entries when maxSize is exceeded", () => {
    const cache = createDedupeCache({ ttlMs: 60_000, maxSize: 2 });
    cache.check("a", 1000);
    cache.check("b", 2000);
    // Adding a third entry should evict "a"
    cache.check("c", 3000);
    expect(cache.size()).toBe(2);
    // "a" was evicted, so this is treated as new
    expect(cache.check("a", 3500)).toBe(false);
  });
});

describe("createGlobalDedupeCache", () => {
  beforeEach(() => {
    clearGlobalRegistry();
  });

  it("returns the same cache instance for the same globalKey", () => {
    const cache1 = createGlobalDedupeCache({
      globalKey: "test:same-key",
      ttlMs: 60_000,
      maxSize: 100,
    });
    const cache2 = createGlobalDedupeCache({
      globalKey: "test:same-key",
      ttlMs: 60_000,
      maxSize: 100,
    });
    expect(cache1).toBe(cache2);
  });

  it("returns different cache instances for different globalKeys", () => {
    const cache1 = createGlobalDedupeCache({
      globalKey: "test:key-a",
      ttlMs: 60_000,
      maxSize: 100,
    });
    const cache2 = createGlobalDedupeCache({
      globalKey: "test:key-b",
      ttlMs: 60_000,
      maxSize: 100,
    });
    expect(cache1).not.toBe(cache2);
  });

  it("preserves entries across repeated calls (simulating module re-evaluation)", () => {
    const cache1 = createGlobalDedupeCache({
      globalKey: "test:persist",
      ttlMs: 60_000,
      maxSize: 100,
    });
    // Record a message
    expect(cache1.check("msg-1", 1000)).toBe(false);
    expect(cache1.size()).toBe(1);

    // Simulate module re-evaluation: call createGlobalDedupeCache again
    const cache2 = createGlobalDedupeCache({
      globalKey: "test:persist",
      ttlMs: 60_000,
      maxSize: 100,
    });

    // Should still have the entry from before
    expect(cache2.size()).toBe(1);
    expect(cache2.check("msg-1", 1500)).toBe(true);
  });

  it("clear() empties the cache but keeps the instance in the registry", () => {
    const cache1 = createGlobalDedupeCache({
      globalKey: "test:clear",
      ttlMs: 60_000,
      maxSize: 100,
    });
    cache1.check("msg-1", 1000);
    expect(cache1.size()).toBe(1);

    cache1.clear();
    expect(cache1.size()).toBe(0);

    // Subsequent call still returns the same instance
    const cache2 = createGlobalDedupeCache({
      globalKey: "test:clear",
      ttlMs: 60_000,
      maxSize: 100,
    });
    expect(cache2).toBe(cache1);
    expect(cache2.size()).toBe(0);
  });
});
