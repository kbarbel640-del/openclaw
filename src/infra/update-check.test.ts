import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { compareSemverStrings, resolveNpmChannelTag } from "./update-check.js";

describe("compareSemverStrings", () => {
  it("treats OpenClaw numeric -N suffix as a newer build", () => {
    expect(compareSemverStrings("2026.2.21-2", "2026.2.21")).toBe(1);
    expect(compareSemverStrings("2026.2.21", "2026.2.21-2")).toBe(-1);
  });

  it("keeps prereleases below base release", () => {
    expect(compareSemverStrings("1.2.3-beta.1", "1.2.3")).toBe(-1);
    expect(compareSemverStrings("1.2.3", "1.2.3-beta.1")).toBe(1);
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

  it("keeps beta when beta is not older", async () => {
    versionByTag.beta = "1.0.2-beta.1";
    versionByTag.latest = "1.0.1-1";

    const resolved = await resolveNpmChannelTag({ channel: "beta", timeoutMs: 1000 });

    expect(resolved).toEqual({ tag: "beta", version: "1.0.2-beta.1" });
  });
});
