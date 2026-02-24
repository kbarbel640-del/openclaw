import { describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { ensureOpenClawModelsJson } from "./models-config.js";
import type { ProviderConfig } from "./models-config.providers.js";

// Mock resolveImplicitProviders to return a MiniMax provider with reasoning: true
vi.mock("./models-config.providers.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("./models-config.providers.js")>();
  return {
    ...original,
    resolveImplicitProviders: async () => ({
      minimax: {
        baseUrl: "https://api.minimax.io/anthropic",
        api: "anthropic-messages",
        models: [
          {
            id: "MiniMax-M2.5",
            name: "MiniMax M2.5",
            reasoning: true, // Built-in default
            input: ["text"],
            cost: { input: 0.3, output: 1.2, cacheRead: 0.03, cacheWrite: 0.12 },
            contextWindow: 200000,
            maxTokens: 8192,
          },
        ],
      } as Record<string, ProviderConfig>,
    }),
    resolveImplicitBedrockProvider: async () => null,
    resolveImplicitCopilotProvider: async () => null,
  };
});

describe("models-config reasoning override", () => {
  it("preserves user-configured reasoning: false when merging with built-in models", async () => {
    const agentDir = `/tmp/openclaw-test-reasoning-override-${Date.now()}`;
    const config = {
      models: {
        providers: {
          minimax: {
            baseUrl: "https://api.minimax.io/anthropic",
            api: "anthropic-messages",
            apiKey: "test-key",
            models: [
              {
                id: "MiniMax-M2.5",
                name: "MiniMax M2.5",
                reasoning: false, // User wants to disable reasoning
                input: ["text"],
                cost: { input: 0.3, output: 1.2, cacheRead: 0.03, cacheWrite: 0.12 },
                contextWindow: 200000,
                maxTokens: 8192,
              },
            ],
          },
        },
      },
    } as unknown as OpenClawConfig;

    await ensureOpenClawModelsJson(config, agentDir);

    // Read the generated models.json
    const fs = await import("node:fs/promises");
    const modelsJson = JSON.parse(await fs.readFile(`${agentDir}/models.json`, "utf8"));

    const minimaxM25 = modelsJson.providers.minimax.models.find(
      (m: { id: string }) => m.id === "MiniMax-M2.5",
    );

    // User's reasoning: false should be preserved, not overridden by built-in true
    expect(minimaxM25.reasoning).toBe(false);
  });

  it("uses built-in reasoning default when user does not specify reasoning", async () => {
    const agentDir = `/tmp/openclaw-test-reasoning-default-${Date.now()}`;
    const config = {
      models: {
        providers: {
          minimax: {
            baseUrl: "https://api.minimax.io/anthropic",
            api: "anthropic-messages",
            apiKey: "test-key",
            models: [
              {
                id: "MiniMax-M2.5",
                name: "MiniMax M2.5",
                // No reasoning specified - should use built-in default
                input: ["text"],
                cost: { input: 0.3, output: 1.2, cacheRead: 0.03, cacheWrite: 0.12 },
                contextWindow: 200000,
                maxTokens: 8192,
              },
            ],
          },
        },
      },
    } as unknown as OpenClawConfig;

    await ensureOpenClawModelsJson(config, agentDir);

    const fs = await import("node:fs/promises");
    const modelsJson = JSON.parse(await fs.readFile(`${agentDir}/models.json`, "utf8"));

    const minimaxM25 = modelsJson.providers.minimax.models.find(
      (m: { id: string }) => m.id === "MiniMax-M2.5",
    );

    // Should use built-in default (true for M2.5)
    expect(minimaxM25.reasoning).toBe(true);
  });
});
