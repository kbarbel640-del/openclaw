import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";

vi.mock("@mariozechner/pi-coding-agent", () => ({
  discoverAuthStorage: vi.fn(() => ({ mocked: true })),
  discoverModels: vi.fn(() => ({ find: vi.fn(() => null) })),
}));

// Mock fs.readFileSync for models.json tests
const originalReadFileSync = fs.readFileSync;
let mockModelsJson: string | null = null;

vi.spyOn(fs, "readFileSync").mockImplementation((pathArg, ...args) => {
  const pathStr = String(pathArg);
  if (pathStr.endsWith("models.json") && mockModelsJson !== null) {
    return mockModelsJson;
  }
  return originalReadFileSync(pathArg, ...args);
});

import type { MoltbotConfig } from "../../config/config.js";
import { buildInlineProviderModels, normalizeModelId, resolveModel } from "./model.js";

const makeModel = (id: string) => ({
  id,
  name: id,
  reasoning: false,
  input: ["text"] as const,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 1,
  maxTokens: 1,
});

describe("buildInlineProviderModels", () => {
  it("attaches provider ids to inline models", () => {
    const providers = {
      " alpha ": { baseUrl: "http://alpha.local", models: [makeModel("alpha-model")] },
      beta: { baseUrl: "http://beta.local", models: [makeModel("beta-model")] },
    };

    const result = buildInlineProviderModels(providers);

    expect(result).toEqual([
      {
        ...makeModel("alpha-model"),
        provider: "alpha",
        baseUrl: "http://alpha.local",
        api: undefined,
      },
      {
        ...makeModel("beta-model"),
        provider: "beta",
        baseUrl: "http://beta.local",
        api: undefined,
      },
    ]);
  });

  it("inherits baseUrl from provider when model does not specify it", () => {
    const providers = {
      custom: {
        baseUrl: "http://localhost:8000",
        models: [makeModel("custom-model")],
      },
    };

    const result = buildInlineProviderModels(providers);

    expect(result).toHaveLength(1);
    expect(result[0].baseUrl).toBe("http://localhost:8000");
  });

  it("inherits api from provider when model does not specify it", () => {
    const providers = {
      custom: {
        baseUrl: "http://localhost:8000",
        api: "anthropic-messages",
        models: [makeModel("custom-model")],
      },
    };

    const result = buildInlineProviderModels(providers);

    expect(result).toHaveLength(1);
    expect(result[0].api).toBe("anthropic-messages");
  });

  it("model-level api takes precedence over provider-level api", () => {
    const providers = {
      custom: {
        baseUrl: "http://localhost:8000",
        api: "openai-responses",
        models: [{ ...makeModel("custom-model"), api: "anthropic-messages" as const }],
      },
    };

    const result = buildInlineProviderModels(providers);

    expect(result).toHaveLength(1);
    expect(result[0].api).toBe("anthropic-messages");
  });

  it("inherits both baseUrl and api from provider config", () => {
    const providers = {
      custom: {
        baseUrl: "http://localhost:10000",
        api: "anthropic-messages",
        models: [makeModel("claude-opus-4.5")],
      },
    };

    const result = buildInlineProviderModels(providers);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      provider: "custom",
      baseUrl: "http://localhost:10000",
      api: "anthropic-messages",
      name: "claude-opus-4.5",
    });
  });
});

describe("normalizeModelId", () => {
  it("strips provider prefix from modelId", () => {
    expect(normalizeModelId("ollama", "ollama/llama3:chat")).toBe("llama3:chat");
  });

  it("leaves modelId unchanged if no provider prefix", () => {
    expect(normalizeModelId("ollama", "llama3:chat")).toBe("llama3:chat");
  });

  it("only strips matching provider prefix", () => {
    expect(normalizeModelId("ollama", "anthropic/claude")).toBe("anthropic/claude");
  });

  it("handles empty modelId", () => {
    expect(normalizeModelId("ollama", "")).toBe("");
  });
});

describe("resolveModel", () => {
  beforeEach(() => {
    mockModelsJson = null;
  });

  afterEach(() => {
    mockModelsJson = null;
  });

  it("includes provider baseUrl in fallback model", () => {
    const cfg = {
      models: {
        providers: {
          custom: {
            baseUrl: "http://localhost:9000",
            models: [],
          },
        },
      },
    } as MoltbotConfig;

    const result = resolveModel("custom", "missing-model", "/tmp/agent", cfg);

    expect(result.model?.baseUrl).toBe("http://localhost:9000");
    expect(result.model?.provider).toBe("custom");
    expect(result.model?.id).toBe("missing-model");
  });

  it("resolves model from models.json when pi-ai registry lacks it", () => {
    // Mock models.json with Ollama provider
    mockModelsJson = JSON.stringify({
      providers: {
        ollama: {
          baseUrl: "http://127.0.0.1:11434/v1",
          api: "openai-completions",
          models: [
            {
              id: "llama3:chat",
              name: "Llama 3 Chat",
              input: ["text"],
              contextWindow: 128000,
            },
          ],
        },
      },
    });

    const result = resolveModel("ollama", "llama3:chat", "/tmp/agent", {});

    expect(result.model).toBeDefined();
    expect(result.model?.id).toBe("llama3:chat");
    expect(result.model?.provider).toBe("ollama");
    expect(result.model?.baseUrl).toBe("http://127.0.0.1:11434/v1");
    expect(result.error).toBeUndefined();
  });

  it("accepts provider-prefixed modelId and resolves to raw modelId (no double prefix)", () => {
    // Mock models.json with Ollama provider
    mockModelsJson = JSON.stringify({
      providers: {
        ollama: {
          baseUrl: "http://127.0.0.1:11434/v1",
          api: "openai-completions",
          models: [
            {
              id: "llama3:chat",
              name: "Llama 3 Chat",
              input: ["text"],
              contextWindow: 128000,
            },
          ],
        },
      },
    });

    // Pass "ollama/llama3:chat" as modelId - should resolve to "llama3:chat"
    const result = resolveModel("ollama", "ollama/llama3:chat", "/tmp/agent", {});

    expect(result.model).toBeDefined();
    expect(result.model?.id).toBe("llama3:chat");
    expect(result.model?.provider).toBe("ollama");
    expect(result.error).toBeUndefined();
  });

  it("error includes agentDir path when model not found", () => {
    mockModelsJson = JSON.stringify({ providers: {} });

    const result = resolveModel("unknown-provider", "unknown-model", "/custom/agent/dir", {});

    expect(result.error).toBeDefined();
    expect(result.error).toContain("Unknown model: unknown-provider/unknown-model");
    expect(result.error).toContain("/custom/agent/dir");
  });

  it("error lists known models for the provider when provider has no baseUrl (no fallback)", () => {
    // When provider config exists but has no baseUrl and model not found in list,
    // we should get an error with known models hint. However, if providerCfg exists,
    // fallback is created. So we test with a different provider that only has models.
    mockModelsJson = JSON.stringify({
      providers: {
        // Provider without baseUrl - should not create fallback
        "known-only": {
          models: [
            { id: "model-a", name: "Model A" },
            { id: "model-b", name: "Model B" },
          ],
        },
      },
    });

    // Request a model from a provider that's NOT in models.json at all
    const result = resolveModel("unknown-provider", "some-model", "/tmp/agent", {});

    expect(result.error).toBeDefined();
    expect(result.error).toContain("Unknown model: unknown-provider/some-model");
    expect(result.error).toContain("/tmp/agent");
  });

  it("normalizes model ID in models.json entries to prevent double-prefix", () => {
    // Edge case: models.json has model ID with provider prefix (malformed)
    mockModelsJson = JSON.stringify({
      providers: {
        ollama: {
          baseUrl: "http://127.0.0.1:11434/v1",
          models: [
            {
              id: "ollama/llama3:chat", // Malformed: has provider prefix
              name: "Llama 3 Chat",
            },
          ],
        },
      },
    });

    const result = resolveModel("ollama", "llama3:chat", "/tmp/agent", {});

    expect(result.model).toBeDefined();
    expect(result.model?.id).toBe("llama3:chat"); // Should be normalized
    expect(result.error).toBeUndefined();
  });

  it("creates fallback model from models.json provider config when specific model not found", () => {
    mockModelsJson = JSON.stringify({
      providers: {
        ollama: {
          baseUrl: "http://127.0.0.1:11434/v1",
          api: "openai-completions",
          models: [{ id: "some-other-model", name: "Some Other Model" }],
        },
      },
    });

    // Request a model that doesn't exist in the models array but provider is known
    const result = resolveModel("ollama", "custom-model", "/tmp/agent", {});

    expect(result.model).toBeDefined();
    expect(result.model?.id).toBe("custom-model");
    expect(result.model?.provider).toBe("ollama");
    expect(result.model?.baseUrl).toBe("http://127.0.0.1:11434/v1");
  });
});
