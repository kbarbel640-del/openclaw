import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  clearAllRateLimitCooldowns,
  ensureAuthProfileStore,
  markAuthProfileFailure,
} from "./auth-profiles.js";

describe("markAuthProfileFailure", () => {
  it("disables billing failures for ~5 hours by default", async () => {
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
      expect(remainingMs).toBeGreaterThan(4.5 * 60 * 60 * 1000);
      expect(remainingMs).toBeLessThan(5.5 * 60 * 60 * 1000);
    } finally {
      fs.rmSync(agentDir, { recursive: true, force: true });
    }
  });
  it("honors per-provider billing backoff overrides", async () => {
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
      expect(remainingMs).toBeGreaterThan(0.8 * 60 * 60 * 1000);
      expect(remainingMs).toBeLessThan(1.2 * 60 * 60 * 1000);
    } finally {
      fs.rmSync(agentDir, { recursive: true, force: true });
    }
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
  it("uses gentler backoff for rate_limit failures (max 5 min)", async () => {
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
      const startedAt = Date.now();

      // Simulate multiple rate limit failures (as happens during failover cascade)
      for (let i = 0; i < 5; i++) {
        await markAuthProfileFailure({
          store,
          profileId: "anthropic:default",
          reason: "rate_limit",
          agentDir,
        });
      }

      const cooldownUntil = store.usageStats?.["anthropic:default"]?.cooldownUntil;
      expect(typeof cooldownUntil).toBe("number");
      const remainingMs = (cooldownUntil as number) - startedAt;
      // Should cap at 5 minutes, not escalate to 1 hour
      expect(remainingMs).toBeLessThanOrEqual(5 * 60 * 1000 + 1000);
      expect(remainingMs).toBeGreaterThan(0);
    } finally {
      fs.rmSync(agentDir, { recursive: true, force: true });
    }
  });
  it("clearAllRateLimitCooldowns clears rate_limit but preserves billing", async () => {
    const agentDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-auth-"));
    try {
      const now = Date.now();
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
            "google:manual": {
              type: "api_key",
              provider: "google",
              key: "goog-key",
            },
          },
          usageStats: {
            "anthropic:default": {
              errorCount: 5,
              cooldownUntil: now + 3600000,
              failureCounts: { rate_limit: 5 },
              lastFailureAt: now,
            },
            "google:manual": {
              errorCount: 2,
              disabledUntil: now + 86400000,
              disabledReason: "billing",
              failureCounts: { billing: 2 },
              lastFailureAt: now,
            },
          },
        }),
      );

      const store = ensureAuthProfileStore(agentDir);
      await clearAllRateLimitCooldowns({ store, agentDir });

      // Rate-limited profile should be cleared
      expect(store.usageStats?.["anthropic:default"]?.cooldownUntil).toBeUndefined();
      expect(store.usageStats?.["anthropic:default"]?.errorCount).toBe(0);

      // Billing-disabled profile should be preserved
      expect(store.usageStats?.["google:manual"]?.disabledUntil).toBe(now + 86400000);
      expect(store.usageStats?.["google:manual"]?.disabledReason).toBe("billing");
    } finally {
      fs.rmSync(agentDir, { recursive: true, force: true });
    }
  });
});
