import { describe, expect, it } from "vitest";
import { computeNextRunAtMs } from "./schedule.js";

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

  it("returns atMs for at schedule when in the future", () => {
    const now = Date.parse("2025-12-13T00:00:00.000Z");
    const atMs = now + 60_000;
    const next = computeNextRunAtMs({ kind: "at", atMs }, now);
    expect(next).toBe(atMs);
  });

  it("returns undefined for at schedule when atMs is in the past", () => {
    const now = Date.parse("2025-12-13T00:00:00.000Z");
    const atMs = now - 60_000;
    const next = computeNextRunAtMs({ kind: "at", atMs }, now);
    expect(next).toBeUndefined();
  });

  it("returns undefined for at schedule when atMs equals now", () => {
    const now = Date.parse("2025-12-13T00:00:00.000Z");
    const next = computeNextRunAtMs({ kind: "at", atMs: now }, now);
    expect(next).toBeUndefined();
  });
});
