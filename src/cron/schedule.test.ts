import { describe, expect, it } from "vitest";
import { computeNextRunAtMs, hasMissedOccurrence } from "./schedule.js";

describe("cron schedule", () => {
  it("computes next run for cron expression with timezone", () => {
    // Saturday, Dec 13 2025 00:00:00Z
    const nowMs = Date.parse("2025-12-13T00:00:00.000Z");
    const next = computeNextRunAtMs(
      { kind: "cron", expr: "0 9 * * 3", tz: "America/Los_Angeles" },
      nowMs,
    );
    // Next Wednesday at 09:00 PST -> 17:00Z
    expect(next).toBe(Date.parse("2025-12-17T17:00:00.000Z"));
  });

  it("computes next run for every schedule", () => {
    const anchor = Date.parse("2025-12-13T00:00:00.000Z");
    const now = anchor + 10_000;
    const next = computeNextRunAtMs({ kind: "every", everyMs: 30_000, anchorMs: anchor }, now);
    expect(next).toBe(anchor + 30_000);
  });

  it("computes next run for every schedule when anchorMs is not provided", () => {
    const now = Date.parse("2025-12-13T00:00:00.000Z");
    const next = computeNextRunAtMs({ kind: "every", everyMs: 30_000 }, now);

    // Should return nowMs + everyMs, not nowMs (which would cause infinite loop)
    expect(next).toBe(now + 30_000);
  });

  it("advances when now matches anchor for every schedule", () => {
    const anchor = Date.parse("2025-12-13T00:00:00.000Z");
    const next = computeNextRunAtMs({ kind: "every", everyMs: 30_000, anchorMs: anchor }, anchor);
    expect(next).toBe(anchor + 30_000);
  });
});

describe("hasMissedOccurrence", () => {
  it("detects missed cron occurrence when gateway was down", () => {
    // Job last ran at Feb 5 05:00 SGT, now is Feb 9 06:23 SGT
    const lastRun = Date.parse("2026-02-05T05:00:00.000+08:00");
    const now = Date.parse("2026-02-09T06:23:00.000+08:00");
    const schedule = { kind: "cron" as const, expr: "0 5 * * *", tz: "Asia/Singapore" };
    expect(hasMissedOccurrence(schedule, lastRun, now)).toBe(true);
  });

  it("returns false when no occurrence was missed", () => {
    // Job last ran at Feb 9 05:00 SGT, now is Feb 9 06:23 SGT (no miss)
    const lastRun = Date.parse("2026-02-09T05:00:00.000+08:00");
    const now = Date.parse("2026-02-09T06:23:00.000+08:00");
    const schedule = { kind: "cron" as const, expr: "0 5 * * *", tz: "Asia/Singapore" };
    expect(hasMissedOccurrence(schedule, lastRun, now)).toBe(false);
  });

  it("returns false for one-shot (at) schedules", () => {
    const schedule = { kind: "at" as const, at: "2026-02-10T05:00:00.000+08:00" };
    expect(hasMissedOccurrence(schedule, 1000, 2000)).toBe(false);
  });

  it("detects missed every-interval occurrence", () => {
    const anchor = Date.parse("2026-02-01T00:00:00.000Z");
    const everyMs = 60_000; // every minute
    const lastRun = anchor + 60_000; // ran at minute 1
    const now = anchor + 180_000; // now at minute 3 — missed minute 2
    const schedule = { kind: "every" as const, everyMs, anchorMs: anchor };
    expect(hasMissedOccurrence(schedule, lastRun, now)).toBe(true);
  });

  it("returns false for every-interval when within same period", () => {
    const anchor = Date.parse("2026-02-01T00:00:00.000Z");
    const everyMs = 60_000; // every minute
    const lastRun = anchor + 60_000; // ran at minute 1
    const now = anchor + 90_000; // now at minute 1.5 — still in same interval
    const schedule = { kind: "every" as const, everyMs, anchorMs: anchor };
    expect(hasMissedOccurrence(schedule, lastRun, now)).toBe(false);
  });

  it("returns false when afterMs >= beforeMs", () => {
    const schedule = { kind: "cron" as const, expr: "0 5 * * *", tz: "Asia/Singapore" };
    expect(hasMissedOccurrence(schedule, 2000, 1000)).toBe(false);
    expect(hasMissedOccurrence(schedule, 1000, 1000)).toBe(false);
  });
});
