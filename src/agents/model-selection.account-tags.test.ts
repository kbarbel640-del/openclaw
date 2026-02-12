import { describe, expect, it } from "vitest";
import { parseModelRef } from "./model-selection.js";

describe("parseModelRef with accountTag support", () => {
  it("parses provider/model@tag format", () => {
    const result = parseModelRef("google-antigravity/claude-opus-4-5@sendtelecom", "anthropic");
    expect(result).toEqual({
      provider: "google-antigravity",
      model: "claude-opus-4-5",
      accountTag: "sendtelecom",
    });
  });

  it("parses provider/model without tag (backward compatible)", () => {
    const result = parseModelRef("google-antigravity/claude-opus-4-5", "anthropic");
    expect(result).toEqual({
      provider: "google-antigravity",
      model: "claude-opus-4-5",
      accountTag: undefined,
    });
  });

  it("parses model@tag with default provider", () => {
    const result = parseModelRef("claude-opus-4-5@main", "anthropic");
    expect(result).toEqual({
      provider: "anthropic",
      model: "claude-opus-4-5",
      accountTag: "main",
    });
  });

  it("parses model without tag and provider (default provider)", () => {
    const result = parseModelRef("claude-opus-4-5", "anthropic");
    expect(result).toEqual({
      provider: "anthropic",
      model: "claude-opus-4-5",
      accountTag: undefined,
    });
  });

  it("handles tag with hyphens", () => {
    const result = parseModelRef("google-antigravity/model@my-account-tag", "anthropic");
    expect(result).toEqual({
      provider: "google-antigravity",
      model: "model",
      accountTag: "my-account-tag",
    });
  });

  it("handles tag with underscores", () => {
    const result = parseModelRef("google-antigravity/model@my_account", "anthropic");
    expect(result).toEqual({
      provider: "google-antigravity",
      model: "model",
      accountTag: "my_account",
    });
  });

  it("handles empty tag (@ at end)", () => {
    const result = parseModelRef("google-antigravity/model@", "anthropic");
    expect(result).toEqual({
      provider: "google-antigravity",
      model: "model",
      accountTag: undefined, // Empty tag becomes undefined
    });
  });

  it("handles whitespace around tag", () => {
    const result = parseModelRef("google-antigravity/model@  sendtelecom  ", "anthropic");
    expect(result).toEqual({
      provider: "google-antigravity",
      model: "model",
      accountTag: "sendtelecom",
    });
  });

  it("handles multiple @ symbols (uses first)", () => {
    const result = parseModelRef("google-antigravity/model@tag1@tag2", "anthropic");
    expect(result).toEqual({
      provider: "google-antigravity",
      model: "model",
      accountTag: "tag1@tag2", // Everything after first @ is the tag
    });
  });

  it("normalizes provider names", () => {
    const result = parseModelRef("Google-Antigravity/model@tag", "anthropic");
    expect(result).toEqual({
      provider: "google-antigravity",
      model: "model",
      accountTag: "tag",
    });
  });

  it("normalizes anthropic model shortcuts with tag", () => {
    const result = parseModelRef("anthropic/opus-4.5@main", "anthropic");
    expect(result).toEqual({
      provider: "anthropic",
      model: "claude-opus-4-5", // Normalized
      accountTag: "main",
    });
  });

  it("handles google model normalization with tag", () => {
    const result = parseModelRef("google/gemini-2.0-flash@work", "anthropic");
    expect(result).toEqual({
      provider: "google",
      model: "gemini-2.0-flash", // Normalized
      accountTag: "work",
    });
  });

  it("returns null for empty string", () => {
    const result = parseModelRef("", "anthropic");
    expect(result).toBeNull();
  });

  it("returns null for whitespace-only string", () => {
    const result = parseModelRef("   ", "anthropic");
    expect(result).toBeNull();
  });

  it("handles real-world example: google-antigravity", () => {
    const result = parseModelRef("google-antigravity/gpt-oss-120b-medium@sendtelecom", "anthropic");
    expect(result).toEqual({
      provider: "google-antigravity",
      model: "gpt-oss-120b-medium",
      accountTag: "sendtelecom",
    });
  });

  it("handles real-world example: openrouter with tag", () => {
    const result = parseModelRef("openrouter/llama-3.3-70b@paid", "anthropic");
    expect(result).toEqual({
      provider: "openrouter",
      model: "llama-3.3-70b",
      accountTag: "paid",
    });
  });

  it("handles model with version number and tag", () => {
    const result = parseModelRef("anthropic/claude-sonnet-4-5@work", "anthropic");
    expect(result).toEqual({
      provider: "anthropic",
      model: "claude-sonnet-4-5",
      accountTag: "work",
    });
  });
});
