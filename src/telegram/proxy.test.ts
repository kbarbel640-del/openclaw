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

import { makeProxyFetch, resolveProxyUrlFromEnv } from "./proxy.js";

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

  it("falls back to ALL_PROXY when neither HTTPS_PROXY nor HTTP_PROXY are set", () => {
    process.env.ALL_PROXY = "socks5://all-proxy:1080";
    expect(resolveProxyUrlFromEnv()).toBe("socks5://all-proxy:1080");
  });

  it("is case-insensitive — picks up lowercase https_proxy", () => {
    process.env.https_proxy = "https://lc-proxy:9090";
    expect(resolveProxyUrlFromEnv()).toBe("https://lc-proxy:9090");
  });

  it("trims whitespace from env var values", () => {
    process.env.HTTPS_PROXY = "  http://proxy.local:3128  ";
    expect(resolveProxyUrlFromEnv()).toBe("http://proxy.local:3128");
  });

  it("returns undefined for whitespace-only env var", () => {
    process.env.HTTP_PROXY = "   ";
    expect(resolveProxyUrlFromEnv()).toBeUndefined();
  });
});

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
