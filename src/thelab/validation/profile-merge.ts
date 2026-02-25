import type { ScenarioProfile, AdjustmentStats } from "../learning/style-db.js";
import type { AdjustmentEntryType, ImageAnalysisResultType } from "../vision/schema.js";

/**
 * Convert a scenario profile into baseline adjustments.
 * Mirrors `EditingLoop.profileToAdjustments`.
 */
export function profileToAdjustments(profile: ScenarioProfile): AdjustmentEntryType[] {
  const adjustments: AdjustmentEntryType[] = [];

  for (const [control, stats] of Object.entries(profile.adjustments)) {
    // Skip adjustments with very high variance (photographer is inconsistent)
    if (stats.stdDev > Math.abs(stats.median) * 2 && stats.sampleCount < 10) {
      continue;
    }

    // Skip near-zero adjustments
    if (Math.abs(stats.median) < 0.5) {
      continue;
    }

    const confidence = computeProfileConfidence(stats);

    adjustments.push({
      control: control as AdjustmentEntryType["control"],
      current_estimate: 0,
      target_delta: stats.median,
      confidence,
    });
  }

  return adjustments;
}

/**
 * Merge profile-based baseline adjustments with vision refinements.
 * Mirrors `EditingLoop.mergeProfileWithVision`.
 */
export function mergeProfileWithVision(
  profileAdj: AdjustmentEntryType[],
  visionAnalysis: ImageAnalysisResultType,
): ImageAnalysisResultType {
  const merged = new Map<string, AdjustmentEntryType>();

  for (const adj of profileAdj) {
    merged.set(adj.control, { ...adj });
  }

  for (const vAdj of visionAnalysis.adjustments) {
    const existing = merged.get(vAdj.control);
    if (existing) {
      const blendedDelta = existing.target_delta * 0.6 + vAdj.target_delta * 0.4;
      const blendedConfidence = existing.confidence * 0.5 + vAdj.confidence * 0.5;

      merged.set(vAdj.control, {
        ...existing,
        target_delta: blendedDelta,
        confidence: blendedConfidence,
        current_estimate: vAdj.current_estimate,
      });
    } else {
      merged.set(vAdj.control, {
        ...vAdj,
        confidence: vAdj.confidence * 0.7,
      });
    }
  }

  const avgConfidence =
    merged.size > 0
      ? [...merged.values()].reduce((sum, a) => sum + a.confidence, 0) / merged.size
      : 0;

  return {
    image_id: visionAnalysis.image_id,
    confidence: Math.min(avgConfidence, visionAnalysis.confidence),
    adjustments: [...merged.values()],
    flag_for_review: visionAnalysis.flag_for_review,
    flag_reason: visionAnalysis.flag_reason,
    reasoning: visionAnalysis.reasoning,
  };
}

function computeProfileConfidence(stats: AdjustmentStats): number {
  const sampleFactor = Math.min(stats.sampleCount / 20, 1.0);
  const consistencyFactor =
    stats.stdDev > 0 ? Math.max(0, 1 - stats.stdDev / (Math.abs(stats.median) + 1)) : 1.0;
  return Math.min(0.95, sampleFactor * 0.6 + consistencyFactor * 0.4);
}
