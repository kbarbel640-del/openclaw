import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import type { AuthProfileStore } from "./auth-profiles.js";

const ensureAuthProfileStoreMock = vi.fn();
const listProfilesForProviderMock = vi.fn();
const getProfileCooldownRemainingMsMock = vi.fn();
const isModelCoolingDownMock = vi.fn();

vi.mock("./auth-profiles.js", () => ({
  ensureAuthProfileStore: (...args: unknown[]) => ensureAuthProfileStoreMock(...args),
  listProfilesForProvider: (...args: unknown[]) => listProfilesForProviderMock(...args),
  getProfileCooldownRemainingMs: (...args: unknown[]) => getProfileCooldownRemainingMsMock(...args),
}));

vi.mock("./model-fallback.js", () => ({
  isModelCoolingDown: (...args: unknown[]) => isModelCoolingDownMock(...args),
}));

const cfg = {
  agents: { defaults: {} },
} as unknown as OpenClawConfig;

function makeStore(): AuthProfileStore {
  return {
    profiles: {},
    usageStats: {},
  };
}

describe("model-availability", () => {
  beforeEach(() => {
    ensureAuthProfileStoreMock.mockReset();
    listProfilesForProviderMock.mockReset();
    getProfileCooldownRemainingMsMock.mockReset();
    isModelCoolingDownMock.mockReset();
  });

  it("filters out model entries in cooldown", async () => {
    const { filterModelsByOperationalHealth } = await import("./model-availability.js");
    ensureAuthProfileStoreMock.mockReturnValue(makeStore());
    listProfilesForProviderMock.mockReturnValue([]);
    isModelCoolingDownMock.mockImplementation(
      (ref: { provider?: string; model?: string }) => ref.model === "bad-model",
    );

    const filtered = filterModelsByOperationalHealth({
      models: [
        { provider: "openai-codex", id: "good-model", name: "Good" },
        { provider: "openai-codex", id: "bad-model", name: "Bad" },
      ],
      cfg,
    });

    expect(filtered.map((m) => m.id)).toEqual(["good-model"]);
  });

  it("filters out providers when all auth profiles are unavailable", async () => {
    const { filterModelsByOperationalHealth } = await import("./model-availability.js");
    const store = makeStore();
    store.usageStats = {
      "anthropic:oauth": { disabledUntil: Date.now() + 60_000 },
    };
    ensureAuthProfileStoreMock.mockReturnValue(store);
    isModelCoolingDownMock.mockReturnValue(false);
    listProfilesForProviderMock.mockImplementation((_s: AuthProfileStore, provider: string) => {
      if (provider === "anthropic") {
        return ["anthropic:oauth"];
      }
      return [];
    });
    getProfileCooldownRemainingMsMock.mockReturnValue(0);

    const filtered = filterModelsByOperationalHealth({
      models: [
        { provider: "anthropic", id: "claude-opus-4-6", name: "Opus" },
        { provider: "openai-codex", id: "gpt-5.1", name: "GPT" },
      ],
      cfg,
    });

    expect(filtered.map((m) => `${m.provider}/${m.id}`)).toEqual(["openai-codex/gpt-5.1"]);
  });

  it("keeps provider models when at least one auth profile is available", async () => {
    const { filterModelsByOperationalHealth } = await import("./model-availability.js");
    const store = makeStore();
    ensureAuthProfileStoreMock.mockReturnValue(store);
    isModelCoolingDownMock.mockReturnValue(false);
    listProfilesForProviderMock.mockImplementation((_s: AuthProfileStore, provider: string) => {
      if (provider === "anthropic") {
        return ["anthropic:p1", "anthropic:p2"];
      }
      return [];
    });
    getProfileCooldownRemainingMsMock.mockImplementation(
      (_s: AuthProfileStore, profileId: string) => (profileId === "anthropic:p1" ? 30_000 : 0),
    );

    const filtered = filterModelsByOperationalHealth({
      models: [{ provider: "anthropic", id: "claude-opus-4-6", name: "Opus" }],
      cfg,
    });

    expect(filtered).toHaveLength(1);
  });
});
