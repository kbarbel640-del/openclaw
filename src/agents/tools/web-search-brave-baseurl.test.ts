import { describe, expect, it } from "vitest";
import { __testing } from "./web-search.js";

const { resolveBraveBaseUrl, resolveBraveConfig } = __testing;

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
