import { describe, it, expect } from "vitest";
import {
  providerSupports,
  getProviderCapabilities,
  inferModelCapabilities,
  validateCapabilities,
  findCapableModels,
  scoreCapabilityMatch,
  suggestAlternatives,
} from "./capabilities.js";
import type { ModelCatalogEntry, ProviderId } from "./types.js";

describe("capabilities", () => {
  describe("providerSupports", () => {
    it("detects vision support", () => {
      expect(providerSupports("anthropic", "vision")).toBe(true);
      expect(providerSupports("openai", "vision")).toBe(true);
      expect(providerSupports("cerebras", "vision")).toBe(false);
    });

    it("detects extended thinking support", () => {
      expect(providerSupports("anthropic", "extended-thinking")).toBe(true);
      expect(providerSupports("openai", "extended-thinking")).toBe(false);
    });

    it("detects tools support", () => {
      expect(providerSupports("anthropic", "tools")).toBe(true);
      expect(providerSupports("openai", "tools")).toBe(true);
      expect(providerSupports("ollama", "tools")).toBe(true);
    });
  });

  describe("getProviderCapabilities", () => {
    it("returns all capabilities for provider", () => {
      const caps = getProviderCapabilities("anthropic");
      expect(caps).toContain("vision");
      expect(caps).toContain("tools");
      expect(caps).toContain("reasoning");
      expect(caps).toContain("extended-thinking");
    });

    it("returns empty array for unknown provider", () => {
      const caps = getProviderCapabilities("unknown" as ProviderId);
      expect(caps).toEqual([]);
    });
  });

  describe("inferModelCapabilities", () => {
    it("infers capabilities from catalog entry", () => {
      const entry: ModelCatalogEntry = {
        id: "claude-opus-4-6",
        name: "Claude Opus 4.6",
        provider: "anthropic",
        contextWindow: 200000,
        reasoning: true,
        input: ["text", "image"],
      };

      const caps = inferModelCapabilities(entry);
      expect(caps.vision).toBe(true);
      expect(caps.tools).toBe(true);
      expect(caps.reasoning).toBe(true);
      expect(caps.contextWindow).toBe(200000);
      expect(caps.input).toContain("image");
    });

    it("falls back to provider capabilities", () => {
      const entry: ModelCatalogEntry = {
        id: "gpt-4",
        name: "GPT-4",
        provider: "openai",
      };

      const caps = inferModelCapabilities(entry);
      expect(caps.tools).toBe(true);
      expect(caps.streaming).toBe(true);
    });
  });

  describe("validateCapabilities", () => {
    it("validates vision requirement", () => {
      const caps = { vision: true, tools: true, contextWindow: 100000 };
      const required = { vision: true };

      const result = validateCapabilities(caps, required);
      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it("detects missing capabilities", () => {
      const caps = { vision: false, tools: true, contextWindow: 100000 };
      const required = { vision: true, contextWindow: 200000 };

      const result = validateCapabilities(caps, required);
      expect(result.valid).toBe(false);
      expect(result.missing).toContain("vision");
      expect(result.missing).toContain("contextWindow:200000");
    });

    it("validates input modalities", () => {
      const caps = { input: ["text"], vision: false, tools: true, contextWindow: 100000 };
      const required = { input: ["text", "image"] };

      const result = validateCapabilities(caps, required);
      expect(result.valid).toBe(false);
      expect(result.missing).toContain("input:image");
    });
  });

  describe("findCapableModels", () => {
    it("finds models with vision support", () => {
      const catalog: ModelCatalogEntry[] = [
        { id: "opus", name: "Opus", provider: "anthropic", input: ["text", "image"] },
        { id: "cerebras", name: "Cerebras", provider: "cerebras", input: ["text"] },
        { id: "gpt-4", name: "GPT-4", provider: "openai", input: ["text", "image"] },
      ];

      const capable = findCapableModels(catalog, { vision: true });
      expect(capable).toHaveLength(2);
      expect(capable.map((m) => m.id)).toContain("opus");
      expect(capable.map((m) => m.id)).toContain("gpt-4");
    });

    it("finds models with sufficient context window", () => {
      const catalog: ModelCatalogEntry[] = [
        { id: "small", name: "Small", provider: "test", contextWindow: 50000 },
        { id: "medium", name: "Medium", provider: "test", contextWindow: 100000 },
        { id: "large", name: "Large", provider: "test", contextWindow: 200000 },
      ];

      const capable = findCapableModels(catalog, { contextWindow: 100000 });
      expect(capable).toHaveLength(2);
      expect(capable.map((m) => m.id)).toContain("medium");
      expect(capable.map((m) => m.id)).toContain("large");
    });
  });

  describe("scoreCapabilityMatch", () => {
    it("gives perfect score for exact match", () => {
      const caps = { vision: true, tools: true, contextWindow: 100000 };
      const required = { vision: true, tools: true };

      const score = scoreCapabilityMatch(caps, required);
      expect(score).toBe(100);
    });

    it("gives partial score for partial match", () => {
      const caps = { vision: true, tools: false, contextWindow: 100000 };
      const required = { vision: true, tools: true };

      const score = scoreCapabilityMatch(caps, required);
      expect(score).toBe(50); // 1 of 2 boolean caps
    });

    it("gives proportional score for context window", () => {
      const caps = { vision: false, tools: false, contextWindow: 50000 };
      const required = { contextWindow: 100000 };

      const score = scoreCapabilityMatch(caps, required);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(100);
    });
  });

  describe("suggestAlternatives", () => {
    it("suggests better matches", () => {
      const catalog: ModelCatalogEntry[] = [
        {
          id: "opus",
          name: "Opus",
          provider: "anthropic",
          input: ["text", "image"],
          reasoning: true,
        },
        { id: "sonnet", name: "Sonnet", provider: "anthropic", input: ["text", "image"] },
        { id: "cerebras", name: "Cerebras", provider: "cerebras", input: ["text"] },
        { id: "gpt-4", name: "GPT-4", provider: "openai", input: ["text", "image"] },
      ];

      const original = catalog[2]; // cerebras (no vision)
      const required = { vision: true };

      const alternatives = suggestAlternatives(catalog, original, required);
      expect(alternatives.length).toBeGreaterThan(0);
      expect(alternatives[0].score).toBeGreaterThan(0);
      expect(alternatives[0].model.id).not.toBe("cerebras");
    });

    it("limits to 3 suggestions", () => {
      const catalog: ModelCatalogEntry[] = [
        { id: "m1", name: "M1", provider: "p1", input: ["text", "image"] },
        { id: "m2", name: "M2", provider: "p2", input: ["text", "image"] },
        { id: "m3", name: "M3", provider: "p3", input: ["text", "image"] },
        { id: "m4", name: "M4", provider: "p4", input: ["text", "image"] },
        { id: "m5", name: "M5", provider: "p5", input: ["text"] },
      ];

      const original = catalog[4]; // m5 (no vision)
      const alternatives = suggestAlternatives(catalog, original, { vision: true });
      expect(alternatives).toHaveLength(3);
    });
  });
});
