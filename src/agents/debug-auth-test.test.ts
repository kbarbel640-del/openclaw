import { describe, it, expect } from "vitest";
import { resolveAuthProfileOrder } from "./auth-profiles/order.js";
import { listProfilesForProvider } from "./auth-profiles/profiles.js";
import { ensureAuthProfileStore } from "./auth-profiles/store.js";
import { resolveApiKeyForProvider } from "./model-auth.js";

describe("debug auth resolution", () => {
  const agentDir = "/Users/juliocezar/.openclaw/agents/main/agent";

  it("should find google-antigravity profiles", () => {
    const store = ensureAuthProfileStore(agentDir, { allowKeychainPrompt: false });
    console.log("Store profiles:", Object.keys(store.profiles));
    console.log(
      "Profile providers:",
      Object.values(store.profiles).map((p: unknown) => (p as { provider?: string }).provider),
    );

    const profiles = listProfilesForProvider(store, "google-antigravity");
    console.log("listProfilesForProvider result:", profiles);
    expect(profiles.length).toBeGreaterThan(0);
  });

  it("should resolve auth profile order", () => {
    const store = ensureAuthProfileStore(agentDir, { allowKeychainPrompt: false });
    const order = resolveAuthProfileOrder({ store, provider: "google-antigravity" });
    console.log("Profile order for google-antigravity:", order);
    expect(order.length).toBeGreaterThan(0);
  });

  it("should resolve API key for google-antigravity", async () => {
    const store = ensureAuthProfileStore(agentDir, { allowKeychainPrompt: false });
    try {
      const result = await resolveApiKeyForProvider({
        provider: "google-antigravity",
        store,
        agentDir,
      });
      console.log("Resolved:", {
        keyPrefix: result.apiKey?.substring(0, 50) + "...",
        source: result.source,
        mode: result.mode,
        profileId: result.profileId,
      });
      expect(result.apiKey).toBeTruthy();
    } catch (error: unknown) {
      console.error("Resolution failed:", (error as Error).message);
      throw error;
    }
  });
});
