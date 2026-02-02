import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { FetchFn } from "./local-provider-discovery.js";
import {
  discoverLocalOllama,
  discoverLocalLmStudio,
  inferOllamaContextWindow,
  isOllamaReachable,
} from "./local-provider-discovery.js";

// Enable local discovery in tests
beforeEach(() => {
  process.env.CLAWDBOT_TEST_LOCAL_DISCOVERY = "1";
});

afterEach(() => {
  delete process.env.CLAWDBOT_TEST_LOCAL_DISCOVERY;
});

describe("inferOllamaContextWindow", () => {
  it("returns 8192 for llama3 models", () => {
    expect(inferOllamaContextWindow("llama3:chat")).toBe(8192);
    expect(inferOllamaContextWindow("llama3:8b")).toBe(8192);
    expect(inferOllamaContextWindow("llama-3.1")).toBe(8192);
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

  it("returns 8192 for qwen models", () => {
    expect(inferOllamaContextWindow("qwen2:7b")).toBe(8192);
  });

  it("returns 32768 for large qwen models", () => {
    expect(inferOllamaContextWindow("qwen2:72b")).toBe(32768);
    expect(inferOllamaContextWindow("qwen:110b")).toBe(32768);
  });

  it("returns 16384 for codellama models", () => {
    expect(inferOllamaContextWindow("codellama:13b")).toBe(16384);
  });

  it("returns 4096 for phi models", () => {
    expect(inferOllamaContextWindow("phi3:mini")).toBe(4096);
  });

  it("returns 8192 for unknown models", () => {
    expect(inferOllamaContextWindow("unknown-model")).toBe(8192);
  });
});

describe("discoverLocalOllama", () => {
  const mockFetch = vi.fn() as unknown as FetchFn;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns provider config with models when Ollama responds", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        models: [
          { name: "llama3:chat", size: 4000000000 },
          { name: "mistral:latest", size: 5000000000 },
        ],
      }),
    };
    (mockFetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const result = await discoverLocalOllama("http://127.0.0.1:11434", 3000, mockFetch);

    expect(result).not.toBeNull();
    expect(result?.baseUrl).toBe("http://127.0.0.1:11434/v1");
    expect(result?.api).toBe("openai-completions");
    expect(result?.models).toHaveLength(2);
    expect(result?.models?.[0]?.id).toBe("llama3:chat");
    expect(result?.models?.[0]?.contextWindow).toBe(8192);
    expect(result?.models?.[1]?.id).toBe("mistral:latest");
    expect(result?.models?.[1]?.contextWindow).toBe(32768);
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
    const mockResponse = {
      ok: true,
      json: async () => ({
        models: [
          { name: "deepseek-r1:7b" },
          { name: "reasoning-model:latest" },
          { name: "llama3:chat" },
        ],
      }),
    };
    (mockFetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const result = await discoverLocalOllama("http://127.0.0.1:11434", 3000, mockFetch);

    expect(result?.models?.[0]?.reasoning).toBe(true);
    expect(result?.models?.[1]?.reasoning).toBe(true);
    expect(result?.models?.[2]?.reasoning).toBe(false);
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
