import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { buildDirectoryCacheKey, DirectoryCache } from "./directory-cache.js";

describe("buildDirectoryCacheKey", () => {
  it("builds key with all fields", () => {
    const key = buildDirectoryCacheKey({
      channel: "telegram" as any,
      accountId: "main",
      kind: "user" as any,
      source: "cache",
      signature: "sig1",
    });
    expect(key).toBe("telegram:main:user:cache:sig1");
  });

  it("defaults accountId to 'default'", () => {
    const key = buildDirectoryCacheKey({
      channel: "discord" as any,
      kind: "channel" as any,
      source: "live",
    });
    expect(key).toBe("discord:default:channel:live:default");
  });

  it("defaults signature to 'default'", () => {
    const key = buildDirectoryCacheKey({
      channel: "slack" as any,
      accountId: "a1",
      kind: "user" as any,
      source: "cache",
      signature: null,
    });
    expect(key).toBe("slack:a1:user:cache:default");
  });
});

describe("DirectoryCache", () => {
  const cfg1 = { test: 1 } as any;
  const cfg2 = { test: 2 } as any;

  it("stores and retrieves values", () => {
    const cache = new DirectoryCache<string>(60000);
    cache.set("k1", "v1", cfg1);
    expect(cache.get("k1", cfg1)).toBe("v1");
  });

  it("returns undefined for missing keys", () => {
    const cache = new DirectoryCache<string>(60000);
    expect(cache.get("missing", cfg1)).toBeUndefined();
  });

  it("expires entries after TTL", () => {
    vi.useFakeTimers();
    const cache = new DirectoryCache<string>(1000);
    cache.set("k1", "v1", cfg1);
    expect(cache.get("k1", cfg1)).toBe("v1");
    vi.advanceTimersByTime(1001);
    expect(cache.get("k1", cfg1)).toBeUndefined();
    vi.useRealTimers();
  });

  it("clears on config change", () => {
    const cache = new DirectoryCache<string>(60000);
    cache.set("k1", "v1", cfg1);
    expect(cache.get("k1", cfg1)).toBe("v1");
    // Access with different config reference
    expect(cache.get("k1", cfg2)).toBeUndefined();
  });

  it("clearMatching removes matching keys", () => {
    const cache = new DirectoryCache<string>(60000);
    cache.set("telegram:a", "v1", cfg1);
    cache.set("discord:b", "v2", cfg1);
    cache.clearMatching((k) => k.startsWith("telegram"));
    expect(cache.get("telegram:a", cfg1)).toBeUndefined();
    expect(cache.get("discord:b", cfg1)).toBe("v2");
  });

  it("clear removes all entries", () => {
    const cache = new DirectoryCache<string>(60000);
    cache.set("k1", "v1", cfg1);
    cache.set("k2", "v2", cfg1);
    cache.clear(cfg1);
    expect(cache.get("k1", cfg1)).toBeUndefined();
    expect(cache.get("k2", cfg1)).toBeUndefined();
  });
});
