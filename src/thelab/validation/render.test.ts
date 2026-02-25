import { describe, expect, test } from "vitest";
import type { CoverageCoherenceReport } from "./coverage-report.js";
import { renderCoverageCoherenceMarkdown, renderAccuracySheetHtml } from "./render.js";

describe("validation renderers", () => {
  test("renders a coverage/coherence markdown report with totals and scenario rows", () => {
    const report: CoverageCoherenceReport = {
      generatedAt: "2026-02-19T00:00:00.000Z",
      totals: {
        totalEdits: 26,
        scenarioCount: 2,
        highConfidenceScenarioCount: 1,
      },
      scenarios: [
        {
          key: "golden_hour::outdoor::natural_bright::portrait",
          label: "Golden hour / Outdoor / Natural / Portrait",
          sampleCount: 20,
          confidence: "high",
          varianceWarnings: [],
          topCorrelations: [
            { controlA: "shadows", controlB: "highlights", correlation: -0.82, sampleCount: 18 },
          ],
        },
        {
          key: "night::indoor::flash::group",
          label: "Night / Indoor / Flash / Group",
          sampleCount: 6,
          confidence: "moderate",
          varianceWarnings: ["exposure varies widely (std dev 2.00)"],
          topCorrelations: [],
        },
      ],
    };

    const md = renderCoverageCoherenceMarkdown(report);
    expect(md).toContain("Validation A — Coverage + Coherence");
    expect(md).toContain("Total edits analyzed: 26");
    expect(md).toContain("Scenarios: 2");
    expect(md).toContain("HIGH confidence: 1");
    expect(md).toContain("golden_hour::outdoor::natural_bright::portrait");
    expect(md).toContain("exposure varies widely");
  });

  test("renders an accuracy sheet HTML skeleton", () => {
    const html = renderAccuracySheetHtml({
      generatedAt: "2026-02-19T00:00:00.000Z",
      totalEdits: 26,
      scenarioCount: 2,
      highConfidenceScenarioCount: 1,
      note: "Coverage + coherence only (no PASS_RATE yet)",
    });

    expect(html).toContain("Sophie — Accuracy Sheet");
    expect(html).toContain("Total edits");
    expect(html).toContain("26");
    expect(html).toContain("Coverage + coherence only");
  });
});
