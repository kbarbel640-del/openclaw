import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkProxyHealth,
  clearProxyHealthCache,
  ensureProxyHealthy,
} from "./cloudru-proxy-health.js";

beforeEach(() => {
  clearProxyHealthCache();
  vi.restoreAllMocks();
});

afterEach(() => {
  clearProxyHealthCache();
});

describe("checkProxyHealth", () => {
  it("returns ok:true when proxy responds 200", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("OK", { status: 200 }));

    const result = await checkProxyHealth("http://127.0.0.1:8082");

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.error).toBeUndefined();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:8082/health",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("returns ok:false for non-200 status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Bad Gateway", { status: 502 }),
    );

    const result = await checkProxyHealth("http://127.0.0.1:8082");

    expect(result.ok).toBe(false);
    expect(result.status).toBe(502);
  });

  it("returns ok:false with error message on network failure", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const result = await checkProxyHealth("http://127.0.0.1:8082");

    expect(result.ok).toBe(false);
    expect(result.error).toBe("ECONNREFUSED");
    expect(result.status).toBeUndefined();
  });

  it("strips trailing slashes from proxy URL", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("OK", { status: 200 }));

    await checkProxyHealth("http://127.0.0.1:8082///");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:8082/health",
      expect.any(Object),
    );
  });

  it("caches successful results for 30s", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("OK", { status: 200 }));

    const first = await checkProxyHealth("http://127.0.0.1:8082");
    const second = await checkProxyHealth("http://127.0.0.1:8082");

    expect(first).toBe(second);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("does not cache failed results", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce(new Response("OK", { status: 200 }));

    const fail = await checkProxyHealth("http://127.0.0.1:8082");
    expect(fail.ok).toBe(false);

    const ok = await checkProxyHealth("http://127.0.0.1:8082");
    expect(ok.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("cache invalidates when URL changes", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("OK", { status: 200 }));

    await checkProxyHealth("http://127.0.0.1:8082");
    await checkProxyHealth("http://127.0.0.1:9999");

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

describe("ensureProxyHealthy", () => {
  it("resolves when proxy is healthy", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("OK", { status: 200 }));

    await expect(ensureProxyHealthy("http://127.0.0.1:8082")).resolves.toBeUndefined();
  });

  it("throws with actionable message on network failure", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("ECONNREFUSED"));

    await expect(ensureProxyHealthy("http://127.0.0.1:8082")).rejects.toThrow(
      /Cloud\.ru proxy.*unreachable.*ECONNREFUSED/,
    );
  });

  it("throws with HTTP status on non-200", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("", { status: 503 }));

    await expect(ensureProxyHealthy("http://127.0.0.1:8082")).rejects.toThrow(/HTTP 503/);
  });

  it("throws plain Error, not FailoverError", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("ECONNREFUSED"));

    try {
      await ensureProxyHealthy("http://127.0.0.1:8082");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect(err.constructor.name).toBe("Error");
    }
  });
});
