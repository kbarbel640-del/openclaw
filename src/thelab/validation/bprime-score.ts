export type SliderDeltaMap = Record<string, number>;

export interface SliderMatchInput {
  predicted: SliderDeltaMap;
  truth: SliderDeltaMap;
  tolerances?: Record<string, number>;
  weights?: Record<string, number>;
}

export interface PerControlScore {
  predicted: number;
  truth: number;
  delta: number;
  tolerance: number;
  weight: number;
  score: number;
}

export interface SliderMatchScore {
  score: number; // 0..1
  perControl: Record<string, PerControlScore>;
}

export function computeSliderMatchScore(input: SliderMatchInput): SliderMatchScore {
  const tolerances = input.tolerances
    ? { ...DEFAULT_TOLERANCES, ...input.tolerances }
    : DEFAULT_TOLERANCES;
  const weights = input.weights ? { ...DEFAULT_WEIGHTS, ...input.weights } : DEFAULT_WEIGHTS;

  // Controlled set = union of tolerances keys and observed keys.
  const controls = new Set<string>([
    ...Object.keys(tolerances),
    ...Object.keys(input.predicted),
    ...Object.keys(input.truth),
  ]);

  const perControl: Record<string, PerControlScore> = {};
  let weightedSum = 0;
  let weightTotal = 0;

  for (const control of controls) {
    const predicted = input.predicted[control] ?? 0;
    const truth = input.truth[control] ?? 0;
    const delta = Math.abs(predicted - truth);

    const tolerance = tolerances[control] ?? DEFAULT_FALLBACK_TOLERANCE;
    const weight = weights[control] ?? DEFAULT_FALLBACK_WEIGHT;

    // score_s = clamp(1 - delta / tolerance, 0..1)
    const raw = tolerance > 0 ? 1 - delta / tolerance : 0;
    const score = clamp01(raw);

    perControl[control] = {
      predicted,
      truth,
      delta,
      tolerance,
      weight,
      score,
    };

    weightedSum += score * weight;
    weightTotal += weight;
  }

  const overall = weightTotal > 0 ? weightedSum / weightTotal : 0;
  return {
    score: roundTo(overall, 6),
    perControl,
  };
}

export interface BPrimeScoredImageSummary {
  imageId: string;
  sliderMatch: number;
  hardFailReason: string | null;
}

export interface BPrimeScoreSummary {
  total: number;
  passed: number;
  failed: number;
  passRate: number; // 0..1
  passThreshold: number;
}

export function summarizeBPrimeScores(
  images: BPrimeScoredImageSummary[],
  opts: { passThreshold: number },
): BPrimeScoreSummary {
  const total = images.length;
  let passed = 0;

  for (const img of images) {
    if (img.hardFailReason) {
      continue;
    }
    if (img.sliderMatch >= opts.passThreshold) {
      passed++;
    }
  }

  const failed = total - passed;
  return {
    total,
    passed,
    failed,
    passRate: total > 0 ? passed / total : 0,
    passThreshold: opts.passThreshold,
  };
}

const DEFAULT_FALLBACK_TOLERANCE = 5;
const DEFAULT_FALLBACK_WEIGHT = 1;

// Conservative defaults, aligned with the validation design doc.
export const DEFAULT_TOLERANCES: Record<string, number> = {
  exposure: 0.1,
  temp: 150,
  tint: 5,
  highlights: 8,
  shadows: 8,
  whites: 8,
  blacks: 8,
  contrast: 8,
  texture: 5,
  clarity: 5,
  dehaze: 5,
  vibrance: 6,
  saturation: 6,
  grain_amount: 5,
  vignette_amount: 6,
};

export const DEFAULT_WEIGHTS: Record<string, number> = {
  // Primary
  exposure: 5,
  temp: 5,
  tint: 4,
  highlights: 4,
  shadows: 4,
  // Secondary
  whites: 3,
  blacks: 3,
  contrast: 3,
  vibrance: 2,
  // Tertiary
  texture: 1,
  clarity: 1,
  dehaze: 1,
  saturation: 1,
  grain_amount: 1,
  vignette_amount: 1,
};

function clamp01(v: number): number {
  if (v < 0) {
    return 0;
  }
  if (v > 1) {
    return 1;
  }
  return v;
}

function roundTo(v: number, decimals: number): number {
  const p = 10 ** decimals;
  return Math.round(v * p) / p;
}
