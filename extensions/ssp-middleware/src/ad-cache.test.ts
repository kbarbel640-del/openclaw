import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdCache } from "./ad-cache.js";

describe("AdCache", () => {
  let cache: AdCache;

  beforeEach(() => {
    cache = new AdCache(5000); // 5 second TTL for tests
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockAsset = { title: "Test Ad", description: "A test ad", cta: "Click Here" };

  it("stores and retrieves a bid", () => {
    cache.set("conv:1", mockAsset, 1.5);
    expect(cache.has("conv:1")).toBe(true);
    expect(cache.size).toBe(1);
  });

  it("consume returns the bid and removes it (single-use)", () => {
    cache.set("conv:1", mockAsset, 1.5);

    const bid = cache.consume("conv:1");
    expect(bid).toBeDefined();
    expect(bid!.asset.title).toBe("Test Ad");
    expect(bid!.price).toBe(1.5);
    expect(bid!.conversationKey).toBe("conv:1");

    // Second consume should return undefined
    expect(cache.consume("conv:1")).toBeUndefined();
    expect(cache.has("conv:1")).toBe(false);
  });

  it("returns undefined for non-existent keys", () => {
    expect(cache.consume("nonexistent")).toBeUndefined();
    expect(cache.has("nonexistent")).toBe(false);
  });

  it("expires bids after TTL", () => {
    cache.set("conv:1", mockAsset, 1.5);

    // Advance time past TTL
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 6000);

    expect(cache.has("conv:1")).toBe(false);
    expect(cache.consume("conv:1")).toBeUndefined();
  });

  it("cleanup removes expired entries", () => {
    cache.set("conv:1", mockAsset, 1.0);
    cache.set("conv:2", mockAsset, 2.0);

    // Advance time so conv:1 is expired
    const baseTime = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(baseTime + 6000);

    cache.cleanup();
    expect(cache.size).toBe(0); // Both should be expired since both were set at roughly the same time
  });

  it("evicts oldest entry when capacity is reached", () => {
    const smallCache = new AdCache(60_000);

    // Fill beyond MAX_ENTRIES (500)
    for (let i = 0; i < 501; i++) {
      smallCache.set(`conv:${i}`, mockAsset, 1.0);
    }

    // The very first entry should have been evicted
    expect(smallCache.has("conv:0")).toBe(false);
    // The latest entry should still be there
    expect(smallCache.has("conv:500")).toBe(true);
  });
});
