/**
 * Enhanced Quality Pass — IQA-based quality assessment for culling
 *
 * Uses the IQA scorer to provide objective quality metrics:
 *   - Blur detection via sharpness score
 *   - Exposure assessment via brightness + technical quality
 *   - Noise assessment via noisiness score
 *
 * Replaces the EXIF-only heuristics with actual image content analysis.
 */

import { scoreImage } from "../iqa/iqa-scorer.js";
import type { IqaResult, IqaScorerConfig } from "../iqa/iqa-scorer.js";

export interface QualityAssessment {
  imagePath: string;
  /** Overall quality score (0-1) */
  overallScore: number;
  /** Aesthetic score (1-10) */
  aestheticScore: number | null;
  /** Whether the image has focus/blur issues */
  isBlurry: boolean;
  /** Whether the image has exposure problems */
  hasExposureIssue: boolean;
  /** Whether the image has excessive noise */
  isNoisy: boolean;
  /** Human-readable assessment reasons */
  reasons: string[];
  /** Raw IQA data for detailed analysis */
  rawIqa: IqaResult | null;
}

/** Thresholds for quality assessment */
const SHARPNESS_BLUR_THRESHOLD = 0.3;
const BRIGHTNESS_LOW_THRESHOLD = 0.2;
const BRIGHTNESS_HIGH_THRESHOLD = 0.85;
const NOISINESS_THRESHOLD = 0.6;
const QUALITY_REJECT_THRESHOLD = 0.25;

/**
 * Run IQA-based quality assessment on a single image.
 */
export async function assessQuality(
  imagePath: string,
  iqaConfig: IqaScorerConfig,
): Promise<QualityAssessment> {
  const fallback: QualityAssessment = {
    imagePath,
    overallScore: 0.5,
    aestheticScore: null,
    isBlurry: false,
    hasExposureIssue: false,
    isNoisy: false,
    reasons: [],
    rawIqa: null,
  };

  if (!iqaConfig.enabled) {
    return fallback;
  }

  let iqaResult: IqaResult;
  try {
    iqaResult = await scoreImage(imagePath, iqaConfig);
  } catch {
    return fallback;
  }

  if (iqaResult.error) {
    return { ...fallback, reasons: [`IQA error: ${iqaResult.error}`] };
  }

  const reasons: string[] = [];
  let isBlurry = false;
  let hasExposureIssue = false;
  let isNoisy = false;

  // Sharpness / blur check
  const sharpness = iqaResult.clipIqa.sharpness;
  if (sharpness !== null && sharpness < SHARPNESS_BLUR_THRESHOLD) {
    isBlurry = true;
    reasons.push(`Low sharpness (${sharpness.toFixed(3)}) — likely out of focus or motion blur`);
  }

  // Brightness / exposure check
  const brightness = iqaResult.clipIqa.brightness;
  if (brightness !== null) {
    if (brightness < BRIGHTNESS_LOW_THRESHOLD) {
      hasExposureIssue = true;
      reasons.push(`Very dark image (brightness: ${brightness.toFixed(3)}) — likely underexposed`);
    } else if (brightness > BRIGHTNESS_HIGH_THRESHOLD) {
      hasExposureIssue = true;
      reasons.push(`Very bright image (brightness: ${brightness.toFixed(3)}) — likely overexposed`);
    }
  }

  // Noise check
  const noisiness = iqaResult.clipIqa.noisiness;
  if (noisiness !== null && noisiness > NOISINESS_THRESHOLD) {
    isNoisy = true;
    reasons.push(`High noise level (${noisiness.toFixed(3)})`);
  }

  // Compute overall score
  let overallScore = iqaResult.technicalQuality ?? 0.5;

  // Penalize for detected issues
  if (isBlurry) {
    overallScore *= 0.5;
  }
  if (hasExposureIssue) {
    overallScore *= 0.7;
  }
  if (isNoisy) {
    overallScore *= 0.8;
  }

  overallScore = Math.max(0, Math.min(1, overallScore));

  return {
    imagePath,
    overallScore,
    aestheticScore: iqaResult.aestheticScore,
    isBlurry,
    hasExposureIssue,
    isNoisy,
    reasons,
    rawIqa: iqaResult,
  };
}

/**
 * Batch quality assessment for multiple images.
 */
export async function assessQualityBatch(
  imagePaths: string[],
  iqaConfig: IqaScorerConfig,
  onProgress?: (completed: number, total: number) => void,
): Promise<QualityAssessment[]> {
  const results: QualityAssessment[] = [];

  for (let i = 0; i < imagePaths.length; i++) {
    const assessment = await assessQuality(imagePaths[i], iqaConfig);
    results.push(assessment);
    onProgress?.(i + 1, imagePaths.length);
  }

  return results;
}

/**
 * Quick reject check — should this image be rejected based on quality?
 */
export function shouldReject(assessment: QualityAssessment): boolean {
  if (assessment.isBlurry && assessment.overallScore < QUALITY_REJECT_THRESHOLD) {
    return true;
  }
  if (assessment.hasExposureIssue && assessment.isBlurry && assessment.overallScore < 0.35) {
    return true;
  }
  return false;
}
