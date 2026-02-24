import { describe, expect, test } from "vitest";
import type { ScenarioProfile } from "../learning/style-db.js";
import { runBPrimeValidation } from "./bprime-runner.js";

describe("runBPrimeValidation", () => {
  test("runs a B' validation with injected deps", async () => {
    const profile: ScenarioProfile = {
      scenarioKey: "golden_hour::outdoor::natural_bright::portrait",
      scenarioLabel: "Golden hour / Outdoor / Natural / Portrait",
      sampleCount: 20,
      lastUpdated: "2026-02-19T00:00:00.000Z",
      adjustments: {
        exposure: {
          control: "exposure",
          mean: 0.3,
          median: 0.3,
          stdDev: 0.1,
          min: -0.2,
          max: 0.8,
          sampleCount: 20,
        },
        temp: {
          control: "temp",
          mean: 200,
          median: 200,
          stdDev: 50,
          min: -100,
          max: 500,
          sampleCount: 20,
        },
      },
      correlations: [],
    };

    const res = await runBPrimeValidation(
      {
        imagePaths: ["/photos/a.jpg", "/photos/b.jpg"],
        passThreshold: 0.9,
      },
      {
        getImageId: async (p) => p.split("/").pop() ?? p,
        getTruthDeltaForPath: async (p) =>
          p.endsWith("a.jpg") ? { exposure: 0.3, temp: 200 } : { exposure: 1, temp: 800 },
        getProfileForPath: async () => profile,
        captureScreen: async () => "/tmp/screen.png",
        analyze: async () => ({ exposure: 0.3, temp: 200 }),
      },
    );

    expect(res.summary.total).toBe(2);
    expect(res.summary.passed).toBe(1);
    expect(res.outliers.length).toBeGreaterThanOrEqual(1);
  });

  test("hard-fails when ground truth cannot be loaded", async () => {
    const res = await runBPrimeValidation(
      {
        imagePaths: ["/photos/missing.jpg"],
        passThreshold: 0.9,
      },
      {
        getImageId: async (p) => p.split("/").pop() ?? p,
        getTruthDeltaForPath: async () => {
          throw new Error("no catalog match");
        },
        getProfileForPath: async () => null,
        captureScreen: async () => "/tmp/screen.png",
        analyze: async () => ({}),
      },
    );

    expect(res.summary.total).toBe(1);
    expect(res.summary.passed).toBe(0);
    expect(res.rows[0].hardFailReason).toContain("truth_missing");
  });
});
