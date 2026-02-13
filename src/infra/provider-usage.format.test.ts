import { describe, expect, it } from "vitest";
import {
  formatUsageWindowSummary,
  formatUsageSummaryLine,
  formatUsageReportLines,
} from "./provider-usage.format.js";

const now = Date.now();

describe("formatUsageWindowSummary", () => {
  it("returns null for error snapshot", () => {
    expect(formatUsageWindowSummary({ error: "failed", windows: [] } as any)).toBeNull();
  });

  it("returns null for no windows", () => {
    expect(formatUsageWindowSummary({ windows: [] } as any)).toBeNull();
  });

  it("formats single window", () => {
    const snapshot = {
      windows: [{ label: "daily", usedPercent: 30 }],
    };
    const result = formatUsageWindowSummary(snapshot as any, { now });
    expect(result).toContain("daily");
    expect(result).toContain("70% left");
  });

  it("formats multiple windows", () => {
    const snapshot = {
      windows: [
        { label: "daily", usedPercent: 20 },
        { label: "monthly", usedPercent: 50 },
      ],
    };
    const result = formatUsageWindowSummary(snapshot as any, { now });
    expect(result).toContain("daily");
    expect(result).toContain("monthly");
    expect(result).toContain("·");
  });

  it("respects maxWindows", () => {
    const snapshot = {
      windows: [
        { label: "daily", usedPercent: 20 },
        { label: "monthly", usedPercent: 50 },
      ],
    };
    const result = formatUsageWindowSummary(snapshot as any, { now, maxWindows: 1 });
    expect(result).toContain("daily");
    expect(result).not.toContain("monthly");
  });
});

describe("formatUsageSummaryLine", () => {
  it("returns null for empty providers", () => {
    expect(formatUsageSummaryLine({ providers: [] } as any)).toBeNull();
  });

  it("returns null when all providers have errors", () => {
    const summary = {
      providers: [{ displayName: "Claude", error: "oops", windows: [] }],
    };
    expect(formatUsageSummaryLine(summary as any)).toBeNull();
  });

  it("formats provider with usage", () => {
    const summary = {
      providers: [
        {
          displayName: "Claude",
          windows: [{ label: "daily", usedPercent: 40 }],
        },
      ],
    };
    const result = formatUsageSummaryLine(summary as any, { now });
    expect(result).toContain("Claude");
    expect(result).toContain("60% left");
  });
});

describe("formatUsageReportLines", () => {
  it("returns fallback for no providers", () => {
    const lines = formatUsageReportLines({ providers: [] } as any);
    expect(lines[0]).toContain("no provider usage");
  });

  it("formats provider with error", () => {
    const summary = {
      providers: [{ displayName: "Claude", error: "auth failed", windows: [] }],
    };
    const lines = formatUsageReportLines(summary as any);
    expect(lines.some((l) => l.includes("auth failed"))).toBe(true);
  });

  it("formats provider with no data", () => {
    const summary = {
      providers: [{ displayName: "Claude", windows: [] }],
    };
    const lines = formatUsageReportLines(summary as any);
    expect(lines.some((l) => l.includes("no data"))).toBe(true);
  });

  it("formats provider with windows", () => {
    const summary = {
      providers: [
        {
          displayName: "Claude",
          plan: "Pro",
          windows: [{ label: "daily", usedPercent: 25 }],
        },
      ],
    };
    const lines = formatUsageReportLines(summary as any, { now });
    expect(lines.some((l) => l.includes("Claude") && l.includes("Pro"))).toBe(true);
    expect(lines.some((l) => l.includes("75% left"))).toBe(true);
  });
});
