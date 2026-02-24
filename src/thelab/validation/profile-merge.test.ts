import { describe, expect, test } from "vitest";
import type { ScenarioProfile } from "../learning/style-db.js";
import type { ImageAnalysisResultType } from "../vision/schema.js";
import { mergeProfileWithVision, profileToAdjustments } from "./profile-merge.js";

describe("profile merge", () => {
  test("blends overlapping controls 0.6 profile / 0.4 vision", () => {
    const profile: ScenarioProfile = {
      scenarioKey: "x",
      scenarioLabel: "X",
      sampleCount: 20,
      lastUpdated: "now",
      adjustments: {
        exposure: {
          control: "exposure",
          mean: 0.8,
          median: 0.8,
          stdDev: 0.1,
          min: -0.2,
          max: 1.2,
          sampleCount: 20,
        },
      },
      correlations: [],
    };

    const profileAdj = profileToAdjustments(profile);

    const vision: ImageAnalysisResultType = {
      image_id: "img",
      confidence: 0.9,
      adjustments: [
        { control: "exposure", current_estimate: 0, target_delta: 1.0, confidence: 0.8 },
      ],
      flag_for_review: false,
      flag_reason: null,
      reasoning: "x",
    };

    const merged = mergeProfileWithVision(profileAdj, vision);
    const exp = merged.adjustments.find((a) => a.control === "exposure");
    expect(exp?.target_delta).toBeCloseTo(0.8 * 0.6 + 1.0 * 0.4, 6);
  });
});
