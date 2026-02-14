import { describe, expect, it } from "vitest";
import {
  normalizeTimestamp,
  withNormalizedTimestamp,
  formatUserTime,
  resolveUserTimezone,
} from "./date-time.js";

// ---------------------------------------------------------------------------
// normalizeTimestamp
// ---------------------------------------------------------------------------

describe("normalizeTimestamp", () => {
  it("returns undefined for null/undefined", () => {
    expect(normalizeTimestamp(null)).toBeUndefined();
    expect(normalizeTimestamp(undefined)).toBeUndefined();
  });

  it("handles Date objects", () => {
    const d = new Date("2026-01-15T12:00:00Z");
    const result = normalizeTimestamp(d);
    expect(result).toBeDefined();
    expect(result!.timestampMs).toBe(d.getTime());
    expect(result!.timestampUtc).toBe(d.toISOString());
  });

  it("handles epoch seconds (number < 1e12)", () => {
    const epochSec = 1706000000; // ~2024-01-23
    const result = normalizeTimestamp(epochSec);
    expect(result).toBeDefined();
    expect(result!.timestampMs).toBe(epochSec * 1000);
  });

  it("handles epoch milliseconds (number >= 1e12)", () => {
    const epochMs = 1706000000000;
    const result = normalizeTimestamp(epochMs);
    expect(result).toBeDefined();
    expect(result!.timestampMs).toBe(epochMs);
  });

  it("handles numeric string as epoch seconds", () => {
    const result = normalizeTimestamp("1706000000");
    expect(result).toBeDefined();
    expect(result!.timestampMs).toBe(1706000000 * 1000);
  });

  it("handles numeric string with 13+ digits as epoch ms", () => {
    const result = normalizeTimestamp("1706000000000");
    expect(result).toBeDefined();
    expect(result!.timestampMs).toBe(1706000000000);
  });

  it("handles float string as epoch seconds", () => {
    const result = normalizeTimestamp("1706000000.123");
    expect(result).toBeDefined();
    expect(result!.timestampMs).toBe(Math.round(1706000000.123 * 1000));
  });

  it("handles ISO date string", () => {
    const result = normalizeTimestamp("2026-01-15T12:00:00Z");
    expect(result).toBeDefined();
    expect(result!.timestampUtc).toBe("2026-01-15T12:00:00.000Z");
  });

  it("returns undefined for empty string", () => {
    expect(normalizeTimestamp("")).toBeUndefined();
    expect(normalizeTimestamp("   ")).toBeUndefined();
  });

  it("returns undefined for non-parseable string", () => {
    expect(normalizeTimestamp("not a date")).toBeUndefined();
  });

  it("returns undefined for NaN", () => {
    expect(normalizeTimestamp(NaN)).toBeUndefined();
  });

  it("returns undefined for Infinity", () => {
    expect(normalizeTimestamp(Infinity)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// withNormalizedTimestamp
// ---------------------------------------------------------------------------

describe("withNormalizedTimestamp", () => {
  it("adds timestampMs and timestampUtc to object", () => {
    const result = withNormalizedTimestamp({ foo: "bar" }, 1706000000000);
    expect(result.foo).toBe("bar");
    expect(result.timestampMs).toBe(1706000000000);
    expect(result.timestampUtc).toBeDefined();
  });

  it("preserves existing timestampMs if valid", () => {
    const existing = { timestampMs: 9999 };
    const result = withNormalizedTimestamp(existing, 1706000000000);
    expect(result.timestampMs).toBe(9999);
  });

  it("overwrites invalid existing timestampMs", () => {
    const existing = { timestampMs: NaN };
    const result = withNormalizedTimestamp(existing, 1706000000000);
    expect(result.timestampMs).toBe(1706000000000);
  });

  it("returns original value if raw is unparseable", () => {
    const original = { foo: "bar" };
    const result = withNormalizedTimestamp(original, null);
    expect(result).toBe(original);
  });
});

// ---------------------------------------------------------------------------
// resolveUserTimezone
// ---------------------------------------------------------------------------

describe("resolveUserTimezone", () => {
  it("returns configured timezone when valid", () => {
    expect(resolveUserTimezone("America/New_York")).toBe("America/New_York");
  });

  it("falls back to host timezone for invalid input", () => {
    const tz = resolveUserTimezone("Invalid/Zone");
    expect(tz).toBeTruthy();
    expect(tz).not.toBe("Invalid/Zone");
  });

  it("falls back for empty/undefined", () => {
    const tz = resolveUserTimezone(undefined);
    expect(tz).toBeTruthy();
  });

  it("trims whitespace", () => {
    expect(resolveUserTimezone("  UTC  ")).toBe("UTC");
  });
});

// ---------------------------------------------------------------------------
// formatUserTime
// ---------------------------------------------------------------------------

describe("formatUserTime", () => {
  const date = new Date("2026-01-15T14:30:00Z");

  it("formats in 12-hour mode", () => {
    const result = formatUserTime(date, "UTC", "12");
    expect(result).toBeDefined();
    expect(result).toContain("January");
    expect(result).toContain("15th");
    expect(result).toContain("2026");
    expect(result).toMatch(/PM|AM/i);
  });

  it("formats in 24-hour mode", () => {
    const result = formatUserTime(date, "UTC", "24");
    expect(result).toBeDefined();
    expect(result).toContain("14:30");
  });

  it("handles different timezones", () => {
    const result = formatUserTime(date, "Asia/Tokyo", "24");
    expect(result).toBeDefined();
    expect(result).toContain("23:30");
  });

  it("returns undefined for invalid timezone", () => {
    const result = formatUserTime(date, "Invalid/Zone", "24");
    expect(result).toBeUndefined();
  });
});
