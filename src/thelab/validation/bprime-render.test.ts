import { describe, expect, test } from "vitest";
import { renderBPrimeMarkdown } from "./bprime-render.js";

describe("renderBPrimeMarkdown", () => {
  test("renders headline metrics and outliers", () => {
    const md = renderBPrimeMarkdown({
      generatedAt: "2026-02-19T00:00:00.000Z",
      summary: { total: 3, passed: 1, failed: 2, passRate: 1 / 3, passThreshold: 0.9 },
      outliers: [{ imageId: "img_b", sliderMatch: 0.12, reason: "low_slider_match" }],
    });

    expect(md).toContain("Validation B’ — Vision Prediction vs Ground Truth");
    expect(md).toContain("PASS_RATE");
    expect(md).toContain("0.9");
    expect(md).toContain("img_b");
  });
});
