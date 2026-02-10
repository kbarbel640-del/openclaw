import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __testing } from "./web-search.js";

const {
  inferPerplexityBaseUrlFromApiKey,
  resolvePerplexityBaseUrl,
  isDirectPerplexityBaseUrl,
  resolvePerplexityRequestModel,
  normalizeFreshness,
  resolveGrokApiKey,
  resolveGrokModel,
  runGrokSearch,
  runBraveSearch,
  performProviderSearch,
  resolveTavilyConfig,
  resolveTavilyApiKey,
  resolveTavilySearchDepth,
  runTavilySearch,
  freshnessToTavilyTimeParams,
  buildSearchCacheKey,
} = __testing;

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

describe("web_search perplexity model normalization", () => {
  it("detects direct Perplexity host", () => {
    expect(isDirectPerplexityBaseUrl("https://api.perplexity.ai")).toBe(true);
    expect(isDirectPerplexityBaseUrl("https://api.perplexity.ai/")).toBe(true);
    expect(isDirectPerplexityBaseUrl("https://openrouter.ai/api/v1")).toBe(false);
  });

  it("strips provider prefix for direct Perplexity", () => {
    expect(resolvePerplexityRequestModel("https://api.perplexity.ai", "perplexity/sonar-pro")).toBe(
      "sonar-pro",
    );
  });

  it("keeps prefixed model for OpenRouter", () => {
    expect(
      resolvePerplexityRequestModel("https://openrouter.ai/api/v1", "perplexity/sonar-pro"),
    ).toBe("perplexity/sonar-pro");
  });

  it("keeps model unchanged when URL is invalid", () => {
    expect(resolvePerplexityRequestModel("not-a-url", "perplexity/sonar-pro")).toBe(
      "perplexity/sonar-pro",
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

describe("web_search grok config resolution", () => {
  it("uses config apiKey when provided", () => {
    expect(resolveGrokApiKey({ apiKey: "xai-test-key" })).toBe("xai-test-key");
  });

  it("returns undefined when no apiKey is available", () => {
    const previous = process.env.XAI_API_KEY;
    try {
      delete process.env.XAI_API_KEY;
      expect(resolveGrokApiKey({})).toBeUndefined();
      expect(resolveGrokApiKey(undefined)).toBeUndefined();
    } finally {
      if (previous === undefined) {
        delete process.env.XAI_API_KEY;
      } else {
        process.env.XAI_API_KEY = previous;
      }
    }
  });

  it("uses default model when not specified", () => {
    expect(resolveGrokModel({})).toBe("grok-4-1-fast-reasoning");
    expect(resolveGrokModel(undefined)).toBe("grok-4-1-fast-reasoning");
  });

  it("uses config model when provided", () => {
    expect(resolveGrokModel({ model: "grok-3" })).toBe("grok-3");
  });
});

type GrokFixture = {
  description: string;
  response: Record<string, unknown>;
  expect: {
    contentsLength: number;
    contentsContains?: string[];
    citationsLength: number;
    citationUrls?: string[];
  };
};

const FIXTURES_DIR = path.resolve(import.meta.dirname, "__fixtures__/grok");

function loadGrokFixtures(): { name: string; fixture: GrokFixture }[] {
  const files = fs.readdirSync(FIXTURES_DIR).filter((f) => f.endsWith(".json"));
  return files.map((file) => {
    const raw = fs.readFileSync(path.join(FIXTURES_DIR, file), "utf-8");
    return { name: file.replace(/\.json$/, ""), fixture: JSON.parse(raw) as GrokFixture };
  });
}

describe("running grok web searches (fixtures)", () => {
  const mockFetch = vi.fn();
  const defaultParams = {
    query: "test query",
    apiKey: "xai-test-key",
    model: "grok-4-1-fast-reasoning",
    timeoutSeconds: 30,
  };

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const fixtures = loadGrokFixtures();

  for (const { name, fixture } of fixtures) {
    describe(`fixture: ${name}`, () => {
      it(fixture.description, async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => fixture.response,
        });

        const result = await runGrokSearch(defaultParams);

        expect(result.contents).toHaveLength(fixture.expect.contentsLength);
        expect(result.citations).toHaveLength(fixture.expect.citationsLength);

        if (fixture.expect.contentsContains) {
          for (const substring of fixture.expect.contentsContains) {
            const found = result.contents.some((c) => c.includes(substring));
            expect(found, `expected some content to contain "${substring}"`).toBe(true);
          }
        }

        if (fixture.expect.citationUrls) {
          for (const expectedUrl of fixture.expect.citationUrls) {
            const found = result.citations.some((c) => c.url.includes(expectedUrl));
            expect(found, `expected some citation url to contain "${expectedUrl}"`).toBe(true);
          }
        }
      });
    });
  }
});

describe("runGrokSearch (error handling)", () => {
  const mockFetch = vi.fn();
  const defaultParams = {
    query: "test query",
    apiKey: "xai-test-key",
    model: "grok-4-1-fast-reasoning",
    timeoutSeconds: 30,
  };

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      text: async () => "rate limited",
    });

    await expect(runGrokSearch(defaultParams)).rejects.toThrow("xAI API error (429)");
  });
});

describe("web_search tavily config resolution", () => {
  it("uses config apiKey when provided", () => {
    expect(resolveTavilyApiKey({ apiKey: "tvly-test-key" })).toBe("tvly-test-key");
  });

  it("falls back to TAVILY_API_KEY env var", () => {
    const previous = process.env.TAVILY_API_KEY;
    try {
      process.env.TAVILY_API_KEY = "tvly-from-env";
      expect(resolveTavilyApiKey({})).toBe("tvly-from-env");
    } finally {
      if (previous === undefined) {
        delete process.env.TAVILY_API_KEY;
      } else {
        process.env.TAVILY_API_KEY = previous;
      }
    }
  });

  it("returns undefined when no apiKey is available", () => {
    const previous = process.env.TAVILY_API_KEY;
    try {
      delete process.env.TAVILY_API_KEY;
      expect(resolveTavilyApiKey({})).toBeUndefined();
      expect(resolveTavilyApiKey(undefined)).toBeUndefined();
    } finally {
      if (previous === undefined) {
        delete process.env.TAVILY_API_KEY;
      } else {
        process.env.TAVILY_API_KEY = previous;
      }
    }
  });
});

describe("resolveTavilySearchDepth", () => {
  it("defaults to advanced when not configured", () => {
    expect(resolveTavilySearchDepth({})).toBe("advanced");
    expect(resolveTavilySearchDepth(undefined)).toBe("advanced");
  });

  it("accepts valid search depth values", () => {
    expect(resolveTavilySearchDepth({ searchDepth: "basic" })).toBe("basic");
    expect(resolveTavilySearchDepth({ searchDepth: "advanced" })).toBe("advanced");
    expect(resolveTavilySearchDepth({ searchDepth: "fast" })).toBe("fast");
    expect(resolveTavilySearchDepth({ searchDepth: "ultra-fast" })).toBe("ultra-fast");
  });

  it("is case-insensitive", () => {
    expect(resolveTavilySearchDepth({ searchDepth: "BASIC" })).toBe("basic");
    expect(resolveTavilySearchDepth({ searchDepth: "Advanced" })).toBe("advanced");
  });

  it("falls back to advanced for invalid values", () => {
    expect(resolveTavilySearchDepth({ searchDepth: "invalid" })).toBe("advanced");
    expect(resolveTavilySearchDepth({ searchDepth: "" })).toBe("advanced");
  });
});

describe("freshnessToTavilyTimeParams", () => {
  it("maps pd to day", () => {
    expect(freshnessToTavilyTimeParams("pd")).toEqual({ time_range: "day" });
  });

  it("maps pw to week", () => {
    expect(freshnessToTavilyTimeParams("pw")).toEqual({ time_range: "week" });
  });

  it("maps pm to month", () => {
    expect(freshnessToTavilyTimeParams("pm")).toEqual({ time_range: "month" });
  });

  it("maps py to year", () => {
    expect(freshnessToTavilyTimeParams("py")).toEqual({ time_range: "year" });
  });

  it("splits date ranges into start_date and end_date", () => {
    expect(freshnessToTavilyTimeParams("2024-01-01to2024-03-01")).toEqual({
      start_date: "2024-01-01",
      end_date: "2024-03-01",
    });
  });

  it("returns empty object for undefined", () => {
    expect(freshnessToTavilyTimeParams(undefined)).toEqual({});
  });

  it("returns empty object for unrecognized values", () => {
    expect(freshnessToTavilyTimeParams("unknown")).toEqual({});
  });
});

type TavilyFixture = {
  description: string;
  response: Record<string, unknown>;
  expect: {
    resultsLength: number;
    firstTitle?: string;
    firstUrl?: string;
    firstScore?: number;
  };
};

const TAVILY_FIXTURES_DIR = path.resolve(import.meta.dirname, "__fixtures__/tavily");

function loadTavilyFixtures(): { name: string; fixture: TavilyFixture }[] {
  const files = fs.readdirSync(TAVILY_FIXTURES_DIR).filter((f) => f.endsWith(".json"));
  return files.map((file) => {
    const raw = fs.readFileSync(path.join(TAVILY_FIXTURES_DIR, file), "utf-8");
    return { name: file.replace(/\.json$/, ""), fixture: JSON.parse(raw) as TavilyFixture };
  });
}

describe("running tavily web searches (fixtures)", () => {
  const mockFetch = vi.fn();
  const defaultParams = {
    query: "test query",
    apiKey: "tvly-test-key",
    count: 5,
    timeoutSeconds: 30,
  };

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const fixtures = loadTavilyFixtures();

  for (const { name, fixture } of fixtures) {
    describe(`fixture: ${name}`, () => {
      it(fixture.description, async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => fixture.response,
        });

        const results = await runTavilySearch(defaultParams);

        expect(results).toHaveLength(fixture.expect.resultsLength);

        if (fixture.expect.firstTitle && results.length > 0) {
          expect(results[0].title).toContain(fixture.expect.firstTitle);
        }

        if (fixture.expect.firstUrl && results.length > 0) {
          expect(results[0].url).toBe(fixture.expect.firstUrl);
        }

        if (fixture.expect.firstScore !== undefined && results.length > 0) {
          expect(results[0].score).toBe(fixture.expect.firstScore);
        }
      });
    });
  }

  it("sends correct request body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [] }),
    });

    await runTavilySearch({ ...defaultParams, freshness: "pw" });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.tavily.com/search");
    const body = JSON.parse(options.body);
    expect(body.query).toBe("test query");
    expect(body.search_depth).toBe("advanced");
    expect(body.topic).toBe("general");
    expect(body.max_results).toBe(5);
    expect(body.time_range).toBe("week");
  });

  it("passes configured searchDepth to request body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [] }),
    });

    await runTavilySearch({ ...defaultParams, searchDepth: "basic" });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.search_depth).toBe("basic");
  });
});

describe("runTavilySearch (error handling)", () => {
  const mockFetch = vi.fn();
  const defaultParams = {
    query: "test query",
    apiKey: "tvly-test-key",
    count: 5,
    timeoutSeconds: 30,
  };

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: async () => "invalid api key",
    });

    await expect(runTavilySearch(defaultParams)).rejects.toThrow("Tavily API error (401)");
  });
});

describe("resolveTavilyConfig", () => {
  it("returns empty object when search config is undefined", () => {
    expect(resolveTavilyConfig(undefined)).toEqual({});
  });

  it("returns empty object when search config has no tavily key", () => {
    expect(resolveTavilyConfig({ enabled: true } as never)).toEqual({});
  });

  it("returns empty object when tavily is not an object", () => {
    expect(resolveTavilyConfig({ tavily: "invalid" } as never)).toEqual({});
  });

  it("returns tavily config when present", () => {
    const config = { tavily: { apiKey: "tvly-key", searchDepth: "basic" } } as never;
    expect(resolveTavilyConfig(config)).toEqual({ apiKey: "tvly-key", searchDepth: "basic" });
  });
});

describe("runTavilySearch (authorization header)", () => {
  const mockFetch = vi.fn();
  const defaultParams = {
    query: "test query",
    apiKey: "tvly-secret-key",
    count: 5,
    timeoutSeconds: 30,
  };

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends Bearer authorization header", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [] }),
    });

    await runTavilySearch(defaultParams);

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers.Authorization).toBe("Bearer tvly-secret-key");
  });
});

describe("runTavilySearch (wrapWebContent)", () => {
  const mockFetch = vi.fn();
  const defaultParams = {
    query: "test query",
    apiKey: "tvly-test-key",
    count: 5,
    timeoutSeconds: 30,
  };

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("wraps title and content with web_search markers but keeps URL raw", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          {
            title: "Test Title",
            url: "https://example.com",
            content: "Test content body",
            score: 0.9,
          },
        ],
      }),
    });

    const results = await runTavilySearch(defaultParams);
    expect(results).toHaveLength(1);

    // Title and description should be wrapped (contain web_search markers)
    expect(results[0].title).toContain("Test Title");
    expect(results[0].title).not.toBe("Test Title");

    expect(results[0].description).toContain("Test content body");
    expect(results[0].description).not.toBe("Test content body");

    // URL should be raw, not wrapped
    expect(results[0].url).toBe("https://example.com");
  });
});

describe("buildSearchCacheKey", () => {
  const baseParams = { query: "test query", count: 5 } as const;

  describe("brave", () => {
    it("includes all locale and freshness fields", () => {
      const key = buildSearchCacheKey({
        ...baseParams,
        provider: "brave",
        country: "US",
        search_lang: "en",
        ui_lang: "en-US",
        freshness: "pw",
      });
      expect(key).toBe("brave:test query:5:us:en:en-us:pw");
    });

    it("uses 'default' for missing optional fields", () => {
      const key = buildSearchCacheKey({ ...baseParams, provider: "brave" });
      expect(key).toBe("brave:test query:5:default:default:default:default");
    });

    it("produces different keys for different freshness values", () => {
      const a = buildSearchCacheKey({ ...baseParams, provider: "brave", freshness: "pd" });
      const b = buildSearchCacheKey({ ...baseParams, provider: "brave", freshness: "pm" });
      expect(a).not.toBe(b);
    });
  });

  describe("perplexity", () => {
    it("includes explicit baseUrl and model", () => {
      const key = buildSearchCacheKey({
        ...baseParams,
        provider: "perplexity",
        perplexityBaseUrl: "https://custom.api/v1",
        perplexityModel: "sonar",
      });
      expect(key).toBe("perplexity:test query:https://custom.api/v1:sonar");
    });

    it("falls back to default baseUrl and model", () => {
      const key = buildSearchCacheKey({ ...baseParams, provider: "perplexity" });
      expect(key).toBe("perplexity:test query:https://openrouter.ai/api/v1:perplexity/sonar-pro");
    });
  });

  describe("tavily", () => {
    it("includes count, freshness, and searchDepth", () => {
      const key = buildSearchCacheKey({
        ...baseParams,
        provider: "tavily",
        freshness: "pw",
        tavilySearchDepth: "basic",
      });
      expect(key).toBe("tavily:test query:5:pw:basic");
    });

    it("falls back to defaults for missing optional fields", () => {
      const key = buildSearchCacheKey({ ...baseParams, provider: "tavily" });
      expect(key).toBe("tavily:test query:5:default:advanced");
    });

    it("produces different keys for different search depths", () => {
      const a = buildSearchCacheKey({
        ...baseParams,
        provider: "tavily",
        tavilySearchDepth: "basic",
      });
      const b = buildSearchCacheKey({
        ...baseParams,
        provider: "tavily",
        tavilySearchDepth: "advanced",
      });
      expect(a).not.toBe(b);
    });
  });

  describe("grok", () => {
    it("includes explicit model", () => {
      const key = buildSearchCacheKey({
        ...baseParams,
        provider: "grok",
        grokModel: "grok-custom",
      });
      expect(key).toBe("grok:test query:grok-custom");
    });

    it("falls back to default model", () => {
      const key = buildSearchCacheKey({ ...baseParams, provider: "grok" });
      expect(key).toBe("grok:test query:grok-4-1-fast-reasoning");
    });
  });

  it("normalizes keys to lowercase", () => {
    const key = buildSearchCacheKey({
      ...baseParams,
      query: "UPPER CASE",
      provider: "brave",
      country: "US",
    });
    expect(key).toBe("brave:upper case:5:us:default:default:default");
  });

  it("different providers produce different keys for same query", () => {
    const brave = buildSearchCacheKey({ ...baseParams, provider: "brave" });
    const perplexity = buildSearchCacheKey({ ...baseParams, provider: "perplexity" });
    const tavily = buildSearchCacheKey({ ...baseParams, provider: "tavily" });
    const grok = buildSearchCacheKey({ ...baseParams, provider: "grok" });
    const keys = new Set([brave, perplexity, tavily, grok]);
    expect(keys.size).toBe(4);
  });
});

describe("runBraveSearch", () => {
  const mockFetch = vi.fn();
  const defaultParams = {
    query: "test query",
    apiKey: "brave-test-key",
    count: 5,
    timeoutSeconds: 30,
  };

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends correct request URL with query params", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ web: { results: [] } }),
    });

    await runBraveSearch({
      ...defaultParams,
      country: "DE",
      search_lang: "de",
      ui_lang: "de-DE",
      freshness: "pw",
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.searchParams.get("q")).toBe("test query");
    expect(parsed.searchParams.get("count")).toBe("5");
    expect(parsed.searchParams.get("country")).toBe("DE");
    expect(parsed.searchParams.get("search_lang")).toBe("de");
    expect(parsed.searchParams.get("ui_lang")).toBe("de-DE");
    expect(parsed.searchParams.get("freshness")).toBe("pw");
  });

  it("omits optional query params when not provided", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ web: { results: [] } }),
    });

    await runBraveSearch(defaultParams);

    const [url] = mockFetch.mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.searchParams.has("country")).toBe(false);
    expect(parsed.searchParams.has("search_lang")).toBe(false);
    expect(parsed.searchParams.has("ui_lang")).toBe(false);
    expect(parsed.searchParams.has("freshness")).toBe(false);
  });

  it("sends X-Subscription-Token auth header", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ web: { results: [] } }),
    });

    await runBraveSearch(defaultParams);

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers["X-Subscription-Token"]).toBe("brave-test-key");
  });

  it("maps results with wrapped title/description and raw URL", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        web: {
          results: [
            {
              title: "Test Title",
              url: "https://example.com/page",
              description: "A test description",
              age: "2 days ago",
            },
          ],
        },
      }),
    });

    const results = await runBraveSearch(defaultParams);
    expect(results).toHaveLength(1);

    // Title and description should be wrapped (not equal to raw)
    expect(results[0].title).toContain("Test Title");
    expect(results[0].title).not.toBe("Test Title");

    expect(results[0].description).toContain("A test description");
    expect(results[0].description).not.toBe("A test description");

    // URL should be kept raw
    expect(results[0].url).toBe("https://example.com/page");
  });

  it("maps published from age and siteName from hostname", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        web: {
          results: [
            {
              title: "Title",
              url: "https://docs.example.com/path",
              description: "Desc",
              age: "3 hours ago",
            },
          ],
        },
      }),
    });

    const results = await runBraveSearch(defaultParams);
    expect(results[0].published).toBe("3 hours ago");
    expect(results[0].siteName).toBe("docs.example.com");
  });

  it("throws on non-ok response with status and detail", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      text: async () => "invalid token",
    });

    await expect(runBraveSearch(defaultParams)).rejects.toThrow(
      "Brave Search API error (403): invalid token",
    );
  });

  it("falls back to statusText when response body is empty", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => "",
    });

    await expect(runBraveSearch(defaultParams)).rejects.toThrow(
      "Brave Search API error (500): Internal Server Error",
    );
  });
});

describe("performProviderSearch", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("dispatches to brave and returns correct payload shape", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        web: {
          results: [{ title: "T", url: "https://a.com", description: "D" }],
        },
      }),
    });

    const start = Date.now();
    const payload = await performProviderSearch(
      {
        query: "brave test",
        provider: "brave",
        count: 3,
        apiKey: "key",
        timeoutSeconds: 10,
      },
      start,
    );

    expect(Object.keys(payload).toSorted()).toEqual([
      "count",
      "provider",
      "query",
      "results",
      "tookMs",
    ]);
    expect(payload.query).toBe("brave test");
    expect(payload.provider).toBe("brave");
    expect(payload.count).toBe(1);
    expect(payload.tookMs).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(payload.results)).toBe(true);
  });

  it("dispatches to perplexity and returns correct payload shape", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "answer" } }],
        citations: ["https://cite.com"],
      }),
    });

    const start = Date.now();
    const payload = await performProviderSearch(
      {
        query: "pplx test",
        provider: "perplexity",
        count: 5,
        apiKey: "key",
        timeoutSeconds: 10,
        perplexityBaseUrl: "https://openrouter.ai/api/v1",
        perplexityModel: "perplexity/sonar-pro",
      },
      start,
    );

    expect(Object.keys(payload).toSorted()).toEqual([
      "citations",
      "content",
      "model",
      "provider",
      "query",
      "tookMs",
    ]);
    expect(payload.query).toBe("pplx test");
    expect(payload.provider).toBe("perplexity");
    expect(payload.model).toBe("perplexity/sonar-pro");
    expect(typeof payload.content).toBe("string");
    expect(payload.tookMs).toBeGreaterThanOrEqual(0);
    expect(payload.citations).toEqual(["https://cite.com"]);
  });

  it("dispatches to grok and returns correct payload shape", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        output: [
          {
            type: "message",
            status: "completed",
            content: [
              {
                text: "grok answer",
                annotations: [{ url: "https://x.com", start_index: 0, end_index: 5 }],
              },
            ],
          },
        ],
      }),
    });

    const start = Date.now();
    const payload = await performProviderSearch(
      {
        query: "grok test",
        provider: "grok",
        count: 5,
        apiKey: "key",
        timeoutSeconds: 10,
        grokModel: "grok-4-1-fast-reasoning",
      },
      start,
    );

    expect(Object.keys(payload).toSorted()).toEqual([
      "citations",
      "model",
      "provider",
      "query",
      "results",
      "tookMs",
    ]);
    expect(payload.query).toBe("grok test");
    expect(payload.provider).toBe("grok");
    expect(payload.model).toBe("grok-4-1-fast-reasoning");
    expect(payload.tookMs).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(payload.results)).toBe(true);
    expect(Array.isArray(payload.citations)).toBe(true);
  });

  it("dispatches to tavily and returns correct payload shape", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{ title: "T", url: "https://t.com", content: "C", score: 0.8 }],
      }),
    });

    const start = Date.now();
    const payload = await performProviderSearch(
      {
        query: "tavily test",
        provider: "tavily",
        count: 5,
        apiKey: "key",
        timeoutSeconds: 10,
      },
      start,
    );

    expect(Object.keys(payload).toSorted()).toEqual([
      "count",
      "provider",
      "query",
      "results",
      "tookMs",
    ]);
    expect(payload.query).toBe("tavily test");
    expect(payload.provider).toBe("tavily");
    expect(payload.count).toBe(1);
    expect(payload.tookMs).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(payload.results)).toBe(true);
  });

  it("throws for unsupported provider", async () => {
    await expect(
      performProviderSearch(
        {
          query: "q",
          provider: "unknown" as never,
          count: 5,
          apiKey: "key",
          timeoutSeconds: 10,
        },
        Date.now(),
      ),
    ).rejects.toThrow("Unsupported web search provider.");
  });
});
