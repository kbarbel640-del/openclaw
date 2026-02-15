import { describe, it, expect } from "vitest";
import { truncateText } from "./web-fetch-utils.js";

describe("truncateText surrogate safety", () => {
  it("does not truncate short text", () => {
    const result = truncateText("hello", 10);
    expect(result).toEqual({ text: "hello", truncated: false });
  });

  it("truncates long text", () => {
    const result = truncateText("hello world", 5);
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBeLessThanOrEqual(5);
  });

  it("does not break surrogate pairs (emoji)", () => {
    // 🎉 is U+1F389, encoded as 2 UTF-16 code units
    const text = "ab🎉cd";
    // text.length is 6 (a, b, \uD83C, \uDF89, c, d)
    // Truncating at 3 with naive slice would split the emoji
    const result = truncateText(text, 3);
    expect(result.truncated).toBe(true);
    // Must not contain a lone high surrogate
    expect(result.text).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
    // Must not contain a lone low surrogate
    expect(result.text).not.toMatch(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
  });

  it("handles CJK + emoji mix", () => {
    const text = "你好🌍世界test";
    const result = truncateText(text, 4);
    expect(result.truncated).toBe(true);
    expect(result.text).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
  });
});
