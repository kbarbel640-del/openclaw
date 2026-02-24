import { describe, expect, test } from "vitest";
import { computeSliderMatchScore, summarizeBPrimeScores } from "./bprime-score.js";

describe("computeSliderMatchScore", () => {
  test("treats missing controls as 0 deltas", () => {
    const score = computeSliderMatchScore({
      predicted: {},
      truth: {},
    });
    expect(score.score).toBe(1);
  });

  test("penalizes deltas beyond tolerance and returns per-control detail", () => {
    const score = computeSliderMatchScore({
      predicted: { exposure: 0.0, temp: 0.0 },
      truth: { exposure: 0.3, temp: 400 },
    });

    expect(score.perControl.exposure.delta).toBeCloseTo(0.3, 6);
    expect(score.perControl.temp.delta).toBeCloseTo(400, 6);
    expect(score.score).toBeLessThan(1);
  });
});

describe("summarizeBPrimeScores", () => {
  test("computes pass rate at a threshold", () => {
    const summary = summarizeBPrimeScores(
      [
        { imageId: "a", sliderMatch: 0.95, hardFailReason: null },
        { imageId: "b", sliderMatch: 0.8, hardFailReason: null },
        { imageId: "c", sliderMatch: 0.99, hardFailReason: "cannot_resolve_pixels" },
      ],
      { passThreshold: 0.9 },
    );

    // c is a hard-fail => fail regardless of score
    expect(summary.total).toBe(3);
    expect(summary.passed).toBe(1);
    expect(summary.passRate).toBeCloseTo(1 / 3, 6);
  });
});
