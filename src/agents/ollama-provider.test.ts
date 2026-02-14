import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createOllamaProvider, resolveOllamaConfig, resolveOllamaBaseUrl } from "./ollama-provider.js";
import { OLLAMA_NATIVE_BASE_URL } from "./ollama-stream.js";

// Mock ollamaFetch for health checks
vi.mock("./ollama-retry.js", () => ({
  ollamaFetch: vi.fn(),
}));

// Mock createOllamaStreamFn so we don't need real Ollama
vi.mock("./ollama-stream.js", async () => {
  const actual = await vi.importActual<typeof import("./ollama-stream.js")>("./ollama-stream.js");
  return {
    ...actual,
    createOllamaStreamFn: vi.fn(() => vi.fn()),
  };
});

import { ollamaFetch } from "./ollama-retry.js";

const mockedOllamaFetch = vi.mocked(ollamaFetch);

describe("resolveOllamaConfig", () => {
  const origEnv = process.env.OLLAMA_HOST;

  afterEach(() => {
    if (origEnv === undefined) {
      delete process.env.OLLAMA_HOST;
    } else {
      process.env.OLLAMA_HOST = origEnv;
    }
  });

  it("returns defaults when no config or env", () => {
    delete process.env.OLLAMA_HOST;
    const cfg = resolveOllamaConfig();
    expect(cfg.baseUrl).toBeUndefined();
  });

  it("respects OLLAMA_HOST env var", () => {
    process.env.OLLAMA_HOST = "http://myhost:11434";
    const cfg = resolveOllamaConfig();
    expect(cfg.baseUrl).toBe("http://myhost:11434");
  });

  it("respects custom baseUrl from user config", () => {
    delete process.env.OLLAMA_HOST;
    const cfg = resolveOllamaConfig({ ollama: { baseUrl: "http://custom:1234" } });
    expect(cfg.baseUrl).toBe("http://custom:1234");
  });

  it("user config takes priority over env", () => {
    process.env.OLLAMA_HOST = "http://envhost:11434";
    const cfg = resolveOllamaConfig({ ollama: { baseUrl: "http://custom:1234" } });
    expect(cfg.baseUrl).toBe("http://custom:1234");
  });
});

describe("resolveOllamaBaseUrl", () => {
  it("returns model baseUrl first", () => {
    expect(resolveOllamaBaseUrl("http://model:1234", "http://provider:5678")).toBe("http://model:1234");
  });

  it("falls back to provider baseUrl", () => {
    expect(resolveOllamaBaseUrl("", "http://provider:5678")).toBe("http://provider:5678");
  });

  it("falls back to default", () => {
    expect(resolveOllamaBaseUrl("", "")).toBe(OLLAMA_NATIVE_BASE_URL);
  });
});

describe("createOllamaProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates provider with default config", () => {
    const provider = createOllamaProvider();
    expect(provider.streamFn).toBeDefined();
    expect(typeof provider.streamFn).toBe("function");
    expect(typeof provider.checkHealth).toBe("function");
  });

  it("creates provider with custom baseUrl", () => {
    const provider = createOllamaProvider({ baseUrl: "http://custom:1234" });
    expect(provider.streamFn).toBeDefined();
  });

  it("checkHealth returns true when Ollama is up", async () => {
    mockedOllamaFetch.mockResolvedValueOnce({ ok: true } as Response);
    const provider = createOllamaProvider();
    expect(await provider.checkHealth()).toBe(true);
  });

  it("checkHealth returns false when Ollama is down", async () => {
    mockedOllamaFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const provider = createOllamaProvider();
    expect(await provider.checkHealth()).toBe(false);
  });

  it("streamFn is callable", () => {
    const provider = createOllamaProvider();
    // streamFn is mocked, just verify it's a function
    expect(typeof provider.streamFn).toBe("function");
  });
});
