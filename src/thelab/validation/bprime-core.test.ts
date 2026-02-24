import { describe, expect, test } from "vitest";
import { runBPrimeCore } from "./bprime-core.js";

describe("runBPrimeCore", () => {
  test("scores items, computes pass rate, and returns outliers", async () => {
    const result = await runBPrimeCore({
      items: [
        {
          imageId: "img_a",
          truthDelta: { exposure: 0.3, temp: 200 },
        },
        {
          imageId: "img_b",
          truthDelta: { exposure: 1.0, temp: 800 },
        },
      ],
      passThreshold: 0.9,
      predict: async (item) => {
        if (item.imageId === "img_a") {
          return { predictedDelta: { exposure: 0.29, temp: 180 } };
        }
        return { predictedDelta: { exposure: -1.0, temp: -800 } };
      },
    });

    expect(result.summary.total).toBe(2);
    expect(result.summary.passed).toBe(1);
    expect(result.summary.passRate).toBeCloseTo(0.5, 6);

    expect(result.outliers.length).toBeGreaterThanOrEqual(1);
    expect(result.outliers[0].imageId).toBe("img_b");
  });
});
