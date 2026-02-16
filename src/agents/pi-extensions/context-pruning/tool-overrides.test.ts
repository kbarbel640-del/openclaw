import { describe, expect, it } from "vitest";
import { computeEffectiveSettings, DEFAULT_SOFT_TRIM } from "./settings.js";
import { resolveToolSoftTrim } from "./tools.js";

describe("per-tool softTrim overrides", () => {
  it("returns global softTrim when no overrides are configured", () => {
    const settings = computeEffectiveSettings({
      mode: "cache-ttl",
    });
    expect(settings).not.toBeNull();
    const result = resolveToolSoftTrim("browser", settings!);
    expect(result).toEqual(DEFAULT_SOFT_TRIM);
  });

  it("returns per-tool override when configured", () => {
    const settings = computeEffectiveSettings({
      mode: "cache-ttl",
      toolOverrides: {
        browser: {
          softTrim: { maxChars: 1000, headChars: 400, tailChars: 400 },
        },
      },
    });
    expect(settings).not.toBeNull();
    const browserTrim = resolveToolSoftTrim("browser", settings!);
    expect(browserTrim.maxChars).toBe(1000);
    expect(browserTrim.headChars).toBe(400);
    expect(browserTrim.tailChars).toBe(400);

    // Other tools should still get default
    const execTrim = resolveToolSoftTrim("exec", settings!);
    expect(execTrim).toEqual(settings!.softTrim);
  });

  it("is case-insensitive for tool names", () => {
    const settings = computeEffectiveSettings({
      mode: "cache-ttl",
      toolOverrides: {
        Browser: {
          softTrim: { maxChars: 500 },
        },
      },
    });
    expect(settings).not.toBeNull();
    const result = resolveToolSoftTrim("browser", settings!);
    expect(result.maxChars).toBe(500);
  });

  it("inherits global softTrim values for unspecified fields", () => {
    const settings = computeEffectiveSettings({
      mode: "cache-ttl",
      softTrim: { maxChars: 3000, headChars: 1200, tailChars: 1200 },
      toolOverrides: {
        browser: {
          softTrim: { maxChars: 800 },
        },
      },
    });
    expect(settings).not.toBeNull();
    const result = resolveToolSoftTrim("browser", settings!);
    expect(result.maxChars).toBe(800);
    // headChars and tailChars should inherit from global
    expect(result.headChars).toBe(1200);
    expect(result.tailChars).toBe(1200);
  });

  it("supports multiple tool overrides", () => {
    const settings = computeEffectiveSettings({
      mode: "cache-ttl",
      toolOverrides: {
        browser: { softTrim: { maxChars: 1000 } },
        web_fetch: { softTrim: { maxChars: 2000 } },
        read: { softTrim: { maxChars: 8000 } },
      },
    });
    expect(settings).not.toBeNull();
    expect(resolveToolSoftTrim("browser", settings!).maxChars).toBe(1000);
    expect(resolveToolSoftTrim("web_fetch", settings!).maxChars).toBe(2000);
    expect(resolveToolSoftTrim("read", settings!).maxChars).toBe(8000);
    expect(resolveToolSoftTrim("exec", settings!).maxChars).toBe(DEFAULT_SOFT_TRIM.maxChars);
  });
});
