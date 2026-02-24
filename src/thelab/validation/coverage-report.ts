import type { StyleDatabase } from "../learning/style-db.js";
import type { SliderCorrelation } from "../learning/style-db.js";

export type ConfidenceLevel = "high" | "good" | "moderate" | "low";

export interface CoverageScenarioSummary {
  key: string;
  label: string;
  sampleCount: number;
  confidence: ConfidenceLevel;
  varianceWarnings: string[];
  topCorrelations: Array<{
    controlA: string;
    controlB: string;
    correlation: number;
    sampleCount: number;
  }>;
}

export interface CoverageTotals {
  totalEdits: number;
  scenarioCount: number;
  highConfidenceScenarioCount: number;
}

export interface CoverageCoherenceReport {
  generatedAt: string;
  totals: CoverageTotals;
  scenarios: CoverageScenarioSummary[];
}

export interface CoverageCoherenceOptions {
  highConfidenceSamples?: number;
  goodConfidenceSamples?: number;
  moderateConfidenceSamples?: number;
  /**
   * If any control in the scenario has std dev >= this threshold,
   * we emit a variance warning. Conservative by default.
   */
  stdDevWarningThreshold?: number;
  /**
   * Only warn on variance once we have at least this many samples.
   */
  minSamplesForVarianceWarning?: number;
  maxCorrelationsPerScenario?: number;
}

export function computeCoverageCoherence(
  db: StyleDatabase,
  opts: CoverageCoherenceOptions = {},
): CoverageCoherenceReport {
  const high = opts.highConfidenceSamples ?? 20;
  const good = opts.goodConfidenceSamples ?? 10;
  const moderate = opts.moderateConfidenceSamples ?? 3;
  const stdDevWarn = opts.stdDevWarningThreshold ?? 1.0;
  const minWarnSamples = opts.minSamplesForVarianceWarning ?? 5;
  const maxCorr = opts.maxCorrelationsPerScenario ?? 5;

  const scenarios = db.listScenarios();
  const totalEdits = db.getEditCount();

  const summaries: CoverageScenarioSummary[] = scenarios.map((s) => {
    const confidence: ConfidenceLevel =
      s.sampleCount >= high
        ? "high"
        : s.sampleCount >= good
          ? "good"
          : s.sampleCount >= moderate
            ? "moderate"
            : "low";

    const profile = db.getProfile(s.key);
    const varianceWarnings: string[] = [];
    const topCorrelations = pickTopCorrelations(profile?.correlations ?? [], maxCorr);

    if (profile && s.sampleCount >= minWarnSamples) {
      // Minimal coherence check: warn if any slider has unusually high variance.
      // This is intentionally conservative and will be refined in B'/C validation.
      for (const [control, stats] of Object.entries(profile.adjustments)) {
        if (Number.isFinite(stats.stdDev) && stats.stdDev >= stdDevWarn) {
          varianceWarnings.push(`${control} varies widely (std dev ${stats.stdDev.toFixed(2)})`);
        }
      }
    }

    return {
      key: s.key,
      label: s.label,
      sampleCount: s.sampleCount,
      confidence,
      varianceWarnings,
      topCorrelations: topCorrelations.map((c) => ({
        controlA: c.controlA,
        controlB: c.controlB,
        correlation: c.correlation,
        sampleCount: c.sampleCount,
      })),
    };
  });

  const highConfidenceScenarioCount = summaries.filter((s) => s.confidence === "high").length;

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      totalEdits,
      scenarioCount: summaries.length,
      highConfidenceScenarioCount,
    },
    scenarios: summaries,
  };
}

function pickTopCorrelations(corr: SliderCorrelation[], max: number): SliderCorrelation[] {
  if (corr.length <= max) {
    return corr;
  }
  return corr.slice(0, max);
}
