import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import type { Config } from "../config/types.js";
import { clearDynamicPatterns, getDynamicPatterns } from "./capability-inference.js";
import {
  loadModelPatternsFromConfig,
  validateModelPatterns,
} from "./capability-patterns-loader.js";

describe("capability-patterns-loader", () => {
  beforeEach(() => {
    clearDynamicPatterns();
  });

  afterEach(() => {
    clearDynamicPatterns();
  });

  describe("loadModelPatternsFromConfig", () => {
    it("should load patterns from config", () => {
      const config: Partial<Config> = {
        agents: {
          defaults: {
            modelPatterns: {
              "gemini-4-turbo": {
                coding: true,
                performanceTier: "balanced",
              },
              "custom-llm": {
                performanceTier: "powerful",
                costTier: "expensive",
              },
            },
          },
        },
      };

      loadModelPatternsFromConfig(config);

      const patterns = getDynamicPatterns();
      expect(patterns.size).toBe(2);
      expect(patterns.get("gemini-4-turbo")).toEqual({
        coding: true,
        performanceTier: "balanced",
      });
      expect(patterns.get("custom-llm")).toEqual({
        performanceTier: "powerful",
        costTier: "expensive",
      });
    });

    it("should handle empty config gracefully", () => {
      const config: Partial<Config> = {};
      loadModelPatternsFromConfig(config);
      expect(getDynamicPatterns().size).toBe(0);
    });

    it("should handle missing agents section", () => {
      const config: Partial<Config> = {
        agents: undefined,
      };
      loadModelPatternsFromConfig(config);
      expect(getDynamicPatterns().size).toBe(0);
    });

    it("should handle missing defaults section", () => {
      const config: Partial<Config> = {
        agents: {
          defaults: undefined,
        },
      };
      loadModelPatternsFromConfig(config);
      expect(getDynamicPatterns().size).toBe(0);
    });

    it("should handle missing modelPatterns field", () => {
      const config: Partial<Config> = {
        agents: {
          defaults: {},
        },
      };
      loadModelPatternsFromConfig(config);
      expect(getDynamicPatterns().size).toBe(0);
    });

    it("should skip invalid pattern entries", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const config: Partial<Config> = {
        agents: {
          defaults: {
            modelPatterns: {
              "valid-pattern": { coding: true },
              "": { coding: false }, // Invalid: empty pattern
              "invalid-caps": null as unknown, // Invalid: null capabilities
            },
          },
        },
      };

      loadModelPatternsFromConfig(config);

      // Only valid pattern should be registered
      expect(getDynamicPatterns().size).toBe(1);
      expect(getDynamicPatterns().has("valid-pattern")).toBe(true);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should log info when patterns are registered", () => {
      const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});

      const config: Partial<Config> = {
        agents: {
          defaults: {
            modelPatterns: {
              pattern1: { coding: true },
              pattern2: { vision: true },
            },
          },
        },
      };

      loadModelPatternsFromConfig(config);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Registered 2 custom model pattern(s)"),
      );

      consoleSpy.mockRestore();
    });

    it("should handle registration errors gracefully", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      // Simulate config with patterns that might cause errors
      const config: Partial<Config> = {
        agents: {
          defaults: {
            modelPatterns: {
              "valid-pattern": { coding: true },
            },
          },
        },
      };

      loadModelPatternsFromConfig(config);
      expect(getDynamicPatterns().size).toBeGreaterThanOrEqual(1);

      consoleSpy.mockRestore();
    });
  });

  describe("validateModelPatterns", () => {
    it("should validate correct patterns", () => {
      const patterns = {
        "gemini-4": {
          coding: true,
          performanceTier: "balanced",
        },
        "custom-model": {
          vision: true,
          costTier: "expensive",
        },
      };

      const errors = validateModelPatterns(patterns);
      expect(errors).toHaveLength(0);
    });

    it("should reject null patterns", () => {
      const errors = validateModelPatterns(null as unknown);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("must be an object");
    });

    it("should reject non-object patterns", () => {
      const errors = validateModelPatterns("not-an-object" as unknown);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("must be an object");
    });

    it("should reject invalid coding type", () => {
      const patterns = {
        test: {
          coding: "yes" as unknown,
        },
      };

      const errors = validateModelPatterns(patterns);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain("coding must be boolean");
    });

    it("should reject invalid performanceTier", () => {
      const patterns = {
        test: {
          performanceTier: "super-fast" as unknown,
        },
      };

      const errors = validateModelPatterns(patterns);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain("performanceTier must be one of");
    });

    it("should reject invalid costTier", () => {
      const patterns = {
        test: {
          costTier: "ultra-cheap" as unknown,
        },
      };

      const errors = validateModelPatterns(patterns);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain("costTier must be one of");
    });

    it("should validate all boolean fields", () => {
      const patterns = {
        test: {
          coding: 1 as unknown,
          reasoning: "true" as unknown,
          vision: [] as unknown,
          general: {} as unknown,
          fast: null as unknown,
          creative: undefined as unknown,
        },
      };

      const errors = validateModelPatterns(patterns);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.includes("coding"))).toBe(true);
      expect(errors.some((e) => e.includes("reasoning"))).toBe(true);
      expect(errors.some((e) => e.includes("vision"))).toBe(true);
      expect(errors.some((e) => e.includes("general"))).toBe(true);
      expect(errors.some((e) => e.includes("fast"))).toBe(true);
      expect(errors.some((e) => e.includes("creative"))).toBe(true);
    });

    it("should validate primary field type", () => {
      const patterns = {
        test: {
          primary: 123 as unknown,
        },
      };

      const errors = validateModelPatterns(patterns);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain("primary must be string");
    });

    it("should accept valid primary field", () => {
      const patterns = {
        test: {
          primary: "some-primary-value",
        },
      };

      const errors = validateModelPatterns(patterns);
      expect(errors).toHaveLength(0);
    });

    it("should handle multiple validation errors", () => {
      const patterns = {
        test1: {
          coding: "yes" as unknown,
          performanceTier: "invalid" as unknown,
        },
        test2: {
          costTier: "wrong" as unknown,
          primary: 123 as unknown,
        },
      };

      const errors = validateModelPatterns(patterns);
      expect(errors.length).toBeGreaterThanOrEqual(4);
    });

    it("should allow partial capability objects", () => {
      const patterns = {
        minimal: {
          coding: true,
        },
        partial: {
          performanceTier: "fast",
        },
      };

      const errors = validateModelPatterns(patterns);
      expect(errors).toHaveLength(0);
    });

    it("should reject empty pattern keys", () => {
      const patterns = {
        "": {
          coding: true,
        },
      };

      const errors = validateModelPatterns(patterns);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain("non-empty string");
    });

    it("should reject non-object capabilities", () => {
      const patterns = {
        test: "not-an-object" as unknown,
      };

      const errors = validateModelPatterns(patterns);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain("capabilities must be an object");
    });
  });

  describe("integration scenario", () => {
    it("should support full config-to-inference workflow", () => {
      const config: Partial<Config> = {
        agents: {
          defaults: {
            modelPatterns: {
              "enterprise-model": {
                coding: true,
                reasoning: true,
                performanceTier: "powerful",
                costTier: "expensive",
              },
            },
          },
        },
      };

      // Validate first
      const patterns = config.agents?.defaults?.modelPatterns;
      if (patterns) {
        const errors = validateModelPatterns(patterns as unknown);
        expect(errors).toHaveLength(0);
      }

      // Then load
      loadModelPatternsFromConfig(config);

      // Verify registration
      const registeredPatterns = getDynamicPatterns();
      expect(registeredPatterns.has("enterprise-model")).toBe(true);
    });
  });
});
