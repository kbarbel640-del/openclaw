import { describe, expect, it, vi } from "vitest";
import { formatRelativeTime } from "./time-format.js";

describe("formatRelativeTime", () => {
  it("returns 'just now' for < 60 seconds", () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 5_000)).toBe("just now");
    expect(formatRelativeTime(now - 59_000)).toBe("just now");
  });

  it("returns minutes for < 60 minutes", () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 60_000)).toBe("1m ago");
    expect(formatRelativeTime(now - 5 * 60_000)).toBe("5m ago");
    expect(formatRelativeTime(now - 59 * 60_000)).toBe("59m ago");
  });

  it("returns hours for < 24 hours", () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 60 * 60_000)).toBe("1h ago");
    expect(formatRelativeTime(now - 12 * 60 * 60_000)).toBe("12h ago");
  });

  it("returns 'Yesterday' for 1 day", () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 24 * 60 * 60_000)).toBe("Yesterday");
  });

  it("returns days for 2-6 days", () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 2 * 24 * 60 * 60_000)).toBe("2d ago");
    expect(formatRelativeTime(now - 6 * 24 * 60 * 60_000)).toBe("6d ago");
  });

  it("returns date for 7+ days", () => {
    const now = Date.now();
    const result = formatRelativeTime(now - 30 * 24 * 60 * 60_000);
    // Should be a formatted date like "Jan 7" or "Dec 25"
    expect(result).not.toContain("ago");
    expect(result).not.toBe("just now");
  });
});
