import { afterEach, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../config/config.js";

const createEmbeddingProviderMock = vi.hoisted(() => vi.fn());

vi.mock("../memory/embeddings.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../memory/embeddings.js")>();
  return {
    ...actual,
    createEmbeddingProvider: createEmbeddingProviderMock,
  };
});

import {
  createPluginMemoryEmbeddingAdapter,
  defaultMemoryEmbeddingApiKeyEnvVar,
  defaultMemoryEmbeddingModel,
  resolveMemoryEmbeddingModel,
} from "./memory-embeddings.js";

describe("plugin memory embedding adapter", () => {
  afterEach(() => {
    createEmbeddingProviderMock.mockReset();
  });

  it.each(["openai", "gemini", "voyage", "mistral", "local"] as const)(
    "resolves default model for %s",
    (provider) => {
      expect(defaultMemoryEmbeddingModel(provider)).not.toHaveLength(0);
      expect(resolveMemoryEmbeddingModel(provider)).toBe(defaultMemoryEmbeddingModel(provider));
      expect(resolveMemoryEmbeddingModel(provider, " custom-model ")).toBe("custom-model");
    },
  );

  it("maps provider api key env vars to core conventions", () => {
    expect(defaultMemoryEmbeddingApiKeyEnvVar("openai")).toBe("OPENAI_API_KEY");
    expect(defaultMemoryEmbeddingApiKeyEnvVar("gemini")).toBe("GEMINI_API_KEY");
    expect(defaultMemoryEmbeddingApiKeyEnvVar("voyage")).toBe("VOYAGE_API_KEY");
    expect(defaultMemoryEmbeddingApiKeyEnvVar("mistral")).toBe("MISTRAL_API_KEY");
  });

  it("passes normalized remote config through to createEmbeddingProvider", async () => {
    const embedQuery = vi.fn(async (_text: string) => [0.1, 0.2, 0.3]);
    const embedBatch = vi.fn(async (texts: string[]) =>
      texts.map((_text, index) => [index + 1, 0.2, 0.3]),
    );
    createEmbeddingProviderMock.mockResolvedValue({
      requestedProvider: "openai",
      provider: {
        id: "openai",
        model: "text-embedding-3-small",
        embedQuery,
        embedBatch,
      },
    });

    const config = {} as OpenClawConfig;
    const adapter = await createPluginMemoryEmbeddingAdapter({
      config,
      agentDir: "/tmp/agent",
      embedding: {
        provider: "openai",
        model: " text-embedding-3-small ",
        apiKey: " test-openai-key ",
        baseUrl: " https://api.example.com/v1 ",
        headers: { "x-test-header": "enabled" },
      },
    });

    expect(createEmbeddingProviderMock).toHaveBeenCalledTimes(1);
    expect(createEmbeddingProviderMock).toHaveBeenCalledWith({
      config,
      agentDir: "/tmp/agent",
      provider: "openai",
      model: "text-embedding-3-small",
      fallback: "none",
      remote: {
        apiKey: "test-openai-key",
        baseUrl: "https://api.example.com/v1",
        headers: { "x-test-header": "enabled" },
      },
      local: undefined,
    });
    expect(adapter.provider).toBe("openai");
    expect(adapter.model).toBe("text-embedding-3-small");
    await adapter.embed("hello");
    await adapter.embedBatch(["a", "b"]);
    expect(embedQuery).toHaveBeenCalledWith("hello");
    expect(embedBatch).toHaveBeenCalledWith(["a", "b"]);
  });

  it("passes local model options without remote overrides", async () => {
    createEmbeddingProviderMock.mockResolvedValue({
      requestedProvider: "local",
      provider: {
        id: "local",
        model: "/models/embedding.gguf",
        embedQuery: async (_text: string) => [0.1],
        embedBatch: async (texts: string[]) => texts.map(() => [0.1]),
      },
    });

    await createPluginMemoryEmbeddingAdapter({
      config: {} as OpenClawConfig,
      embedding: {
        provider: "local",
        local: {
          modelPath: "/models/embedding.gguf",
          modelCacheDir: "/models/cache",
        },
      },
    });

    expect(createEmbeddingProviderMock).toHaveBeenCalledTimes(1);
    expect(createEmbeddingProviderMock).toHaveBeenCalledWith({
      config: {},
      agentDir: undefined,
      provider: "local",
      model: defaultMemoryEmbeddingModel("local"),
      fallback: "none",
      remote: undefined,
      local: {
        modelPath: "/models/embedding.gguf",
        modelCacheDir: "/models/cache",
      },
    });
  });

  it("returns provider-specific setup hints when auth is unavailable", async () => {
    createEmbeddingProviderMock.mockResolvedValue({
      requestedProvider: "gemini",
      provider: null,
      providerUnavailableReason: 'No API key found for provider "gemini".',
    });

    await expect(
      createPluginMemoryEmbeddingAdapter({
        config: {} as OpenClawConfig,
        embedding: { provider: "gemini" },
      }),
    ).rejects.toThrow(
      "Set GEMINI_API_KEY (or models.providers.google.apiKey), or provide embedding.apiKey in plugin config.",
    );
  });

  it("surfaces local provider setup failures without remote auth hints", async () => {
    createEmbeddingProviderMock.mockResolvedValue({
      requestedProvider: "local",
      provider: null,
      providerUnavailableReason: "Local embeddings unavailable.",
    });

    await expect(
      createPluginMemoryEmbeddingAdapter({
        config: {} as OpenClawConfig,
        embedding: { provider: "local" },
      }),
    ).rejects.toThrow("Local embeddings unavailable.");
  });

  it("rejects unsupported providers before calling embedding factory", async () => {
    await expect(
      createPluginMemoryEmbeddingAdapter({
        config: {} as OpenClawConfig,
        embedding: {
          provider: "invalid-provider" as unknown as "openai",
        },
      }),
    ).rejects.toThrow("Unsupported embedding provider: invalid-provider");
    expect(createEmbeddingProviderMock).not.toHaveBeenCalled();
  });
});
