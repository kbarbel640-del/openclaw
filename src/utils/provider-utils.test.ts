import { describe, expect, it } from "vitest";
import { isReasoningTagProvider } from "./provider-utils.js";

describe("isReasoningTagProvider", () => {
  // --- Exact matches ---

  it("returns true for ollama", () => {
    expect(isReasoningTagProvider("ollama")).toBe(true);
  });

  it("returns true for google-gemini-cli", () => {
    expect(isReasoningTagProvider("google-gemini-cli")).toBe(true);
  });

  it("returns true for google-generative-ai", () => {
    expect(isReasoningTagProvider("google-generative-ai")).toBe(true);
  });

  // --- Substring matches ---

  it("returns true for google-antigravity", () => {
    expect(isReasoningTagProvider("google-antigravity")).toBe(true);
  });

  it("returns true for google-antigravity/gemini-3", () => {
    expect(isReasoningTagProvider("google-antigravity/gemini-3")).toBe(true);
  });

  it("returns true for minimax", () => {
    expect(isReasoningTagProvider("minimax")).toBe(true);
  });

  it("returns true for minimax/M2.1", () => {
    expect(isReasoningTagProvider("minimax/M2.1")).toBe(true);
  });

  // --- Case insensitivity ---

  it("matches case-insensitively", () => {
    expect(isReasoningTagProvider("OLLAMA")).toBe(true);
    expect(isReasoningTagProvider("Google-Antigravity")).toBe(true);
    expect(isReasoningTagProvider("MiniMax")).toBe(true);
  });

  // --- Whitespace trimming ---

  it("trims leading and trailing whitespace", () => {
    expect(isReasoningTagProvider("  ollama  ")).toBe(true);
  });

  // --- Negative cases ---

  it("returns false for openai", () => {
    expect(isReasoningTagProvider("openai")).toBe(false);
  });

  it("returns false for anthropic", () => {
    expect(isReasoningTagProvider("anthropic")).toBe(false);
  });

  it("returns false for an unrelated provider", () => {
    expect(isReasoningTagProvider("my-custom-provider")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(isReasoningTagProvider("")).toBe(false);
  });

  // --- Null / undefined ---

  it("returns false for undefined", () => {
    expect(isReasoningTagProvider(undefined)).toBe(false);
  });

  it("returns false for null", () => {
    expect(isReasoningTagProvider(null)).toBe(false);
  });
});
