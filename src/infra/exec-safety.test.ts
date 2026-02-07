import { describe, expect, it } from "vitest";
import { isSafeExecutableValue } from "./exec-safety.js";

describe("isSafeExecutableValue", () => {
  it("rejects null", () => {
    expect(isSafeExecutableValue(null)).toBe(false);
  });

  it("rejects undefined", () => {
    expect(isSafeExecutableValue(undefined)).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isSafeExecutableValue("")).toBe(false);
  });

  it("rejects whitespace-only string", () => {
    expect(isSafeExecutableValue("   ")).toBe(false);
  });

  it("accepts bare command name", () => {
    expect(isSafeExecutableValue("node")).toBe(true);
    expect(isSafeExecutableValue("ffmpeg")).toBe(true);
    expect(isSafeExecutableValue("my-tool_v2.3")).toBe(true);
  });

  it("accepts path-like values", () => {
    expect(isSafeExecutableValue("/usr/bin/node")).toBe(true);
    expect(isSafeExecutableValue("./run.sh")).toBe(true);
    expect(isSafeExecutableValue("~/bin/tool")).toBe(true);
    expect(isSafeExecutableValue("C:\\Program Files\\tool.exe")).toBe(true); // backslash triggers isLikelyPath
  });

  it("accepts Windows drive paths", () => {
    expect(isSafeExecutableValue("C:/tools/node.exe")).toBe(true);
  });

  it("rejects shell metacharacters", () => {
    expect(isSafeExecutableValue("cmd; rm -rf /")).toBe(false);
    expect(isSafeExecutableValue("cmd & background")).toBe(false);
    expect(isSafeExecutableValue("cmd | pipe")).toBe(false);
    expect(isSafeExecutableValue("cmd `sub`")).toBe(false);
    expect(isSafeExecutableValue("cmd $VAR")).toBe(false);
    expect(isSafeExecutableValue("cmd < input")).toBe(false);
    expect(isSafeExecutableValue("cmd > output")).toBe(false);
  });

  it("rejects control characters", () => {
    expect(isSafeExecutableValue("cmd\nrm")).toBe(false);
    expect(isSafeExecutableValue("cmd\rrm")).toBe(false);
  });

  it("rejects null bytes", () => {
    expect(isSafeExecutableValue("cmd\0evil")).toBe(false);
  });

  it("rejects quotes", () => {
    expect(isSafeExecutableValue(`cmd"inject`)).toBe(false);
    expect(isSafeExecutableValue("cmd'inject")).toBe(false);
  });

  it("rejects flags (starts with dash)", () => {
    expect(isSafeExecutableValue("-rf")).toBe(false);
    expect(isSafeExecutableValue("--version")).toBe(false);
  });

  it("accepts names with dots, plus, dash in middle", () => {
    expect(isSafeExecutableValue("node.js")).toBe(true);
    expect(isSafeExecutableValue("g++")).toBe(true);
    expect(isSafeExecutableValue("c++")).toBe(true);
    expect(isSafeExecutableValue("tool+extra")).toBe(true);
  });
});
