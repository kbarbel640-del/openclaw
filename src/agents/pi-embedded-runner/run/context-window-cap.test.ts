import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../../../config/config.js";
import { resolveContextWindowInfo } from "../../../agents/context-window-guard.js";
import { DEFAULT_CONTEXT_TOKENS } from "../../../agents/defaults.js";

describe("context window capping for auto-compaction", () => {
  it("returns model contextWindow when no config cap is set", () => {
    const result = resolveContextWindowInfo({
      cfg: undefined,
      provider: "anthropic",
      modelId: "claude-sonnet-4",
      modelContextWindow: 200_000,
      defaultTokens: DEFAULT_CONTEXT_TOKENS,
    });

    expect(result.tokens).toBe(200_000);
    expect(result.source).toBe("model");
  });

  it("returns agentContextTokens when it is less than model contextWindow", () => {
    const cfg: OpenClawConfig = {
      agents: {
        defaults: {
          contextTokens: 100_000,
        },
      },
    };

    const result = resolveContextWindowInfo({
      cfg,
      provider: "anthropic",
      modelId: "claude-sonnet-4",
      modelContextWindow: 200_000,
      defaultTokens: DEFAULT_CONTEXT_TOKENS,
    });

    expect(result.tokens).toBe(100_000);
    expect(result.source).toBe("agentContextTokens");
  });

  it("returns model contextWindow when agentContextTokens is greater", () => {
    const cfg: OpenClawConfig = {
      agents: {
        defaults: {
          contextTokens: 300_000,
        },
      },
    };

    const result = resolveContextWindowInfo({
      cfg,
      provider: "anthropic",
      modelId: "claude-sonnet-4",
      modelContextWindow: 200_000,
      defaultTokens: DEFAULT_CONTEXT_TOKENS,
    });

    expect(result.tokens).toBe(200_000);
    expect(result.source).toBe("model");
  });

  it("returns agentContextTokens when model contextWindow is undefined", () => {
    const cfg: OpenClawConfig = {
      agents: {
        defaults: {
          contextTokens: 100_000,
        },
      },
    };

    const result = resolveContextWindowInfo({
      cfg,
      provider: "anthropic",
      modelId: "claude-sonnet-4",
      modelContextWindow: undefined,
      defaultTokens: DEFAULT_CONTEXT_TOKENS,
    });

    expect(result.tokens).toBe(100_000);
    expect(result.source).toBe("agentContextTokens");
  });

  it("returns default when both model and config are undefined", () => {
    const result = resolveContextWindowInfo({
      cfg: undefined,
      provider: "anthropic",
      modelId: "claude-sonnet-4",
      modelContextWindow: undefined,
      defaultTokens: DEFAULT_CONTEXT_TOKENS,
    });

    expect(result.tokens).toBe(DEFAULT_CONTEXT_TOKENS);
    expect(result.source).toBe("default");
  });

  it("respects modelsConfig override when model metadata is absent", () => {
    const cfg: OpenClawConfig = {
      models: {
        providers: {
          anthropic: {
            models: [
              {
                id: "claude-sonnet-4",
                contextWindow: 150_000,
              },
            ],
          },
        },
      },
    };

    const result = resolveContextWindowInfo({
      cfg,
      provider: "anthropic",
      modelId: "claude-sonnet-4",
      modelContextWindow: undefined,
      defaultTokens: DEFAULT_CONTEXT_TOKENS,
    });

    // With modelContextWindow absent, modelsConfig is the next source
    expect(result.tokens).toBe(150_000);
    expect(result.source).toBe("modelsConfig");
  });

  it("agentContextTokens caps modelsConfig when lower", () => {
    const cfg: OpenClawConfig = {
      agents: {
        defaults: {
          contextTokens: 100_000,
        },
      },
      models: {
        providers: {
          anthropic: {
            models: [
              {
                id: "claude-sonnet-4",
                contextWindow: 150_000,
              },
            ],
          },
        },
      },
    };

    const result = resolveContextWindowInfo({
      cfg,
      provider: "anthropic",
      modelId: "claude-sonnet-4",
      modelContextWindow: undefined,
      defaultTokens: DEFAULT_CONTEXT_TOKENS,
    });

    expect(result.tokens).toBe(100_000);
    expect(result.source).toBe("agentContextTokens");
  });

  describe("effectiveModel calculation", () => {
    it("caps model.contextWindow when contextTokens is smaller", () => {
      const model = {
        id: "claude-sonnet-4",
        contextWindow: 200_000,
        provider: "anthropic",
      };

      const ctxInfo = resolveContextWindowInfo({
        cfg: { agents: { defaults: { contextTokens: 100_000 } } },
        provider: "anthropic",
        modelId: "claude-sonnet-4",
        modelContextWindow: model.contextWindow,
        defaultTokens: DEFAULT_CONTEXT_TOKENS,
      });

      const effectiveModel =
        ctxInfo.tokens < (model.contextWindow ?? Infinity)
          ? { ...model, contextWindow: ctxInfo.tokens }
          : model;

      expect(effectiveModel.contextWindow).toBe(100_000);
      expect(effectiveModel).not.toBe(model); // Should be a new object
    });

    it("does not modify model when contextTokens is larger", () => {
      const model = {
        id: "claude-sonnet-4",
        contextWindow: 200_000,
        provider: "anthropic",
      };

      const ctxInfo = resolveContextWindowInfo({
        cfg: { agents: { defaults: { contextTokens: 300_000 } } },
        provider: "anthropic",
        modelId: "claude-sonnet-4",
        modelContextWindow: model.contextWindow,
        defaultTokens: DEFAULT_CONTEXT_TOKENS,
      });

      const effectiveModel =
        ctxInfo.tokens < (model.contextWindow ?? Infinity)
          ? { ...model, contextWindow: ctxInfo.tokens }
          : model;

      expect(effectiveModel).toBe(model); // Should be the same object
      expect(effectiveModel.contextWindow).toBe(200_000);
    });

    it("does not cap model when contextTokens equals model contextWindow", () => {
      const model = {
        id: "claude-sonnet-4",
        contextWindow: 100_000,
        provider: "anthropic",
      };

      const ctxInfo = resolveContextWindowInfo({
        cfg: { agents: { defaults: { contextTokens: 100_000 } } },
        provider: "anthropic",
        modelId: "claude-sonnet-4",
        modelContextWindow: model.contextWindow,
        defaultTokens: DEFAULT_CONTEXT_TOKENS,
      });

      const effectiveModel =
        ctxInfo.tokens < (model.contextWindow ?? Infinity)
          ? { ...model, contextWindow: ctxInfo.tokens }
          : model;

      // When equal, should not cap (not less than)
      expect(effectiveModel).toBe(model);
      expect(effectiveModel.contextWindow).toBe(100_000);
    });
  });

  describe("compaction threshold verification", () => {
    it("ensures compaction threshold is reachable when contextTokens < model.contextWindow", () => {
      const RESERVE_TOKENS = 40_000;
      const contextTokens = 100_000;
      const modelContextWindow = 200_000;

      // Without the fix: threshold = modelContextWindow - RESERVE_TOKENS = 160k
      // Session capped at 100k never reaches 160k → compaction never fires
      const brokenThreshold = modelContextWindow - RESERVE_TOKENS; // 160k
      expect(contextTokens).toBeLessThan(brokenThreshold); // Bug: unreachable!

      // With the fix: effectiveModel.contextWindow = contextTokens = 100k
      // threshold = 100k - 40k = 60k, which sessions can reach
      const fixedContextWindow = contextTokens;
      const fixedThreshold = fixedContextWindow - RESERVE_TOKENS; // 60k
      expect(fixedThreshold).toBeLessThan(contextTokens); // ✅ reachable
      expect(fixedThreshold).toBe(60_000);
    });

    it("verifies realistic compaction scenario", () => {
      const RESERVE_TOKENS = 40_000;
      const sessionUsage = 95_000; // Session at 95% capacity

      // User config: limit to 100k tokens
      const ctxInfo = resolveContextWindowInfo({
        cfg: { agents: { defaults: { contextTokens: 100_000 } } },
        provider: "anthropic",
        modelId: "claude-sonnet-4",
        modelContextWindow: 200_000,
        defaultTokens: DEFAULT_CONTEXT_TOKENS,
      });

      const compactionThreshold = ctxInfo.tokens - RESERVE_TOKENS;

      // With fix: threshold = 100k - 40k = 60k
      expect(compactionThreshold).toBe(60_000);
      // Session at 95k > 60k → compaction WILL trigger ✅
      expect(sessionUsage).toBeGreaterThan(compactionThreshold);
    });
  });
});
