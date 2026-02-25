/**
 * Composite Ranking Pass — Final cull ranking
 *
 * Combines multiple signals into a single score for each image:
 *   - IQA aesthetic score (visual quality)
 *   - Face quality (sharpness, eyes open, orientation)
 *   - EXIF data (exposure correctness, motion blur risk)
 *   - Uniqueness (penalize duplicates)
 *
 * The composite score determines the final cull verdict.
 */

import type { DuplicateGroup } from "./duplicate-detector.js";
import type { FaceDetectionResult } from "./face-detector.js";
import { faceQualityScore } from "./face-detector.js";
import type { QualityAssessment } from "./quality-pass.js";

export interface RankedImage {
  imagePath: string;
  compositeScore: number;
  breakdown: ScoreBreakdown;
  verdict: "pick" | "maybe" | "reject";
  reasons: string[];
}

export interface ScoreBreakdown {
  aestheticScore: number;
  technicalScore: number;
  faceScore: number;
  uniquenessScore: number;
}

/** Weights for each score component */
const WEIGHTS = {
  aesthetic: 0.3,
  technical: 0.3,
  face: 0.25,
  uniqueness: 0.15,
};

/** Verdict thresholds */
const PICK_THRESHOLD = 0.55;
const REJECT_THRESHOLD = 0.25;

/**
 * Rank a set of images using all available quality signals.
 */
export function rankImages(
  qualityAssessments: Map<string, QualityAssessment>,
  faceResults: Map<string, FaceDetectionResult>,
  duplicateGroups: DuplicateGroup[],
): RankedImage[] {
  // Build a set of images that are duplicates (not the best in their group)
  const duplicateInferiors = new Set<string>();
  for (const group of duplicateGroups) {
    for (const member of group.images) {
      if (!member.isBest) {
        duplicateInferiors.add(member.imagePath);
      }
    }
  }

  const ranked: RankedImage[] = [];

  for (const [imagePath, quality] of qualityAssessments) {
    const faceResult = faceResults.get(imagePath);
    const isDuplicateInferior = duplicateInferiors.has(imagePath);

    const breakdown = computeBreakdown(quality, faceResult, isDuplicateInferior);
    const compositeScore = computeCompositeScore(breakdown);
    const reasons = collectReasons(quality, faceResult, isDuplicateInferior);
    const verdict = determineVerdict(compositeScore, isDuplicateInferior);

    ranked.push({
      imagePath,
      compositeScore,
      breakdown,
      verdict,
      reasons,
    });
  }

  // Sort by composite score descending
  ranked.sort((a, b) => b.compositeScore - a.compositeScore);

  return ranked;
}

function computeBreakdown(
  quality: QualityAssessment,
  faceResult: FaceDetectionResult | undefined,
  isDuplicateInferior: boolean,
): ScoreBreakdown {
  // Aesthetic score: normalize from 1-10 to 0-1
  const aestheticScore = quality.aestheticScore !== null ? (quality.aestheticScore - 1) / 9 : 0.5;

  // Technical score: from IQA overall
  const technicalScore = quality.overallScore;

  // Face score: from face detector
  const faceScore = faceResult ? faceQualityScore(faceResult) : 0.7;

  // Uniqueness score: penalize duplicate inferiors
  const uniquenessScore = isDuplicateInferior ? 0.2 : 1.0;

  return {
    aestheticScore,
    technicalScore,
    faceScore,
    uniquenessScore,
  };
}

function computeCompositeScore(breakdown: ScoreBreakdown): number {
  const score =
    breakdown.aestheticScore * WEIGHTS.aesthetic +
    breakdown.technicalScore * WEIGHTS.technical +
    breakdown.faceScore * WEIGHTS.face +
    breakdown.uniquenessScore * WEIGHTS.uniqueness;

  return Math.max(0, Math.min(1, score));
}

function collectReasons(
  quality: QualityAssessment,
  faceResult: FaceDetectionResult | undefined,
  isDuplicateInferior: boolean,
): string[] {
  const reasons: string[] = [];

  // Quality reasons
  reasons.push(...quality.reasons);

  // Face reasons
  if (faceResult && faceResult.faceCount > 0) {
    for (const face of faceResult.faces) {
      if (face.eyeOpenness !== null && face.eyeOpenness < 0.01) {
        reasons.push(`Face ${face.faceId}: eyes likely closed`);
      }
      if (face.sharpness < 100) {
        reasons.push(`Face ${face.faceId}: low face sharpness (${face.sharpness.toFixed(0)})`);
      }
      if (face.orientation) {
        if (Math.abs(face.orientation.yaw) > 45) {
          reasons.push(`Face ${face.faceId}: extreme head turn`);
        }
      }
    }
  }

  // Duplicate reasons
  if (isDuplicateInferior) {
    reasons.push("Inferior duplicate — a better version exists in the same group");
  }

  return reasons;
}

function determineVerdict(
  compositeScore: number,
  isDuplicateInferior: boolean,
): "pick" | "maybe" | "reject" {
  if (isDuplicateInferior && compositeScore < PICK_THRESHOLD) {
    return "reject";
  }

  if (compositeScore >= PICK_THRESHOLD) {
    return "pick";
  }

  if (compositeScore < REJECT_THRESHOLD) {
    return "reject";
  }

  return "maybe";
}
