import { describe, it, expect, beforeEach } from "vitest";
import { createGlobalDedupeCache } from "../../infra/dedupe.js";

const GLOBAL_REGISTRY_KEY = "__openclaw_dedupe_caches__";

function clearGlobalRegistry() {
  delete (globalThis as Record<string, unknown>)[GLOBAL_REGISTRY_KEY];
}

describe("inbound dedupe cache survives SIGUSR1 restart", () => {
  beforeEach(() => {
    clearGlobalRegistry();
  });

  it("createGlobalDedupeCache returns same instance on repeated calls", () => {
    // Simulate the module-level init in inbound-dedupe.ts
    const cache1 = createGlobalDedupeCache({
      globalKey: "openclaw:inbound-dedupe",
      ttlMs: 20 * 60_000,
      maxSize: 5000,
    });

    cache1.check("telegram|acct1|sess1|peer1||msg-123", 1000);

    // Simulate module re-evaluation after SIGUSR1
    const cache2 = createGlobalDedupeCache({
      globalKey: "openclaw:inbound-dedupe",
      ttlMs: 20 * 60_000,
      maxSize: 5000,
    });

    expect(cache2).toBe(cache1);
    // The previously-recorded message should still be detected as duplicate
    expect(cache2.check("telegram|acct1|sess1|peer1||msg-123", 1500)).toBe(true);
  });

  it("different global keys produce independent caches", () => {
    const inbound = createGlobalDedupeCache({
      globalKey: "openclaw:inbound-dedupe",
      ttlMs: 20 * 60_000,
      maxSize: 5000,
    });
    const web = createGlobalDedupeCache({
      globalKey: "openclaw:web-inbound-dedupe",
      ttlMs: 20 * 60_000,
      maxSize: 5000,
    });

    inbound.check("key-1", 1000);
    // Same key in the web cache should NOT be a duplicate
    expect(web.check("key-1", 1000)).toBe(false);
  });
});
