import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";

const hoisted = vi.hoisted(() => {
  const loadSessionCostSummaryMock = vi.fn();
  const loadCostUsageSummaryMock = vi.fn();
  return {
    loadSessionCostSummaryMock,
    loadCostUsageSummaryMock,
  };
});

vi.mock("../../infra/session-cost-usage.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../infra/session-cost-usage.js")>();
  return {
    ...actual,
    loadSessionCostSummary: hoisted.loadSessionCostSummaryMock,
    loadCostUsageSummary: hoisted.loadCostUsageSummaryMock,
  };
});

const { handleUsageCommand } = await import("./commands-session.js");
const { buildCommandTestParams } = await import("./commands.test-harness.js");

const baseCfg = {
  session: { mainKey: "main", scope: "per-sender" },
} satisfies OpenClawConfig;

describe("/usage cost", () => {
  beforeEach(() => {
    hoisted.loadSessionCostSummaryMock.mockReset();
    hoisted.loadCostUsageSummaryMock.mockReset();
  });

  it("includes a coverage note warning that deleted sessions are excluded", async () => {
    const today = new Date().toLocaleDateString("en-CA");
    hoisted.loadSessionCostSummaryMock.mockResolvedValue({
      totalCost: 0.05,
      totalTokens: 1234,
      missingCostEntries: 0,
    });
    hoisted.loadCostUsageSummaryMock.mockResolvedValue({
      updatedAt: Date.now(),
      days: 30,
      coverageNote:
        "Totals include only existing session transcripts; deleted sessions are excluded.",
      daily: [
        {
          date: today,
          input: 100,
          output: 200,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 300,
          totalCost: 0.02,
          inputCost: 0.01,
          outputCost: 0.01,
          cacheReadCost: 0,
          cacheWriteCost: 0,
          missingCostEntries: 0,
        },
      ],
      totals: {
        input: 500,
        output: 500,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 1000,
        totalCost: 0.08,
        inputCost: 0.04,
        outputCost: 0.04,
        cacheReadCost: 0,
        cacheWriteCost: 0,
        missingCostEntries: 0,
      },
    });

    const result = await handleUsageCommand(buildCommandTestParams("/usage cost", baseCfg), true);
    const text = result?.reply?.text ?? "";

    expect(text).toContain("💸 Usage cost");
    expect(text).toContain("Last 30d");
    expect(text).toContain(
      "Note: Totals include only existing session transcripts; deleted sessions are excluded.",
    );
  });
});
