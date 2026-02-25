import type { ImageAnalysisResultType } from "../vision/schema.js";

export interface GateResult {
  pass: boolean;
  reason: string | null;
}

/**
 * Confidence gating for the editing loop.
 * Determines whether an image should be edited or flagged for human review.
 */
export function evaluateGate(
  analysis: ImageAnalysisResultType,
  confidenceThreshold: number,
): GateResult {
  if (analysis.flag_for_review) {
    return {
      pass: false,
      reason: analysis.flag_reason ?? "Vision model flagged for review",
    };
  }

  if (analysis.confidence < confidenceThreshold) {
    return {
      pass: false,
      reason: `Overall confidence ${analysis.confidence.toFixed(2)} below threshold ${confidenceThreshold}`,
    };
  }

  if (analysis.adjustments.length === 0) {
    return {
      pass: false,
      reason: "No adjustments identified — image may already match target or analysis failed",
    };
  }

  const lowConfidenceAdj = analysis.adjustments.filter((a) => a.confidence < 0.5);
  if (lowConfidenceAdj.length > analysis.adjustments.length * 0.5) {
    return {
      pass: false,
      reason: `Too many low-confidence adjustments (${lowConfidenceAdj.length}/${analysis.adjustments.length} below 0.5)`,
    };
  }

  return { pass: true, reason: null };
}

/**
 * Filter adjustments to only include those above a minimum confidence.
 * Removes adjustments the model is unsure about.
 */
export function filterConfidentAdjustments(
  analysis: ImageAnalysisResultType,
  minAdjustmentConfidence = 0.6,
  maxAdjustments = 8,
): ImageAnalysisResultType {
  const filtered = analysis.adjustments
    .filter((a) => a.confidence >= minAdjustmentConfidence)
    .slice(0, maxAdjustments);

  return {
    ...analysis,
    adjustments: filtered,
  };
}
