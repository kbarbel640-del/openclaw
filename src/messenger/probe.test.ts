import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { probeMessenger } from "./probe.js";

describe("probeMessenger", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns error when token is empty", async () => {
    const result = await probeMessenger("", 5000);
    expect(result.ok).toBe(false);
    expect(result.error).toBe("page access token not configured");
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it("returns error when token is whitespace only", async () => {
    const result = await probeMessenger("   ", 5000);
    expect(result.ok).toBe(false);
    expect(result.error).toBe("page access token not configured");
  });

  it("returns success with page info on valid response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          id: "123456789012345",
          name: "Test Page",
        }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await probeMessenger("valid_token", 5000);
    expect(result.ok).toBe(true);
    expect(result.error).toBeNull();
    expect(result.page?.id).toBe("123456789012345");
    expect(result.page?.name).toBe("Test Page");
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it("returns error on API error response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () =>
        Promise.resolve({
          error: {
            message: "Invalid OAuth access token",
            type: "OAuthException",
            code: 190,
          },
        }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await probeMessenger("invalid_token", 5000);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toBe("Invalid OAuth access token");
  });

  it("returns error on network failure", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
    vi.stubGlobal("fetch", mockFetch);

    const result = await probeMessenger("any_token", 5000);
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Network error");
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it("returns error on timeout", async () => {
    const mockFetch = vi.fn().mockImplementation(() => {
      return new Promise((_, reject) => {
        setTimeout(() => reject(new Error("The operation was aborted")), 100);
      });
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await probeMessenger("any_token", 50);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("aborted");
  });

  it("handles response without error object", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await probeMessenger("any_token", 5000);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(500);
    expect(result.error).toBe("API call failed (500)");
  });

  it("encodes token in URL", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: "123", name: "Test" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await probeMessenger("token+with=special&chars", 5000);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("token%2Bwith%3Dspecial%26chars"),
      expect.anything(),
    );
  });
});
