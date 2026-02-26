import { afterEach, describe, expect, it, vi } from "vitest";

const { ProxyAgent, undiciFetch, proxyAgentSpy, getLastAgent } = vi.hoisted(() => {
  const undiciFetch = vi.fn();
  const proxyAgentSpy = vi.fn();
  class ProxyAgent {
    static lastCreated: ProxyAgent | undefined;
    proxyUrl: string;
    constructor(proxyUrl: string) {
      this.proxyUrl = proxyUrl;
      ProxyAgent.lastCreated = this;
      proxyAgentSpy(proxyUrl);
    }
  }

  return {
    ProxyAgent,
    undiciFetch,
    proxyAgentSpy,
    getLastAgent: () => ProxyAgent.lastCreated,
  };
});

vi.mock("undici", () => ({
  ProxyAgent,
  fetch: undiciFetch,
}));

import { makeProxyFetch } from "./proxy.js";

describe("makeProxyFetch", () => {
  it("uses undici fetch with ProxyAgent dispatcher", async () => {
    const proxyUrl = "http://proxy.test:8080";
    undiciFetch.mockResolvedValue({ ok: true });

    const proxyFetch = makeProxyFetch(proxyUrl);
    await proxyFetch("https://api.telegram.org/bot123/getMe");

    expect(proxyAgentSpy).toHaveBeenCalledWith(proxyUrl);
    expect(undiciFetch).toHaveBeenCalledWith(
      "https://api.telegram.org/bot123/getMe",
      expect.objectContaining({ dispatcher: getLastAgent() }),
    );
  });
});

// --- resolveProxyUrlFromEnv tests (added in #24606) ---
import { resolveProxyUrlFromEnv } from "./proxy.js";

describe("resolveProxyUrlFromEnv", () => {
  const VARS = ["HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy", "ALL_PROXY", "all_proxy"];

  afterEach(() => {
    for (const v of VARS) {
      delete process.env[v];
    }
  });

  it("returns undefined when no proxy env vars are set", () => {
    for (const v of VARS) {
      delete process.env[v];
    }
    expect(resolveProxyUrlFromEnv()).toBeUndefined();
  });

  it("prefers HTTPS_PROXY over HTTP_PROXY and ALL_PROXY", () => {
    process.env.HTTPS_PROXY = "https://secure-proxy:8080";
    process.env.HTTP_PROXY = "http://plain-proxy:8080";
    process.env.ALL_PROXY = "socks5://all-proxy:1080";
    expect(resolveProxyUrlFromEnv()).toBe("https://secure-proxy:8080");
  });

  it("falls back to HTTP_PROXY when HTTPS_PROXY is not set", () => {
    process.env.HTTP_PROXY = "http://plain-proxy:8080";
    process.env.ALL_PROXY = "socks5://all-proxy:1080";
    expect(resolveProxyUrlFromEnv()).toBe("http://plain-proxy:8080");
  });

  it("falls back to ALL_PROXY", () => {
    process.env.ALL_PROXY = "socks5://all-proxy:1080";
    expect(resolveProxyUrlFromEnv()).toBe("socks5://all-proxy:1080");
  });

  it("ignores whitespace-only values", () => {
    process.env.HTTPS_PROXY = "   ";
    process.env.HTTP_PROXY = "http://real:8080";
    expect(resolveProxyUrlFromEnv()).toBe("http://real:8080");
  });
});
