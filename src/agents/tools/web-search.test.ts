import { describe, expect, it } from "vitest";
import { createWebSearchTool, __testing } from "./web-search.js";

const { inferPerplexityBaseUrlFromApiKey, resolvePerplexityBaseUrl, normalizeFreshness } =
  __testing;

describe("web_search perplexity baseUrl defaults", () => {
  it("detects a Perplexity key prefix", () => {
    expect(inferPerplexityBaseUrlFromApiKey("pplx-123")).toBe("direct");
  });

  it("detects an OpenRouter key prefix", () => {
    expect(inferPerplexityBaseUrlFromApiKey("sk-or-v1-123")).toBe("openrouter");
  });

  it("returns undefined for unknown key formats", () => {
    expect(inferPerplexityBaseUrlFromApiKey("unknown-key")).toBeUndefined();
  });

  it("prefers explicit baseUrl over key-based defaults", () => {
    expect(resolvePerplexityBaseUrl({ baseUrl: "https://example.com" }, "config", "pplx-123")).toBe(
      "https://example.com",
    );
  });

  it("defaults to direct when using PERPLEXITY_API_KEY", () => {
    expect(resolvePerplexityBaseUrl(undefined, "perplexity_env")).toBe("https://api.perplexity.ai");
  });

  it("defaults to OpenRouter when using OPENROUTER_API_KEY", () => {
    expect(resolvePerplexityBaseUrl(undefined, "openrouter_env")).toBe(
      "https://openrouter.ai/api/v1",
    );
  });

  it("defaults to direct when config key looks like Perplexity", () => {
    expect(resolvePerplexityBaseUrl(undefined, "config", "pplx-123")).toBe(
      "https://api.perplexity.ai",
    );
  });

  it("defaults to OpenRouter when config key looks like OpenRouter", () => {
    expect(resolvePerplexityBaseUrl(undefined, "config", "sk-or-v1-123")).toBe(
      "https://openrouter.ai/api/v1",
    );
  });

  it("defaults to OpenRouter for unknown config key formats", () => {
    expect(resolvePerplexityBaseUrl(undefined, "config", "weird-key")).toBe(
      "https://openrouter.ai/api/v1",
    );
  });
});

describe("web_search freshness normalization", () => {
  it("accepts Brave shortcut values", () => {
    expect(normalizeFreshness("pd")).toBe("pd");
    expect(normalizeFreshness("PW")).toBe("pw");
  });

  it("accepts valid date ranges", () => {
    expect(normalizeFreshness("2024-01-01to2024-01-31")).toBe("2024-01-01to2024-01-31");
  });

  it("rejects invalid date ranges", () => {
    expect(normalizeFreshness("2024-13-01to2024-01-31")).toBeUndefined();
    expect(normalizeFreshness("2024-02-30to2024-03-01")).toBeUndefined();
    expect(normalizeFreshness("2024-03-10to2024-03-01")).toBeUndefined();
  });
});

describe("web_search custom provider support", () => {
  it("returns null for a non-built-in provider so plugins can provide web_search", () => {
    const tool = createWebSearchTool({
      config: {
        tools: {
          web: {
            search: {
              enabled: true,
              provider: "zhipu",
            },
          },
        },
      } as any,
    });
    expect(tool).toBeNull();
  });

  it("returns a tool for brave provider", () => {
    const tool = createWebSearchTool({
      config: {
        tools: {
          web: {
            search: {
              enabled: true,
              provider: "brave",
            },
          },
        },
      } as any,
    });
    expect(tool).not.toBeNull();
    expect(tool!.name).toBe("web_search");
  });

  it("returns a tool for perplexity provider", () => {
    const tool = createWebSearchTool({
      config: {
        tools: {
          web: {
            search: {
              enabled: true,
              provider: "perplexity",
            },
          },
        },
      } as any,
    });
    expect(tool).not.toBeNull();
    expect(tool!.name).toBe("web_search");
  });

  it("defaults to brave when no provider is set", () => {
    const tool = createWebSearchTool({
      config: {
        tools: {
          web: {
            search: {
              enabled: true,
            },
          },
        },
      } as any,
    });
    expect(tool).not.toBeNull();
    expect(tool!.name).toBe("web_search");
  });

  it("normalizes provider with leading/trailing spaces", () => {
    const tool = createWebSearchTool({
      config: {
        tools: {
          web: {
            search: {
              enabled: true,
              provider: "  BRAVE  ",
            },
          },
        },
      } as any,
    });
    expect(tool).not.toBeNull();
    expect(tool!.name).toBe("web_search");
  });

  it("normalizes provider case (Perplexity -> perplexity)", () => {
    const tool = createWebSearchTool({
      config: {
        tools: {
          web: {
            search: {
              enabled: true,
              provider: "Perplexity",
            },
          },
        },
      } as any,
    });
    expect(tool).not.toBeNull();
    expect(tool!.name).toBe("web_search");
  });

  it("returns null for a typo provider (no silent fallback to brave)", () => {
    const tool = createWebSearchTool({
      config: {
        tools: {
          web: {
            search: {
              enabled: true,
              provider: "brvae",
            },
          },
        },
      } as any,
    });
    expect(tool).toBeNull();
  });

  it("treats whitespace-only provider as empty (defaults to brave)", () => {
    const tool = createWebSearchTool({
      config: {
        tools: {
          web: {
            search: {
              enabled: true,
              provider: "   ",
            },
          },
        },
      } as any,
    });
    expect(tool).not.toBeNull();
    expect(tool!.name).toBe("web_search");
  });
});
