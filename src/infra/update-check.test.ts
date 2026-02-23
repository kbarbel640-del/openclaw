import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { compareSemverStrings, resolveNpmChannelTag } from "./update-check.js";

describe("compareSemverStrings", () => {
  it("treats numeric -N suffix as newer than the base release", () => {
    expect(compareSemverStrings("2026.2.21-2", "2026.2.21")).toBe(1);
    expect(compareSemverStrings("v2026.2.21-2", "2026.2.21")).toBe(1);
  });

  it("orders numeric -N suffixes by build number", () => {
    expect(compareSemverStrings("2026.2.21-1", "2026.2.21-2")).toBe(-1);
    expect(compareSemverStrings("2026.2.21-3", "2026.2.21-2")).toBe(1);
  });

  it("treats prerelease labels as older than stable and numeric build suffixes", () => {
    expect(compareSemverStrings("2026.2.21-beta.2", "2026.2.21")).toBe(-1);
    expect(compareSemverStrings("2026.2.21-beta.2", "2026.2.21-1")).toBe(-1);
  });

  it("returns null when either input cannot be parsed", () => {
    expect(compareSemverStrings("invalid", "2026.2.21")).toBeNull();
    expect(compareSemverStrings("2026.2.21", null)).toBeNull();
  });
});

describe("resolveNpmChannelTag", () => {
  let versionByTag: Record<string, string | null>;

  beforeEach(() => {
    versionByTag = {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url =
          typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const tag = decodeURIComponent(url.split("/").pop() ?? "");
        const version = versionByTag[tag] ?? null;
        return {
          ok: version != null,
          status: version != null ? 200 : 404,
          json: async () => ({ version }),
        } as Response;
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back to latest when beta is older", async () => {
    versionByTag.beta = "1.0.0-beta.1";
    versionByTag.latest = "1.0.1-1";

    const resolved = await resolveNpmChannelTag({ channel: "beta", timeoutMs: 1000 });

    expect(resolved).toEqual({ tag: "latest", version: "1.0.1-1" });
  });

  it("falls back to latest when beta prerelease shares core with a latest build suffix", async () => {
    versionByTag.beta = "1.0.1-beta.1";
    versionByTag.latest = "1.0.1-2";

    const resolved = await resolveNpmChannelTag({ channel: "beta", timeoutMs: 1000 });

    expect(resolved).toEqual({ tag: "latest", version: "1.0.1-2" });
  });

  it("keeps beta when beta is not older", async () => {
    versionByTag.beta = "1.0.2-beta.1";
    versionByTag.latest = "1.0.1-1";

    const resolved = await resolveNpmChannelTag({ channel: "beta", timeoutMs: 1000 });

    expect(resolved).toEqual({ tag: "beta", version: "1.0.2-beta.1" });
  });
});
