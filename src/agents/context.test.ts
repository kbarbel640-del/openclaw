/**
 * Test #14708: MODEL_CACHE context window collision across providers
 *
 * The real context.ts loads models via discoverModels().getAll() and caches
 * them keyed by provider/modelId. We mock the discovery layer to return two
 * models with the same ID but different providers/contextWindows, then call
 * the real lookupContextTokens to verify provider-qualified lookups work.
 */
import { describe, expect, it, vi } from "vitest";

// Mock dependencies that context.ts imports at load time
vi.mock("../config/config.js", () => ({
  loadConfig: () => ({}),
}));
vi.mock("./agent-paths.js", () => ({
  resolveOpenClawAgentDir: () => "/tmp/fake-agent-dir",
}));
vi.mock("./models-config.js", () => ({
  ensureOpenClawModelsJson: async () => {},
}));

// Two providers have the same model ID but different context windows
const fakeModels = [
  { id: "claude-opus-4-6", provider: "anthropic", contextWindow: 200_000 },
  { id: "claude-opus-4-6", provider: "my-proxy", contextWindow: 128_000 },
  { id: "gpt-4.1", provider: "openai", contextWindow: 1_047_576 },
];

vi.mock("./pi-model-discovery.js", () => ({
  discoverAuthStorage: () => ({}),
  discoverModels: () => ({
    getAll: () => fakeModels,
  }),
}));

describe("MODEL_CACHE provider-qualified keys (#14708)", () => {
  it("returns correct context window per provider for same model ID", async () => {
    const { lookupContextTokens, loadPromise } = await import("./context.js");
    await loadPromise;

    // Provider-qualified lookups return the correct value for each provider
    expect(lookupContextTokens("claude-opus-4-6", "anthropic")).toBe(200_000);
    expect(lookupContextTokens("claude-opus-4-6", "my-proxy")).toBe(128_000);

    // Non-colliding model works fine
    expect(lookupContextTokens("gpt-4.1", "openai")).toBe(1_047_576);
  });

  it("bare model ID fallback uses first-writer-wins", async () => {
    const { lookupContextTokens, loadPromise } = await import("./context.js");
    await loadPromise;

    // Without provider, falls back to bare model ID (first-writer-wins: anthropic's 200k)
    expect(lookupContextTokens("claude-opus-4-6")).toBe(200_000);
  });

  it("lookupContextTokens accepts optional provider parameter", async () => {
    const { lookupContextTokens, loadPromise } = await import("./context.js");
    await loadPromise;
    // Function now accepts 2 params: modelId and optional provider
    expect(lookupContextTokens.length).toBeGreaterThanOrEqual(1);
    // Calling without provider still works (backward compatible)
    expect(lookupContextTokens("gpt-4.1")).toBe(1_047_576);
  });
});
