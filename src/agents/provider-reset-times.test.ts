import { describe, expect, it } from "vitest";
import {
  getResetSchedule,
  msUntilReset,
  formatResetCountdown,
} from "./provider-reset-times.js";

describe("provider-reset-times", () => {
  describe("getResetSchedule", () => {
    it("returns daily schedule for Venice", () => {
      const schedule = getResetSchedule("venice");
      expect(schedule).toEqual({ kind: "daily", utcHour: 0 });
    });

    it("returns daily schedule for Venice (case-insensitive)", () => {
      expect(getResetSchedule("Venice")).toEqual({ kind: "daily", utcHour: 0 });
      expect(getResetSchedule("VENICE")).toEqual({ kind: "daily", utcHour: 0 });
      expect(getResetSchedule("venice.ai")).toEqual({ kind: "daily", utcHour: 0 });
    });

    it("returns monthly schedule for OpenAI", () => {
      expect(getResetSchedule("openai")).toEqual({ kind: "monthly", dayOfMonth: 1, utcHour: 0 });
    });

    it("returns monthly schedule for Anthropic", () => {
      expect(getResetSchedule("anthropic")).toEqual({ kind: "monthly", dayOfMonth: 1, utcHour: 0 });
    });

    it("returns none for Morpheus (free beta)", () => {
      expect(getResetSchedule("mor-gateway")).toEqual({ kind: "none" });
      expect(getResetSchedule("morpheus")).toEqual({ kind: "none" });
    });

    it("returns none for unknown providers", () => {
      expect(getResetSchedule("some-random-provider")).toEqual({ kind: "none" });
    });
  });

  describe("msUntilReset", () => {
    it("returns null for unknown providers", () => {
      expect(msUntilReset("unknown", Date.now())).toBeNull();
    });

    it("returns null for providers with no schedule", () => {
      expect(msUntilReset("mor-gateway", Date.now())).toBeNull();
    });

    it("calculates time until midnight UTC for Venice", () => {
      // 2026-02-27 18:00:00 UTC = 6 hours before midnight
      const now = Date.UTC(2026, 1, 27, 18, 0, 0);
      const ms = msUntilReset("venice", now);
      expect(ms).toBe(6 * 60 * 60 * 1000); // 6 hours
    });

    it("calculates correctly when just past midnight UTC", () => {
      // 2026-02-27 00:01:00 UTC = just past midnight, ~24h until next reset
      const now = Date.UTC(2026, 1, 27, 0, 1, 0);
      const ms = msUntilReset("venice", now);
      // Should be ~23h 59m
      expect(ms).toBeGreaterThan(23 * 60 * 60 * 1000);
      expect(ms).toBeLessThan(24 * 60 * 60 * 1000);
    });

    it("calculates monthly reset for OpenAI", () => {
      // 2026-02-15 12:00:00 UTC = mid-month, should reset on March 1
      const now = Date.UTC(2026, 1, 15, 12, 0, 0);
      const ms = msUntilReset("openai", now);
      const expectedReset = Date.UTC(2026, 2, 1, 0, 0, 0); // March 1
      expect(ms).toBe(expectedReset - now);
    });

    it("wraps to next month when past the reset day", () => {
      // 2026-02-02 00:00:00 UTC = just past the 1st
      const now = Date.UTC(2026, 1, 2, 0, 0, 0);
      const ms = msUntilReset("openai", now);
      const expectedReset = Date.UTC(2026, 2, 1, 0, 0, 0); // March 1
      expect(ms).toBe(expectedReset - now);
    });
  });

  describe("formatResetCountdown", () => {
    it("returns null for unknown providers", () => {
      expect(formatResetCountdown("unknown")).toBeNull();
    });

    it("formats hours and minutes for Venice", () => {
      // 6 hours before midnight UTC
      const now = Date.UTC(2026, 1, 27, 18, 0, 0);
      expect(formatResetCountdown("venice", now)).toBe("resets in 6h 0m");
    });

    it("formats minutes only when under an hour", () => {
      // 30 minutes before midnight UTC
      const now = Date.UTC(2026, 1, 27, 23, 30, 0);
      expect(formatResetCountdown("venice", now)).toBe("resets in 30m");
    });

    it("formats days for long waits", () => {
      // Feb 2 — 27 days until March 1 reset
      const now = Date.UTC(2026, 1, 2, 0, 0, 0);
      const result = formatResetCountdown("openai", now);
      expect(result).toMatch(/resets in \d+d \d+h/);
    });
  });
});
