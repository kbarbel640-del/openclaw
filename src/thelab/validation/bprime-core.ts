import { computeSliderMatchScore, summarizeBPrimeScores } from "./bprime-score.js";

export interface BPrimeCoreItem {
  imageId: string;
  truthDelta: Record<string, number>;
}

export interface BPrimePrediction {
  predictedDelta: Record<string, number>;
  hardFailReason?: string | null;
}

export interface BPrimeCoreResultRow {
  imageId: string;
  sliderMatch: number;
  hardFailReason: string | null;
}

export interface BPrimeCoreRunResult {
  summary: ReturnType<typeof summarizeBPrimeScores>;
  rows: BPrimeCoreResultRow[];
  outliers: Array<{ imageId: string; sliderMatch: number; reason: string }>;
}

export async function runBPrimeCore(params: {
  items: BPrimeCoreItem[];
  passThreshold: number;
  maxOutliers?: number;
  predict: (item: BPrimeCoreItem) => Promise<BPrimePrediction>;
}): Promise<BPrimeCoreRunResult> {
  const maxOutliers = params.maxOutliers ?? 10;
  const rows: BPrimeCoreResultRow[] = [];

  for (const item of params.items) {
    const pred = await params.predict(item);
    const hardFailReason = pred.hardFailReason ?? null;

    const match = hardFailReason
      ? { score: 0, perControl: {} as Record<string, unknown> }
      : computeSliderMatchScore({ predicted: pred.predictedDelta, truth: item.truthDelta });

    rows.push({
      imageId: item.imageId,
      sliderMatch: match.score,
      hardFailReason,
    });
  }

  const summary = summarizeBPrimeScores(
    rows.map((r) => ({
      imageId: r.imageId,
      sliderMatch: r.sliderMatch,
      hardFailReason: r.hardFailReason,
    })),
    { passThreshold: params.passThreshold },
  );

  const outliers = rows
    .toSorted((a, b) => a.sliderMatch - b.sliderMatch)
    .slice(0, maxOutliers)
    .map((r) => ({
      imageId: r.imageId,
      sliderMatch: r.sliderMatch,
      reason: r.hardFailReason ?? "low_slider_match",
    }));

  return { summary, rows, outliers };
}
