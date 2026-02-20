import { describe, expect, it } from "vitest";
import { estimateDoltTokenCount, renderPayloadForTokenEstimation } from "./token-count.js";

describe("renderPayloadForTokenEstimation", () => {
  it("prefers payload.summary for summary records", () => {
    expect(
      renderPayloadForTokenEstimation({
        summary:
          "---\nsummary-type: leaf\ndates-covered: 1|2\nchildren: ['turn-1']\nfinalized-at-reset: false\n---\nBody",
        other: "ignored",
      }),
    ).toContain("summary-type: leaf");
  });

  it("stably serializes objects by key order", () => {
    const a = renderPayloadForTokenEstimation({ b: 1, a: 2 });
    const b = renderPayloadForTokenEstimation({ a: 2, b: 1 });
    expect(a).toBe(b);
  });
});

describe("estimateDoltTokenCount", () => {
  it("uses estimateTokens when primary estimator is available", () => {
    const estimated = estimateDoltTokenCount({
      payload: { role: "user", content: "hello" },
      estimateTokensFn: () => 42,
    });
    expect(estimated).toEqual({
      tokenCount: 42,
      tokenCountMethod: "estimateTokens",
    });
  });

  it("falls back to utf8/4 heuristic when primary estimator throws", () => {
    const estimated = estimateDoltTokenCount({
      payload: "abcdefgh",
      estimateTokensFn: () => {
        throw new Error("unavailable");
      },
    });
    expect(estimated).toEqual({
      tokenCount: 2,
      tokenCountMethod: "fallback",
    });
  });
});
