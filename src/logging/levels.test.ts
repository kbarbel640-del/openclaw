import { describe, expect, it } from "vitest";
import { normalizeLogLevel, levelToMinLevel } from "./levels.js";

describe("normalizeLogLevel", () => {
  it("returns valid log levels unchanged", () => {
    expect(normalizeLogLevel("info")).toBe("info");
    expect(normalizeLogLevel("debug")).toBe("debug");
    expect(normalizeLogLevel("error")).toBe("error");
    expect(normalizeLogLevel("warn")).toBe("warn");
    expect(normalizeLogLevel("trace")).toBe("trace");
    expect(normalizeLogLevel("fatal")).toBe("fatal");
    expect(normalizeLogLevel("silent")).toBe("silent");
  });

  it("returns fallback for invalid levels", () => {
    expect(normalizeLogLevel("verbose")).toBe("info");
    expect(normalizeLogLevel("critical")).toBe("info");
    expect(normalizeLogLevel("")).toBe("info");
  });

  it("returns fallback for undefined", () => {
    expect(normalizeLogLevel(undefined)).toBe("info");
  });

  it("respects custom fallback", () => {
    expect(normalizeLogLevel("invalid", "debug")).toBe("debug");
    expect(normalizeLogLevel(undefined, "warn")).toBe("warn");
  });

  it("trims whitespace", () => {
    expect(normalizeLogLevel("  debug  ")).toBe("debug");
  });
});

describe("levelToMinLevel", () => {
  it("maps fatal to 0", () => {
    expect(levelToMinLevel("fatal")).toBe(0);
  });

  it("maps error to 1", () => {
    expect(levelToMinLevel("error")).toBe(1);
  });

  it("maps warn to 2", () => {
    expect(levelToMinLevel("warn")).toBe(2);
  });

  it("maps info to 3", () => {
    expect(levelToMinLevel("info")).toBe(3);
  });

  it("maps debug to 4", () => {
    expect(levelToMinLevel("debug")).toBe(4);
  });

  it("maps trace to 5", () => {
    expect(levelToMinLevel("trace")).toBe(5);
  });

  it("maps silent to Infinity", () => {
    expect(levelToMinLevel("silent")).toBe(Number.POSITIVE_INFINITY);
  });

  it("maintains ordering: fatal < error < warn < info < debug < trace", () => {
    expect(levelToMinLevel("fatal")).toBeLessThan(levelToMinLevel("error"));
    expect(levelToMinLevel("error")).toBeLessThan(levelToMinLevel("warn"));
    expect(levelToMinLevel("warn")).toBeLessThan(levelToMinLevel("info"));
    expect(levelToMinLevel("info")).toBeLessThan(levelToMinLevel("debug"));
    expect(levelToMinLevel("debug")).toBeLessThan(levelToMinLevel("trace"));
  });
});
