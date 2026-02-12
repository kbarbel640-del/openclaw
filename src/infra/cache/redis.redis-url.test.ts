import { describe, expect, it, beforeEach, afterEach } from "vitest";

async function loadModule() {
  const mod = await import("./redis.js");
  return mod;
}

describe("infra/cache redis (REDIS_URL)", () => {
  const prev = { ...process.env };

  beforeEach(() => {
    process.env = { ...prev };
    delete process.env.REDIS_URL;
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;
    delete process.env.REDIS_PASSWORD;
    delete process.env.REDIS_DB;
  });

  afterEach(() => {
    process.env = { ...prev };
  });

  it("parses REDIS_URL and prefers it over REDIS_*", async () => {
    process.env.REDIS_URL = "redis://:secret@cache.local:6380/2";
    process.env.REDIS_HOST = "should-not-win";
    const { getRedisConfig } = await loadModule();
    const cfg = getRedisConfig();
    expect(cfg.host).toBe("cache.local");
    expect(cfg.port).toBe(6380);
    expect(cfg.password).toBe("secret");
    expect(cfg.db).toBe(2);
    expect(cfg.url).toBe(process.env.REDIS_URL);
  });
});
