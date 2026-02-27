import { describe, expect, it } from "vitest";
import {
  hasUnpairedSurrogates,
  repairInvalidUtf16Surrogates,
  sanitizeUnknownStringsDeep,
  sanitizeUnpairedSurrogatesWithStats,
} from "./unicode-safety.js";

describe("unicode-safety", () => {
  it("leaves valid surrogate pairs unchanged", () => {
    const value = "emoji 😀 ok";
    const result = sanitizeUnpairedSurrogatesWithStats(value);
    expect(result.value).toBe(value);
    expect(result.replacements).toBe(0);
    expect(hasUnpairedSurrogates(result.value)).toBe(false);
  });

  it("replaces lone high surrogate", () => {
    const value = "broken \ud83d tail";
    const result = sanitizeUnpairedSurrogatesWithStats(value);
    expect(result.replacements).toBe(1);
    expect(result.value).toContain("\uFFFD");
    expect(hasUnpairedSurrogates(result.value)).toBe(false);
  });

  it("replaces lone low surrogate", () => {
    const value = "broken \udc00 tail";
    const result = sanitizeUnpairedSurrogatesWithStats(value);
    expect(result.replacements).toBe(1);
    expect(result.value).toContain("\uFFFD");
    expect(hasUnpairedSurrogates(result.value)).toBe(false);
  });

  it("repairs nested objects and arrays", () => {
    const data = {
      text: "x\ud83d",
      nested: [{ note: "y\udc00" }],
    };
    const result = sanitizeUnknownStringsDeep(data);
    expect(result.replacements).toBe(2);
    expect(result.value.text).toContain("\uFFFD");
    expect(result.value.nested[0]?.note).toContain("\uFFFD");
  });

  it("exports repairInvalidUtf16Surrogates helper", () => {
    expect(repairInvalidUtf16Surrogates("ok 😀")).toBe("ok 😀");
    expect(repairInvalidUtf16Surrogates("bad \udc00")).toContain("\uFFFD");
  });
});
