import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  calculateAuthProfileCooldownMs,
  ensureAuthProfileStore,
  markAuthProfileFailure,
  parseRetryAfterSeconds,
} from "./auth-profiles.js";

type AuthProfileStore = ReturnType<typeof ensureAuthProfileStore>;

async function withAuthProfileStore(
  fn: (ctx: { agentDir: string; store: AuthProfileStore }) => Promise<void>,
): Promise<void> {
  const agentDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-auth-"));
  try {
    const authPath = path.join(agentDir, "auth-profiles.json");
    fs.writeFileSync(
      authPath,
      JSON.stringify({
        version: 1,
        profiles: {
          "anthropic:default": {
            type: "api_key",
            provider: "anthropic",
            key: "sk-default",
          },
        },
      }),
    );

    const store = ensureAuthProfileStore(agentDir);
    await fn({ agentDir, store });
  } finally {
    fs.rmSync(agentDir, { recursive: true, force: true });
  }
}

function expectCooldownInRange(remainingMs: number, minMs: number, maxMs: number): void {
  expect(remainingMs).toBeGreaterThan(minMs);
  expect(remainingMs).toBeLessThan(maxMs);
}

describe("markAuthProfileFailure", () => {
  it("disables billing failures for ~5 hours by default", async () => {
    await withAuthProfileStore(async ({ agentDir, store }) => {
      const startedAt = Date.now();
      await markAuthProfileFailure({
        store,
        profileId: "anthropic:default",
        reason: "billing",
        agentDir,
      });

      const disabledUntil = store.usageStats?.["anthropic:default"]?.disabledUntil;
      expect(typeof disabledUntil).toBe("number");
      const remainingMs = (disabledUntil as number) - startedAt;
      expectCooldownInRange(remainingMs, 4.5 * 60 * 60 * 1000, 5.5 * 60 * 60 * 1000);
    });
  });
  it("honors per-provider billing backoff overrides", async () => {
    await withAuthProfileStore(async ({ agentDir, store }) => {
      const startedAt = Date.now();
      await markAuthProfileFailure({
        store,
        profileId: "anthropic:default",
        reason: "billing",
        agentDir,
        cfg: {
          auth: {
            cooldowns: {
              billingBackoffHoursByProvider: { Anthropic: 1 },
              billingMaxHours: 2,
            },
          },
        } as never,
      });

      const disabledUntil = store.usageStats?.["anthropic:default"]?.disabledUntil;
      expect(typeof disabledUntil).toBe("number");
      const remainingMs = (disabledUntil as number) - startedAt;
      expectCooldownInRange(remainingMs, 0.8 * 60 * 60 * 1000, 1.2 * 60 * 60 * 1000);
    });
  });
  it("keeps persisted cooldownUntil unchanged across mid-window retries", async () => {
    await withAuthProfileStore(async ({ agentDir, store }) => {
      await markAuthProfileFailure({
        store,
        profileId: "anthropic:default",
        reason: "rate_limit",
        agentDir,
      });

      const firstCooldownUntil = store.usageStats?.["anthropic:default"]?.cooldownUntil;
      expect(typeof firstCooldownUntil).toBe("number");

      await markAuthProfileFailure({
        store,
        profileId: "anthropic:default",
        reason: "rate_limit",
        agentDir,
      });

      const secondCooldownUntil = store.usageStats?.["anthropic:default"]?.cooldownUntil;
      expect(secondCooldownUntil).toBe(firstCooldownUntil);

      const reloaded = ensureAuthProfileStore(agentDir);
      expect(reloaded.usageStats?.["anthropic:default"]?.cooldownUntil).toBe(firstCooldownUntil);
    });
  });
  it("resets backoff counters outside the failure window", async () => {
    const agentDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-auth-"));
    try {
      const authPath = path.join(agentDir, "auth-profiles.json");
      const now = Date.now();
      fs.writeFileSync(
        authPath,
        JSON.stringify({
          version: 1,
          profiles: {
            "anthropic:default": {
              type: "api_key",
              provider: "anthropic",
              key: "sk-default",
            },
          },
          usageStats: {
            "anthropic:default": {
              errorCount: 9,
              failureCounts: { billing: 3 },
              lastFailureAt: now - 48 * 60 * 60 * 1000,
            },
          },
        }),
      );

      const store = ensureAuthProfileStore(agentDir);
      await markAuthProfileFailure({
        store,
        profileId: "anthropic:default",
        reason: "billing",
        agentDir,
        cfg: {
          auth: { cooldowns: { failureWindowHours: 24 } },
        } as never,
      });

      expect(store.usageStats?.["anthropic:default"]?.errorCount).toBe(1);
      expect(store.usageStats?.["anthropic:default"]?.failureCounts?.billing).toBe(1);
    } finally {
      fs.rmSync(agentDir, { recursive: true, force: true });
    }
  });
});

describe("calculateAuthProfileCooldownMs", () => {
  it("applies exponential backoff with a 1h cap", () => {
    expect(calculateAuthProfileCooldownMs(1)).toBe(60_000);
    expect(calculateAuthProfileCooldownMs(2)).toBe(5 * 60_000);
    expect(calculateAuthProfileCooldownMs(3)).toBe(25 * 60_000);
    expect(calculateAuthProfileCooldownMs(4)).toBe(60 * 60_000);
    expect(calculateAuthProfileCooldownMs(5)).toBe(60 * 60_000);
  });
});

describe("parseRetryAfterSeconds", () => {
  it("parses integer seconds", () => {
    expect(parseRetryAfterSeconds("60")).toBe(60);
    expect(parseRetryAfterSeconds("1")).toBe(1);
    expect(parseRetryAfterSeconds("120")).toBe(120);
  });

  it("caps at 3600 seconds", () => {
    expect(parseRetryAfterSeconds("7200")).toBe(3600);
    expect(parseRetryAfterSeconds("3600")).toBe(3600);
    expect(parseRetryAfterSeconds("3601")).toBe(3600);
  });

  it("floors at 1 second", () => {
    expect(parseRetryAfterSeconds("0")).toBeUndefined();
    expect(parseRetryAfterSeconds("-10")).toBeUndefined();
  });

  it("parses HTTP-date format", () => {
    const future = new Date(Date.now() + 30_000);
    const result = parseRetryAfterSeconds(future.toUTCString());
    expect(result).toBeGreaterThanOrEqual(1);
    expect(result).toBeLessThanOrEqual(31);
  });

  it("returns undefined for past HTTP-date", () => {
    const past = new Date(Date.now() - 60_000);
    expect(parseRetryAfterSeconds(past.toUTCString())).toBeUndefined();
  });

  it("returns undefined for null/undefined/empty/garbage", () => {
    expect(parseRetryAfterSeconds(null)).toBeUndefined();
    expect(parseRetryAfterSeconds(undefined)).toBeUndefined();
    expect(parseRetryAfterSeconds("")).toBeUndefined();
    expect(parseRetryAfterSeconds("  ")).toBeUndefined();
    expect(parseRetryAfterSeconds("not-a-date")).toBeUndefined();
  });
});

describe("markAuthProfileFailure with retryAfterSeconds", () => {
  it("uses Retry-After value as cooldown for rate_limit failures", async () => {
    await withAuthProfileStore(async ({ agentDir, store }) => {
      await markAuthProfileFailure({
        store,
        profileId: "anthropic:default",
        reason: "rate_limit",
        retryAfterSeconds: 60,
        agentDir,
      });

      const stats = store.usageStats?.["anthropic:default"];
      const now = Date.now();
      // cooldownUntil should be ~now+60s (within ±2s for timing)
      expect(stats?.cooldownUntil).toBeGreaterThan(now + 55_000);
      expect(stats?.cooldownUntil).toBeLessThan(now + 65_000);
    });
  });

  it("ignores retryAfterSeconds for non-rate_limit reasons", async () => {
    await withAuthProfileStore(async ({ agentDir, store }) => {
      await markAuthProfileFailure({
        store,
        profileId: "anthropic:default",
        reason: "billing",
        retryAfterSeconds: 60,
        agentDir,
      });

      const stats = store.usageStats?.["anthropic:default"];
      const now = Date.now();
      // billing uses disabledUntil (20h), ignores retryAfterSeconds
      expect(stats?.disabledUntil).toBeGreaterThan(now + 60 * 60_000);
      expect(stats?.cooldownUntil).toBeUndefined();
    });
  });
});
