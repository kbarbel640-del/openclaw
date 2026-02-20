import { describe, expect, it } from "vitest";
import {
  parseDigestArgs,
  parseChannelArgs,
  parseTopicsArgs,
  parseTopArgs,
  periodToMs,
} from "./parse-args.js";

// ---------------------------------------------------------------------------
// periodToMs
// ---------------------------------------------------------------------------

describe("periodToMs", () => {
  it("converts hours", () => {
    expect(periodToMs("3h")).toBe(3 * 60 * 60 * 1000);
  });

  it("converts days", () => {
    expect(periodToMs("7d")).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("converts weeks", () => {
    expect(periodToMs("2w")).toBe(2 * 7 * 24 * 60 * 60 * 1000);
  });

  it("converts months (30 days)", () => {
    expect(periodToMs("1m")).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("falls back to 1 day for invalid input", () => {
    expect(periodToMs("abc")).toBe(24 * 60 * 60 * 1000);
    expect(periodToMs("")).toBe(24 * 60 * 60 * 1000);
  });
});

// ---------------------------------------------------------------------------
// parseDigestArgs
// ---------------------------------------------------------------------------

describe("parseDigestArgs", () => {
  it("returns default 1d for empty input", () => {
    expect(parseDigestArgs("")).toEqual({ period: "1d" });
  });

  it("extracts period", () => {
    expect(parseDigestArgs("7d")).toEqual({ period: "7d" });
  });

  it("ignores non-period tokens", () => {
    expect(parseDigestArgs("foo 3h bar")).toEqual({ period: "3h" });
  });
});

// ---------------------------------------------------------------------------
// parseChannelArgs
// ---------------------------------------------------------------------------

describe("parseChannelArgs", () => {
  it("parses channel name and default period", () => {
    expect(parseChannelArgs("@durov")).toEqual({
      channel: "@durov",
      period: "1d",
    });
  });

  it("parses channel name and explicit period", () => {
    expect(parseChannelArgs("@durov 3d")).toEqual({
      channel: "@durov",
      period: "3d",
    });
  });

  it("parses period before channel name", () => {
    expect(parseChannelArgs("7d @channel")).toEqual({
      channel: "@channel",
      period: "7d",
    });
  });

  it("returns empty channel for empty input", () => {
    expect(parseChannelArgs("")).toEqual({ channel: "", period: "1d" });
  });
});

// ---------------------------------------------------------------------------
// parseTopicsArgs
// ---------------------------------------------------------------------------

describe("parseTopicsArgs", () => {
  it("returns default 1d for empty input", () => {
    expect(parseTopicsArgs("")).toEqual({ period: "1d" });
  });

  it("extracts period", () => {
    expect(parseTopicsArgs("1w")).toEqual({ period: "1w" });
  });
});

// ---------------------------------------------------------------------------
// parseTopArgs
// ---------------------------------------------------------------------------

describe("parseTopArgs", () => {
  it("returns defaults for empty input", () => {
    expect(parseTopArgs("")).toEqual({ count: 10, period: "1d" });
  });

  it("parses count only", () => {
    expect(parseTopArgs("5")).toEqual({ count: 5, period: "1d" });
  });

  it("parses period only", () => {
    expect(parseTopArgs("7d")).toEqual({ count: 10, period: "7d" });
  });

  it("parses both count and period", () => {
    expect(parseTopArgs("5 7d")).toEqual({ count: 5, period: "7d" });
  });

  it("parses period before count", () => {
    expect(parseTopArgs("7d 5")).toEqual({ count: 5, period: "7d" });
  });

  it("clamps count to 1-100 range", () => {
    expect(parseTopArgs("0")).toEqual({ count: 1, period: "1d" });
    expect(parseTopArgs("999")).toEqual({ count: 100, period: "1d" });
  });
});
