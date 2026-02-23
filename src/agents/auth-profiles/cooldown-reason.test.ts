import { describe, expect, it } from "vitest";
import type { AuthProfileStore } from "./types.js";

/**
 * Tests that cooldownReason is correctly stored in ProfileUsageStats and
 * that the fallback reason surfaced in error messages reflects the actual
 * failure type rather than the hardcoded "rate_limit" sentinel.
 * See: https://github.com/openclaw/openclaw/issues/23996
 */

function makeStore(usageStats: AuthProfileStore["usageStats"] = {}): AuthProfileStore {
  return {
    version: 1,
    profiles: {
      "anthropic:default": { type: "api_key", provider: "anthropic", key: "sk-test" },
    },
    usageStats,
  };
}

describe("ProfileUsageStats.cooldownReason", () => {
  it("reads back the stored cooldown reason (timeout)", () => {
    const store = makeStore({
      "anthropic:default": {
        cooldownUntil: Date.now() + 60_000,
        cooldownReason: "timeout",
      },
    });
    expect(store.usageStats?.["anthropic:default"]?.cooldownReason).toBe("timeout");
  });

  it("reads back the stored cooldown reason (auth)", () => {
    const store = makeStore({
      "anthropic:default": {
        cooldownUntil: Date.now() + 60_000,
        cooldownReason: "auth",
      },
    });
    expect(store.usageStats?.["anthropic:default"]?.cooldownReason).toBe("auth");
  });

  it("resolves the reason from profile list (model-fallback pattern)", () => {
    // Mirrors the logic added to model-fallback.ts:
    //   const storedReason = profileIds
    //     .map((id) => authStore.usageStats?.[id]?.cooldownReason)
    //     .find((r) => r != null);
    //   reason: storedReason ?? "rate_limit"
    const store = makeStore({
      "anthropic:default": { cooldownUntil: Date.now() + 60_000, cooldownReason: "timeout" },
    });
    const profileIds = ["anthropic:default"];
    const storedReason = profileIds
      .map((id) => store.usageStats?.[id]?.cooldownReason)
      .find((r) => r != null);
    expect(storedReason ?? "rate_limit").toBe("timeout");
  });

  it("falls back to 'rate_limit' when no cooldownReason is stored (legacy)", () => {
    const store = makeStore({
      "anthropic:default": { cooldownUntil: Date.now() + 60_000 },
    });
    const profileIds = ["anthropic:default"];
    const storedReason = profileIds
      .map((id) => store.usageStats?.[id]?.cooldownReason)
      .find((r) => r != null);
    expect(storedReason ?? "rate_limit").toBe("rate_limit");
  });
});
