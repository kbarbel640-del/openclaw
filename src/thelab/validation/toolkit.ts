import { StyleDatabase } from "../learning/style-db.js";
import type { CoverageCoherenceOptions, CoverageCoherenceReport } from "./coverage-report.js";
import { computeCoverageCoherence } from "./coverage-report.js";
import { renderAccuracySheetHtml, renderCoverageCoherenceMarkdown } from "./render.js";

export interface CoverageArtifacts {
  report: CoverageCoherenceReport;
  markdown: string;
  canvas: {
    html: string;
    width: number;
    height: number;
    note: string;
  };
}

export function generateCoverageArtifacts(
  dbPath: string,
  opts: CoverageCoherenceOptions = {},
): CoverageArtifacts {
  const db = new StyleDatabase(dbPath);
  try {
    const report = computeCoverageCoherence(db, opts);
    const markdown = renderCoverageCoherenceMarkdown(report);

    const note = "Coverage + coherence only (no PASS_RATE yet)";
    const html = renderAccuracySheetHtml({
      generatedAt: report.generatedAt,
      totalEdits: report.totals.totalEdits,
      scenarioCount: report.totals.scenarioCount,
      highConfidenceScenarioCount: report.totals.highConfidenceScenarioCount,
      note,
    });

    return {
      report,
      markdown,
      canvas: {
        html,
        width: 520,
        height: 360,
        note,
      },
    };
  } finally {
    db.close();
  }
}
