import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { FetchFn } from "./local-provider-discovery.js";
import {
  discoverLocalOllama,
  discoverLocalLmStudio,
  getOllamaModelContextWindow,
  inferOllamaContextWindow,
  isOllamaReachable,
  MINIMUM_CONTEXT_WINDOW,
} from "./local-provider-discovery.js";

// Enable local discovery in tests
beforeEach(() => {
  process.env.CLAWDBOT_TEST_LOCAL_DISCOVERY = "1";
});

afterEach(() => {
  delete process.env.CLAWDBOT_TEST_LOCAL_DISCOVERY;
});

describe("inferOllamaContextWindow", () => {
  // INVARIANT: All context windows must be >= MINIMUM_CONTEXT_WINDOW (16000)
  it("returns >= 16000 for llama3 models (minimum requirement)", () => {
    expect(inferOllamaContextWindow("llama3:chat")).toBeGreaterThanOrEqual(MINIMUM_CONTEXT_WINDOW);
    expect(inferOllamaContextWindow("llama3:8b")).toBeGreaterThanOrEqual(MINIMUM_CONTEXT_WINDOW);
    expect(inferOllamaContextWindow("llama-3.1")).toBeGreaterThanOrEqual(MINIMUM_CONTEXT_WINDOW);
  });

  it("returns 32768 for standard llama3 models", () => {
    expect(inferOllamaContextWindow("llama3:chat")).toBe(32768);
    expect(inferOllamaContextWindow("llama3:8b")).toBe(32768);
    expect(inferOllamaContextWindow("llama-3.1")).toBe(32768);
  });

  it("returns 32768 for llama3 32k variant", () => {
    expect(inferOllamaContextWindow("llama3.1:32k")).toBe(32768);
  });

  it("returns 128000 for large llama3 models", () => {
    expect(inferOllamaContextWindow("llama3:70b")).toBe(128000);
    expect(inferOllamaContextWindow("llama3:405b")).toBe(128000);
  });

  it("returns 32768 for mistral/mixtral models", () => {
    expect(inferOllamaContextWindow("mistral")).toBe(32768);
    expect(inferOllamaContextWindow("mixtral:8x7b")).toBe(32768);
  });

  it("returns 64000 for deepseek models", () => {
    expect(inferOllamaContextWindow("deepseek-coder")).toBe(64000);
  });

  it("returns 32768 for qwen models", () => {
    expect(inferOllamaContextWindow("qwen2:7b")).toBe(32768);
  });

  it("returns 131072 for large qwen models", () => {
    expect(inferOllamaContextWindow("qwen2:72b")).toBe(131072);
    expect(inferOllamaContextWindow("qwen:110b")).toBe(131072);
  });

  it("returns 16384 for codellama models", () => {
    expect(inferOllamaContextWindow("codellama:13b")).toBe(16384);
  });

  it("returns MINIMUM_CONTEXT_WINDOW for phi models (clamped)", () => {
    // Phi native is 4096, but we clamp to minimum
    expect(inferOllamaContextWindow("phi3:mini")).toBe(MINIMUM_CONTEXT_WINDOW);
  });

  it("returns MINIMUM_CONTEXT_WINDOW for unknown models", () => {
    expect(inferOllamaContextWindow("unknown-model")).toBe(MINIMUM_CONTEXT_WINDOW);
  });

  it("never returns below MINIMUM_CONTEXT_WINDOW (16000)", () => {
    // Test various models to ensure invariant holds
    const models = [
      "llama3:chat",
      "llama3.1:8b",
      "phi3:mini",
      "unknown-model",
      "tiny-model",
      "qwen2:7b",
      "mistral",
    ];
    for (const model of models) {
      expect(inferOllamaContextWindow(model)).toBeGreaterThanOrEqual(MINIMUM_CONTEXT_WINDOW);
    }
  });
});

describe("getOllamaModelContextWindow", () => {
  const mockFetch = vi.fn() as unknown as FetchFn;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns context_length from model_info when present", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        model_info: {
          "llama.context_length": 32768,
        },
      }),
    };
    (mockFetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const result = await getOllamaModelContextWindow(
      "llama3:chat",
      "http://127.0.0.1:11434",
      3000,
      mockFetch,
    );

    expect(result).toBe(32768);
  });

  it("returns num_ctx from parameters string when present", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        parameters: "num_ctx 16384\ntemperature 0.7",
      }),
    };
    (mockFetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const result = await getOllamaModelContextWindow(
      "llama3:chat",
      "http://127.0.0.1:11434",
      3000,
      mockFetch,
    );

    expect(result).toBe(16384);
  });

  it("returns undefined when /api/show fails", async () => {
    const mockResponse = { ok: false, status: 404 };
    (mockFetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const result = await getOllamaModelContextWindow(
      "llama3:chat",
      "http://127.0.0.1:11434",
      3000,
      mockFetch,
    );

    expect(result).toBeUndefined();
  });

  it("returns undefined when response has no context info", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        modelfile: "FROM llama3",
        template: "{{ .Prompt }}",
      }),
    };
    (mockFetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const result = await getOllamaModelContextWindow(
      "llama3:chat",
      "http://127.0.0.1:11434",
      3000,
      mockFetch,
    );

    expect(result).toBeUndefined();
  });

  it("returns undefined on network error", async () => {
    (mockFetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Connection refused"));

    const result = await getOllamaModelContextWindow(
      "llama3:chat",
      "http://127.0.0.1:11434",
      3000,
      mockFetch,
    );

    expect(result).toBeUndefined();
  });
});

describe("discoverLocalOllama", () => {
  const mockFetch = vi.fn() as unknown as FetchFn;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns provider config with models when Ollama responds", async () => {
    // Mock /api/tags response
    const tagsResponse = {
      ok: true,
      json: async () => ({
        models: [
          { name: "llama3:chat", size: 4000000000 },
          { name: "mistral:latest", size: 5000000000 },
        ],
      }),
    };
    // Mock /api/show responses (no context info, so fallback to heuristics)
    const showResponse = {
      ok: true,
      json: async () => ({ modelfile: "FROM model" }),
    };

    (mockFetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(tagsResponse) // /api/tags
      .mockResolvedValueOnce(showResponse) // /api/show for llama3:chat
      .mockResolvedValueOnce(showResponse); // /api/show for mistral:latest

    const result = await discoverLocalOllama("http://127.0.0.1:11434", 3000, mockFetch);

    expect(result).not.toBeNull();
    expect(result?.baseUrl).toBe("http://127.0.0.1:11434/v1");
    expect(result?.api).toBe("openai-completions");
    expect(result?.models).toHaveLength(2);
    expect(result?.models?.[0]?.id).toBe("llama3:chat");
    // llama3 now defaults to 32768 (not 8192)
    expect(result?.models?.[0]?.contextWindow).toBe(32768);
    expect(result?.models?.[1]?.id).toBe("mistral:latest");
    expect(result?.models?.[1]?.contextWindow).toBe(32768);
  });

  it("uses actual context from /api/show when available", async () => {
    const tagsResponse = {
      ok: true,
      json: async () => ({
        models: [{ name: "llama3:chat" }],
      }),
    };
    const showResponse = {
      ok: true,
      json: async () => ({
        model_info: { "llama.context_length": 65536 },
      }),
    };

    (mockFetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(tagsResponse)
      .mockResolvedValueOnce(showResponse);

    const result = await discoverLocalOllama("http://127.0.0.1:11434", 3000, mockFetch);

    expect(result?.models?.[0]?.contextWindow).toBe(65536);
  });

  it("clamps context window to minimum when /api/show returns too small", async () => {
    const tagsResponse = {
      ok: true,
      json: async () => ({
        models: [{ name: "tiny-model" }],
      }),
    };
    // /api/show returns ctx smaller than minimum
    const showResponse = {
      ok: true,
      json: async () => ({
        model_info: { "model.context_length": 4096 },
      }),
    };

    (mockFetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(tagsResponse)
      .mockResolvedValueOnce(showResponse);

    const result = await discoverLocalOllama("http://127.0.0.1:11434", 3000, mockFetch);

    // Should be clamped to MINIMUM_CONTEXT_WINDOW
    expect(result?.models?.[0]?.contextWindow).toBeGreaterThanOrEqual(MINIMUM_CONTEXT_WINDOW);
  });

  it("returns provider config with empty models when Ollama has no models", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({ models: [] }),
    };
    (mockFetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const result = await discoverLocalOllama("http://127.0.0.1:11434", 3000, mockFetch);

    expect(result).not.toBeNull();
    expect(result?.models).toHaveLength(0);
  });

  it("returns null when Ollama is unreachable", async () => {
    (mockFetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Connection refused"));

    const result = await discoverLocalOllama("http://127.0.0.1:11434", 3000, mockFetch);

    expect(result).toBeNull();
  });

  it("returns null when Ollama returns non-200", async () => {
    const mockResponse = { ok: false, status: 500 };
    (mockFetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const result = await discoverLocalOllama("http://127.0.0.1:11434", 3000, mockFetch);

    expect(result).toBeNull();
  });

  it("marks reasoning models correctly", async () => {
    const tagsResponse = {
      ok: true,
      json: async () => ({
        models: [
          { name: "deepseek-r1:7b" },
          { name: "reasoning-model:latest" },
          { name: "llama3:chat" },
        ],
      }),
    };
    const showResponse = {
      ok: true,
      json: async () => ({ modelfile: "FROM model" }),
    };

    (mockFetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(tagsResponse)
      .mockResolvedValueOnce(showResponse)
      .mockResolvedValueOnce(showResponse)
      .mockResolvedValueOnce(showResponse);

    const result = await discoverLocalOllama("http://127.0.0.1:11434", 3000, mockFetch);

    expect(result?.models?.[0]?.reasoning).toBe(true);
    expect(result?.models?.[1]?.reasoning).toBe(true);
    expect(result?.models?.[2]?.reasoning).toBe(false);
  });

  it("all discovered models have context >= MINIMUM_CONTEXT_WINDOW", async () => {
    const tagsResponse = {
      ok: true,
      json: async () => ({
        models: [{ name: "llama3:chat" }, { name: "phi3:mini" }, { name: "unknown-tiny" }],
      }),
    };
    const showResponse = {
      ok: true,
      json: async () => ({ modelfile: "FROM model" }),
    };

    (mockFetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(tagsResponse)
      .mockResolvedValueOnce(showResponse)
      .mockResolvedValueOnce(showResponse)
      .mockResolvedValueOnce(showResponse);

    const result = await discoverLocalOllama("http://127.0.0.1:11434", 3000, mockFetch);

    // INVARIANT: All models must have ctx >= 16000
    for (const model of result?.models ?? []) {
      expect(model.contextWindow).toBeGreaterThanOrEqual(MINIMUM_CONTEXT_WINDOW);
    }
  });
});

describe("discoverLocalLmStudio", () => {
  const mockFetch = vi.fn() as unknown as FetchFn;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns provider config with models when LM Studio responds", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        data: [
          { id: "local-model-1", object: "model" },
          { id: "local-model-2", object: "model" },
        ],
      }),
    };
    (mockFetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const result = await discoverLocalLmStudio("http://127.0.0.1:1234", 3000, mockFetch);

    expect(result).not.toBeNull();
    expect(result?.baseUrl).toBe("http://127.0.0.1:1234/v1");
    expect(result?.api).toBe("openai-completions");
    expect(result?.models).toHaveLength(2);
    expect(result?.models?.[0]?.id).toBe("local-model-1");
    expect(result?.models?.[1]?.id).toBe("local-model-2");
  });

  it("returns null when LM Studio is unreachable", async () => {
    (mockFetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Connection refused"));

    const result = await discoverLocalLmStudio("http://127.0.0.1:1234", 3000, mockFetch);

    expect(result).toBeNull();
  });

  it("returns provider config with empty models when LM Studio has no models loaded", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({ data: [] }),
    };
    (mockFetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const result = await discoverLocalLmStudio("http://127.0.0.1:1234", 3000, mockFetch);

    expect(result).not.toBeNull();
    expect(result?.models).toHaveLength(0);
  });
});

describe("isOllamaReachable", () => {
  const mockFetch = vi.fn() as unknown as FetchFn;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when Ollama version endpoint responds", async () => {
    const mockResponse = { ok: true };
    (mockFetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const result = await isOllamaReachable("http://127.0.0.1:11434", 3000, mockFetch);

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://127.0.0.1:11434/api/version",
      expect.any(Object),
    );
  });

  it("returns false when Ollama is unreachable", async () => {
    (mockFetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Connection refused"));

    const result = await isOllamaReachable("http://127.0.0.1:11434", 3000, mockFetch);

    expect(result).toBe(false);
  });

  it("returns false when Ollama returns non-200", async () => {
    const mockResponse = { ok: false };
    (mockFetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const result = await isOllamaReachable("http://127.0.0.1:11434", 3000, mockFetch);

    expect(result).toBe(false);
  });
});
