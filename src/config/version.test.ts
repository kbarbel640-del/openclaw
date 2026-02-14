import { describe, expect, it } from "vitest";
import { parseOpenClawVersion, compareOpenClawVersions } from "./version.js";

describe("parseOpenClawVersion", () => {
  it("returns null for null", () => {
    expect(parseOpenClawVersion(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(parseOpenClawVersion(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseOpenClawVersion("")).toBeNull();
  });

  it("returns null for invalid version", () => {
    expect(parseOpenClawVersion("not-a-version")).toBeNull();
  });

  it("parses x.y.z format", () => {
    expect(parseOpenClawVersion("2026.2.3")).toEqual({
      major: 2026,
      minor: 2,
      patch: 3,
      revision: 0,
    });
  });

  it("parses v-prefixed version", () => {
    expect(parseOpenClawVersion("v2026.1.15")).toEqual({
      major: 2026,
      minor: 1,
      patch: 15,
      revision: 0,
    });
  });

  it("parses version with revision", () => {
    expect(parseOpenClawVersion("2026.2.3-1")).toEqual({
      major: 2026,
      minor: 2,
      patch: 3,
      revision: 1,
    });
  });

  it("trims whitespace", () => {
    expect(parseOpenClawVersion("  1.2.3  ")).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      revision: 0,
    });
  });
});

describe("compareOpenClawVersions", () => {
  it("returns null when either version is invalid", () => {
    expect(compareOpenClawVersions(null, "1.0.0")).toBeNull();
    expect(compareOpenClawVersions("1.0.0", null)).toBeNull();
    expect(compareOpenClawVersions("bad", "1.0.0")).toBeNull();
  });

  it("returns 0 for equal versions", () => {
    expect(compareOpenClawVersions("1.2.3", "1.2.3")).toBe(0);
  });

  it("compares major versions", () => {
    expect(compareOpenClawVersions("1.0.0", "2.0.0")).toBe(-1);
    expect(compareOpenClawVersions("2.0.0", "1.0.0")).toBe(1);
  });

  it("compares minor versions", () => {
    expect(compareOpenClawVersions("1.1.0", "1.2.0")).toBe(-1);
    expect(compareOpenClawVersions("1.2.0", "1.1.0")).toBe(1);
  });

  it("compares patch versions", () => {
    expect(compareOpenClawVersions("1.0.1", "1.0.2")).toBe(-1);
    expect(compareOpenClawVersions("1.0.2", "1.0.1")).toBe(1);
  });

  it("compares revision", () => {
    expect(compareOpenClawVersions("1.0.0-1", "1.0.0-2")).toBe(-1);
    expect(compareOpenClawVersions("1.0.0-2", "1.0.0-1")).toBe(1);
  });

  it("treats missing revision as 0", () => {
    expect(compareOpenClawVersions("1.0.0", "1.0.0-0")).toBe(0);
    expect(compareOpenClawVersions("1.0.0", "1.0.0-1")).toBe(-1);
  });
});
