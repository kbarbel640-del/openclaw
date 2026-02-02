import { describe, expect, it } from "vitest";
import type { ModelRef } from "../model-selection.js";
import {
  getProviderFromModel,
  getMostAdvancedModelForProvider,
  getProviderModelHierarchy,
  isSupportedProvider,
  getInheritedModel,
  formatModelRef,
  isModelInProviderHierarchy,
} from "./sessions-model-inheritance.js";

describe("sessions-model-inheritance", () => {
  describe("getProviderFromModel", () => {
    it("should extract provider from string model reference", () => {
      expect(getProviderFromModel("anthropic/claude-sonnet-4-5")).toBe("anthropic");
      expect(getProviderFromModel("openai/gpt-4o")).toBe("openai");
      expect(getProviderFromModel("google/gemini-1.5-pro")).toBe("google");
    });

    it("should extract provider from ModelRef object", () => {
      const modelRef: ModelRef = { provider: "anthropic", model: "claude-opus-4-5" };
      expect(getProviderFromModel(modelRef)).toBe("anthropic");
    });

    it("should handle edge cases", () => {
      expect(getProviderFromModel("")).toBeNull();
      expect(getProviderFromModel(undefined)).toBeNull();
      expect(getProviderFromModel("invalid-format")).toBeNull();
    });

    it("should trim whitespace", () => {
      expect(getProviderFromModel("  anthropic/claude-sonnet  ")).toBe("anthropic");
    });
  });

  describe("getMostAdvancedModelForProvider", () => {
    it("should return top-tier anthropic model", () => {
      const result = getMostAdvancedModelForProvider("anthropic");
      expect(result).toEqual({
        provider: "anthropic",
        model: "claude-opus-4-5",
      });
    });

    it("should return top-tier openai model", () => {
      const result = getMostAdvancedModelForProvider("openai");
      expect(result).toEqual({
        provider: "openai",
        model: "gpt-5.2",
      });
    });

    it("should return top-tier openai-codex model", () => {
      const result = getMostAdvancedModelForProvider("openai-codex");
      expect(result).toEqual({
        provider: "openai-codex",
        model: "gpt-5.2",
      });
    });

    it("should return top-tier google model", () => {
      const result = getMostAdvancedModelForProvider("google");
      expect(result).toEqual({
        provider: "google",
        model: "gemini-exp-1206",
      });
    });

    it("should handle case insensitive providers", () => {
      expect(getMostAdvancedModelForProvider("ANTHROPIC")).toEqual({
        provider: "anthropic",
        model: "claude-opus-4-5",
      });
    });

    it("should return null for unknown provider", () => {
      expect(getMostAdvancedModelForProvider("unknown-provider")).toBeNull();
    });

    it("should handle empty/invalid input", () => {
      expect(getMostAdvancedModelForProvider("")).toBeNull();
      expect(getMostAdvancedModelForProvider("   ")).toBeNull();
    });
  });

  describe("getProviderModelHierarchy", () => {
    it("should return complete anthropic hierarchy", () => {
      const hierarchy = getProviderModelHierarchy("anthropic");
      expect(hierarchy).toContain("claude-opus-4-5");
      expect(hierarchy).toContain("claude-sonnet-4-5");
      expect(hierarchy).toContain("claude-haiku-4-5");
      expect(hierarchy[0]).toBe("claude-opus-4-5"); // Most advanced first
    });

    it("should return complete openai hierarchy", () => {
      const hierarchy = getProviderModelHierarchy("openai");
      expect(hierarchy).toContain("gpt-5.2");
      expect(hierarchy).toContain("gpt-4o");
      expect(hierarchy[0]).toBe("gpt-5.2"); // Most advanced first
    });

    it("should return empty array for unknown provider", () => {
      expect(getProviderModelHierarchy("unknown")).toEqual([]);
    });

    it("should be case insensitive", () => {
      const lower = getProviderModelHierarchy("anthropic");
      const upper = getProviderModelHierarchy("ANTHROPIC");
      expect(lower).toEqual(upper);
    });
  });

  describe("isSupportedProvider", () => {
    it("should return true for all supported providers", () => {
      const supportedProviders = [
        "anthropic",
        "openai",
        "openai-codex",
        "google",
        "groq",
        "perplexity",
        "xai",
        "cohere",
        "mistral",
        "claude-cli",
        "deepseek",
      ];

      supportedProviders.forEach((provider) => {
        expect(isSupportedProvider(provider)).toBe(true);
      });
    });

    it("should be case insensitive", () => {
      expect(isSupportedProvider("ANTHROPIC")).toBe(true);
      expect(isSupportedProvider("OpenAI")).toBe(true);
    });

    it("should return false for unknown providers", () => {
      expect(isSupportedProvider("unknown-provider")).toBe(false);
      expect(isSupportedProvider("")).toBe(false);
    });
  });

  describe("getInheritedModel", () => {
    it("should inherit and upgrade anthropic models", () => {
      const parent = "anthropic/claude-haiku-4-5";
      const inherited = getInheritedModel(parent);
      expect(inherited).toEqual({
        provider: "anthropic",
        model: "claude-opus-4-5",
      });
    });

    it("should inherit and upgrade openai models", () => {
      const parent = "openai/gpt-4o";
      const inherited = getInheritedModel(parent);
      expect(inherited).toEqual({
        provider: "openai",
        model: "gpt-5.2",
      });
    });

    it("should work with ModelRef objects", () => {
      const parent: ModelRef = { provider: "anthropic", model: "claude-sonnet-4-5" };
      const inherited = getInheritedModel(parent);
      expect(inherited).toEqual({
        provider: "anthropic",
        model: "claude-opus-4-5",
      });
    });

    it("should return null for unsupported providers", () => {
      expect(getInheritedModel("unknown/model")).toBeNull();
    });

    it("should return null for invalid input", () => {
      expect(getInheritedModel("")).toBeNull();
      expect(getInheritedModel(undefined)).toBeNull();
    });
  });

  describe("formatModelRef", () => {
    it("should format ModelRef as provider/model string", () => {
      const modelRef: ModelRef = { provider: "anthropic", model: "claude-opus-4-5" };
      expect(formatModelRef(modelRef)).toBe("anthropic/claude-opus-4-5");
    });
  });

  describe("isModelInProviderHierarchy", () => {
    it("should return true for valid models in hierarchy", () => {
      expect(isModelInProviderHierarchy("anthropic", "claude-opus-4-5")).toBe(true);
      expect(isModelInProviderHierarchy("openai", "gpt-4o")).toBe(true);
    });

    it("should return false for invalid models", () => {
      expect(isModelInProviderHierarchy("anthropic", "invalid-model")).toBe(false);
      expect(isModelInProviderHierarchy("unknown", "any-model")).toBe(false);
    });

    it("should be case sensitive for model names", () => {
      expect(isModelInProviderHierarchy("anthropic", "CLAUDE-OPUS-4-5")).toBe(false);
    });
  });

  describe("integration scenarios", () => {
    it("should handle complete inheritance workflow", () => {
      // Start with a lower-tier model
      const parentModel = "anthropic/claude-haiku-4-5";

      // Extract provider
      const provider = getProviderFromModel(parentModel);
      expect(provider).toBe("anthropic");

      // Check if supported
      expect(isSupportedProvider(provider!)).toBe(true);

      // Get inherited model
      const inherited = getInheritedModel(parentModel);
      expect(inherited).toEqual({
        provider: "anthropic",
        model: "claude-opus-4-5",
      });

      // Format for use
      const formatted = formatModelRef(inherited!);
      expect(formatted).toBe("anthropic/claude-opus-4-5");
    });

    it("should handle cross-provider inheritance (should not work)", () => {
      const parentModel = "anthropic/claude-opus-4-5";
      const inherited = getInheritedModel(parentModel);

      // Should stay within anthropic, not jump to openai
      expect(inherited?.provider).toBe("anthropic");
      expect(inherited?.provider).not.toBe("openai");
    });

    it("should handle already top-tier models", () => {
      const parentModel = "anthropic/claude-opus-4-5"; // Already top tier
      const inherited = getInheritedModel(parentModel);

      // Should still return opus (idempotent)
      expect(inherited).toEqual({
        provider: "anthropic",
        model: "claude-opus-4-5",
      });
    });
  });
});
