import type { ScenarioProfile } from "../learning/style-db.js";
import { runBPrimeCore } from "./bprime-core.js";
import { writeProfileTargetFile } from "./profile-target.js";
import { resolveVisionInput } from "./vision-input.js";

export interface BPrimeValidationResult {
  summary: {
    total: number;
    passed: number;
    failed: number;
    passRate: number;
    passThreshold: number;
  };
  rows: Array<{
    imageId: string;
    sliderMatch: number;
    hardFailReason: string | null;
    visionInputKind: "screen_capture" | "disk_fallback" | "none";
  }>;
  outliers: Array<{ imageId: string; sliderMatch: number; reason: string }>;
}

export async function runBPrimeValidation(
  params: {
    imagePaths: string[];
    passThreshold: number;
    profileTargetDir?: string;
    maxOutliers?: number;
  },
  deps: {
    getImageId: (imagePath: string) => Promise<string>;
    getTruthDeltaForPath: (imagePath: string) => Promise<Record<string, number>>;
    getProfileForPath: (imagePath: string) => Promise<ScenarioProfile | null>;
    captureScreen: (label: string) => Promise<string>;
    /**
     * Returns predicted deltas keyed by Lightroom control.
     * This is intentionally generic so tests can stub it and the real runner can
     * use VisionTool output.
     */
    analyze: (input: {
      imageId: string;
      imagePath: string;
      visionPath: string;
      targetPath: string;
      profile: ScenarioProfile;
    }) => Promise<Record<string, number>>;
  },
): Promise<BPrimeValidationResult> {
  const profileTargetDir = params.profileTargetDir ?? "/tmp";

  // Pre-build items to score (truth deltas are deterministic).
  const items = await Promise.all(
    params.imagePaths.map(async (imagePath) => {
      const imageId = await deps.getImageId(imagePath);
      try {
        const truthDelta = await deps.getTruthDeltaForPath(imagePath);
        return { imageId, truthDelta, imagePath, truthHardFail: null as string | null };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          imageId,
          truthDelta: {} as Record<string, number>,
          imagePath,
          truthHardFail: `truth_missing:${msg}`,
        };
      }
    }),
  );

  const core = await runBPrimeCore({
    items: items.map((i) => ({ imageId: i.imageId, truthDelta: i.truthDelta })),
    passThreshold: params.passThreshold,
    maxOutliers: params.maxOutliers,
    predict: async (item) => {
      const full = items.find((i) => i.imageId === item.imageId);
      if (!full) {
        return { predictedDelta: {}, hardFailReason: "internal_missing_item" };
      }

      if (full.truthHardFail) {
        return { predictedDelta: {}, hardFailReason: full.truthHardFail };
      }

      const profile = await deps.getProfileForPath(full.imagePath);
      if (!profile) {
        return { predictedDelta: {}, hardFailReason: "no_profile" };
      }

      const targetPath = await writeProfileTargetFile(profileTargetDir, profile);

      let visionPath: string;
      try {
        const visionInput = await resolveVisionInput({
          label: `bprime_${full.imageId}`,
          captureScreen: deps.captureScreen,
          fallbackImagePath: full.imagePath,
        });
        visionPath = visionInput.path;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { predictedDelta: {}, hardFailReason: `cannot_resolve_pixels:${msg}` };
      }

      try {
        const predictedDelta = await deps.analyze({
          imageId: full.imageId,
          imagePath: full.imagePath,
          visionPath,
          targetPath,
          profile,
        });

        return { predictedDelta };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { predictedDelta: {}, hardFailReason: `vision_analyze_failed:${msg}` };
      }
    },
  });

  const rows = core.rows.map((r) => {
    const item = items.find((i) => i.imageId === r.imageId);
    const imagePath = item?.imagePath ?? "";
    void imagePath; // reserved for future inclusion in rows

    return {
      imageId: r.imageId,
      sliderMatch: r.sliderMatch,
      hardFailReason: r.hardFailReason,
      visionInputKind: "none" as const,
    };
  });

  // If we ever want to show capture-kind in the report, we can switch to returning it
  // explicitly from runBPrimeCore. For now, keep the contract minimal.

  return {
    summary: core.summary,
    rows,
    outliers: core.outliers,
  };
}
