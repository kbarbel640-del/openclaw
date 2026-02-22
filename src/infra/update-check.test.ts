import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { compareSemverStrings, resolveNpmChannelTag } from "./update-check.js";

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

  it("keeps beta when beta is not older", async () => {
    versionByTag.beta = "1.0.2-beta.1";
    versionByTag.latest = "1.0.1-1";

    const resolved = await resolveNpmChannelTag({ channel: "beta", timeoutMs: 1000 });

    expect(resolved).toEqual({ tag: "beta", version: "1.0.2-beta.1" });
  });
});

describe("compareSemverStrings", () => {
  it("returns null for invalid versions", () => {
    expect(compareSemverStrings(null, "1.0.0")).toBeNull();
    expect(compareSemverStrings("invalid", "1.0.0")).toBeNull();
    expect(compareSemverStrings("1.0.0", null)).toBeNull();
  });

  it("compares basic semver correctly", () => {
    expect(compareSemverStrings("1.0.0", "1.0.1")).toBe(-1);
    expect(compareSemverStrings("1.0.1", "1.0.0")).toBe(1);
    expect(compareSemverStrings("1.0.0", "1.0.0")).toBe(0);
    expect(compareSemverStrings("1.0.0", "1.1.0")).toBe(-1);
    expect(compareSemverStrings("2.0.0", "1.9.9")).toBe(1);
  });

  it("treats build suffix as newer than base version (the fix)", () => {
    // This is the core fix: 2026.2.21-2 should be newer than 2026.2.21
    expect(compareSemverStrings("2026.2.21-2", "2026.2.21")).toBe(1);
    expect(compareSemverStrings("2026.2.21", "2026.2.21-2")).toBe(-1);
    expect(compareSemverStrings("2026.2.21-2", "2026.2.21-2")).toBe(0);
  });

  it("compares build suffixes correctly", () => {
    expect(compareSemverStrings("2026.2.21-1", "2026.2.21-2")).toBe(-1);
    expect(compareSemverStrings("2026.2.21-5", "2026.2.21-2")).toBe(1);
    expect(compareSemverStrings("1.0.0-10", "1.0.0-2")).toBe(1); // numeric comparison, not string
  });

  it("handles various build suffix formats", () => {
    expect(compareSemverStrings("1.0.0-1", "1.0.0")).toBe(1);
    expect(compareSemverStrings("2026.2.21-99", "2026.2.21-1")).toBe(1);
  });
});
