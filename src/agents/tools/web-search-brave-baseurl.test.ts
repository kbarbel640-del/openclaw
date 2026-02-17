import { describe, expect, it } from "vitest";
import { createWebSearchTool, __testing } from "./web-search.js";

const { resolveBraveBaseUrl, resolveBraveConfig, resolveSearchApiKey, DEFAULT_BRAVE_BASE_URL } =
  __testing;

describe("web_search brave baseUrl resolution", () => {
  it("defaults to api.search.brave.com when no config", () => {
    expect(resolveBraveBaseUrl(undefined, undefined)).toBe("https://api.search.brave.com");
    expect(resolveBraveBaseUrl({}, undefined)).toBe("https://api.search.brave.com");
  });

  it("uses brave.baseUrl from provider-specific config", () => {
    expect(resolveBraveBaseUrl({ baseUrl: "http://localhost:9100/brave" })).toBe(
      "http://localhost:9100/brave",
    );
  });

  it("strips trailing slash from brave.baseUrl", () => {
    expect(resolveBraveBaseUrl({ baseUrl: "http://localhost:9100/brave/" })).toBe(
      "http://localhost:9100/brave",
    );
  });

  it("falls back to top-level search.baseUrl when brave.baseUrl is not set", () => {
    const search = { baseUrl: "http://localhost:8080" } as Record<string, unknown>;
    expect(resolveBraveBaseUrl({}, search)).toBe("http://localhost:8080");
  });

  it("prefers brave.baseUrl over top-level search.baseUrl", () => {
    const search = { baseUrl: "http://fallback" } as Record<string, unknown>;
    expect(resolveBraveBaseUrl({ baseUrl: "http://preferred" }, search)).toBe("http://preferred");
  });

  it("ignores empty string in brave.baseUrl", () => {
    expect(resolveBraveBaseUrl({ baseUrl: "" })).toBe("https://api.search.brave.com");
  });

  it("ignores whitespace-only brave.baseUrl", () => {
    expect(resolveBraveBaseUrl({ baseUrl: "   " })).toBe("https://api.search.brave.com");
  });
});

describe("web_search brave config extraction", () => {
  it("returns empty config when search is undefined", () => {
    expect(resolveBraveConfig(undefined)).toEqual({});
  });

  it("returns empty config when brave section is missing", () => {
    expect(resolveBraveConfig({} as Record<string, unknown>)).toEqual({});
  });

  it("extracts brave section from search config", () => {
    const search = { brave: { baseUrl: "http://localhost:9100/brave", apiKey: "test-key" } };
    expect(resolveBraveConfig(search as Record<string, unknown>)).toEqual({
      baseUrl: "http://localhost:9100/brave",
      apiKey: "test-key",
    });
  });

  it("returns empty config when brave is not an object", () => {
    const search = { brave: "not-an-object" };
    expect(resolveBraveConfig(search as Record<string, unknown>)).toEqual({});
  });
});

describe("web_search brave proxy (no API key with custom baseUrl)", () => {
  it("resolveSearchApiKey returns undefined when no key is configured", () => {
    expect(resolveSearchApiKey(undefined, {})).toBeUndefined();
    expect(resolveSearchApiKey({} as Record<string, unknown>, {})).toBeUndefined();
  });

  it("resolveSearchApiKey returns key from brave config", () => {
    expect(resolveSearchApiKey(undefined, { apiKey: "brave-key" })).toBe("brave-key");
  });

  it("resolveSearchApiKey falls back to top-level search.apiKey", () => {
    const search = { apiKey: "top-level-key" } as Record<string, unknown>;
    expect(resolveSearchApiKey(search, {})).toBe("top-level-key");
  });

  it("tool does not require API key when custom baseUrl is set (proxy mode)", async () => {
    const tool = createWebSearchTool({
      config: {
        tools: {
          web: {
            search: {
              brave: { baseUrl: "http://localhost:9100/brave" },
            },
          },
        },
      } as Record<string, unknown>,
    });
    expect(tool).not.toBeNull();
    // Execute with no API key — should NOT return missing_brave_api_key error.
    // The request will be attempted (proving the key check was skipped) and either:
    // - return a network error (CI, no proxy running) → caught as thrown error
    // - return a result (local dev with proxy running) → parsed from JSON
    let error: string | undefined;
    try {
      const result = (await tool!.execute("test-call", { query: "test" })) as {
        content: Array<{ text: string }>;
      };
      const parsed = JSON.parse(result.content[0].text);
      error = parsed.error;
    } catch {
      // Network error (ECONNREFUSED etc.) means the request was attempted,
      // which proves the missing-key guard was skipped. That's a pass.
      error = "network_error";
    }
    expect(error).not.toBe("missing_brave_api_key");
  });

  it("tool requires API key when using default baseUrl", async () => {
    const tool = createWebSearchTool({
      config: {
        tools: { web: { search: {} } },
      } as Record<string, unknown>,
    });
    expect(tool).not.toBeNull();
    const result = (await tool!.execute("test-call", { query: "test" })) as {
      content: Array<{ text: string }>;
    };
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe("missing_brave_api_key");
  });

  it("custom baseUrl is detected correctly vs default", () => {
    expect(resolveBraveBaseUrl({ baseUrl: "http://localhost:9100/brave" })).not.toBe(
      DEFAULT_BRAVE_BASE_URL,
    );
    expect(resolveBraveBaseUrl({})).toBe(DEFAULT_BRAVE_BASE_URL);
  });
});
