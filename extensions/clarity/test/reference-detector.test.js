/**
 * Unit tests for ReferenceDetector
 */

"use strict";

const { ReferenceDetector } = require("../lib/v2/reference-detector");
const { RelationshipGraph, RelType } = require("../lib/v2/relationship-graph");

// Simple test runner
function describe(name, fn) {
  console.log(`\n📦 ${name}`);
  fn();
}

function it(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
  } catch (err) {
    console.log(`  ❌ ${name}`);
    console.log(`     Error: ${err.message}`);
    process.exitCode = 1;
  }
}

function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, got ${actual}`);
      }
    },
    toEqual(expected) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
    toBeDefined() {
      if (actual === undefined) {
        throw new Error(`Expected value to be defined`);
      }
    },
    toBeNull() {
      if (actual !== null) {
        throw new Error(`Expected null, got ${actual}`);
      }
    },
    toBeGreaterThan(expected) {
      if (!(actual > expected)) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
    toBeGreaterThanOrEqual(expected) {
      if (!(actual >= expected)) {
        throw new Error(`Expected ${actual} to be >= ${expected}`);
      }
    },
    toBeLessThan(expected) {
      if (!(actual < expected)) {
        throw new Error(`Expected ${actual} to be less than ${expected}`);
      }
    },
    toContain(expected) {
      if (!actual.includes(expected)) {
        throw new Error(`Expected array to contain ${expected}`);
      }
    },
    toHaveLength(expected) {
      if (actual.length !== expected) {
        throw new Error(`Expected length ${expected}, got ${actual.length}`);
      }
    },
    toBeTruthy() {
      if (!actual) {
        throw new Error(`Expected truthy value, got ${actual}`);
      }
    },
    toBeFalsy() {
      if (actual) {
        throw new Error(`Expected falsy value, got ${actual}`);
      }
    },
  };
}

// Tests
describe("ReferenceDetector", () => {
  describe("Constructor", () => {
    it("should create detector with default options", () => {
      const detector = new ReferenceDetector();
      expect(detector._enablePronouns).toBe(true);
      expect(detector._minConfidence).toBe(0.5);
    });

    it("should accept custom options", () => {
      const detector = new ReferenceDetector({
        enablePronouns: false,
        minConfidence: 0.7,
      });
      expect(detector._enablePronouns).toBe(false);
      expect(detector._minConfidence).toBe(0.7);
    });
  });

  describe("detectReferences", () => {
    it("should detect exact ID matches", () => {
      const detector = new ReferenceDetector();
      const text = "We should use plugin:clarity for this task";
      const entities = [{ id: "plugin:clarity", name: "Clarity", normalized: "clarity" }];

      const refs = detector.detectReferences(text, entities);

      expect(refs).toHaveLength(1);
      expect(refs[0].entityId).toBe("plugin:clarity");
      expect(refs[0].matchedBy).toBe("exact");
      expect(refs[0].indirect).toBe(false);
    });

    it("should detect normalized name matches", () => {
      const detector = new ReferenceDetector();
      const text = "The clarity plugin is working well";
      const entities = [{ id: "plugin:clarity", name: "Clarity", normalized: "clarity" }];

      const refs = detector.detectReferences(text, entities);

      expect(refs).toHaveLength(1);
      expect(refs[0].matchedBy).toBe("normalized");
    });

    it("should detect display name matches", () => {
      const detector = new ReferenceDetector();
      const text = "Clarity is a useful plugin";
      const entities = [{ id: "plugin:clarity", name: "Clarity", normalized: "clarity" }];

      const refs = detector.detectReferences(text, entities);

      expect(refs).toHaveLength(1);
      expect(refs[0].matchedBy).toBe("name");
    });

    it("should use word boundaries to avoid false positives", () => {
      const detector = new ReferenceDetector();
      const text = "The word clarifies the meaning but clarity is what we want";
      const entities = [{ id: "plugin:clarity", name: "Clarity", normalized: "clarity" }];

      const refs = detector.detectReferences(text, entities);

      // Should NOT match "clarifies" but SHOULD match "clarity"
      expect(refs).toHaveLength(1);
      expect(refs[0].matchedText.toLowerCase()).toBe("clarity");
    });

    it("should detect hyphenated variants", () => {
      const detector = new ReferenceDetector();
      const text = "The focus-engine module is running";
      const entities = [
        { id: "project:focus_engine", name: "FocusEngine", normalized: "focus_engine" },
      ];

      const refs = detector.detectReferences(text, entities);

      expect(refs).toHaveLength(1);
      expect(refs[0].matchedBy).toBe("hyphenated");
    });

    it("should detect short name from ID", () => {
      const detector = new ReferenceDetector();
      const text = "The subagents tool is useful";
      const entities = [{ id: "tool:subagents", name: "Subagents", normalized: "subagents" }];

      const refs = detector.detectReferences(text, entities);

      expect(refs.length).toBeGreaterThan(0);
    });

    it("should handle aliases", () => {
      const detector = new ReferenceDetector();
      const text = "The context tracker is working";
      const entities = [
        {
          id: "plugin:clarity",
          name: "Clarity",
          normalized: "clarity",
          aliases: ["context tracker"],
        },
      ];

      const refs = detector.detectReferences(text, entities);

      expect(refs).toHaveLength(1);
      expect(refs[0].matchedBy).toBe("alias");
    });

    it("should return empty array for empty input", () => {
      const detector = new ReferenceDetector();
      const refs = detector.detectReferences("", []);
      expect(refs).toHaveLength(0);
    });

    it("should return empty array for no matches", () => {
      const detector = new ReferenceDetector();
      const text = "This text has no relevant entities";
      const entities = [{ id: "plugin:clarity", name: "Clarity", normalized: "clarity" }];

      const refs = detector.detectReferences(text, entities);

      expect(refs).toHaveLength(0);
    });

    it("should sort results by position", () => {
      const detector = new ReferenceDetector();
      const text = "First we have subagents then later we have clarity";
      const entities = [
        { id: "tool:subagents", name: "Subagents", normalized: "subagents" },
        { id: "plugin:clarity", name: "Clarity", normalized: "clarity" },
      ];

      const refs = detector.detectReferences(text, entities);

      expect(refs).toHaveLength(2);
      expect(refs[0].entityId).toBe("tool:subagents");
      expect(refs[1].entityId).toBe("plugin:clarity");
    });

    it("should filter by confidence threshold", () => {
      const detector = new ReferenceDetector({ minConfidence: 0.9 });
      const text = "We use the x tool"; // Very short match, lower confidence
      const entities = [{ id: "tool:x", name: "X", normalized: "x" }];

      const refs = detector.detectReferences(text, entities);

      // Short names should have reduced confidence
      expect(refs).toHaveLength(0);
    });
  });

  describe("detectIndirectReferences", () => {
    it("should detect indirect references via related entities", () => {
      const detector = new ReferenceDetector();
      const text = "We should use subagents for this"; // mentions subagents
      const entity = { id: "plugin:clarity", name: "Clarity", normalized: "clarity" };
      const related = [
        {
          id: "tool:subagents",
          name: "Subagents",
          normalized: "subagents",
          strength: 0.8,
          type: "uses",
        },
      ];

      const refs = detector.detectIndirectReferences(text, entity, related);

      expect(refs).toHaveLength(1);
      expect(refs[0].entityId).toBe("plugin:clarity");
      expect(refs[0].indirect).toBe(true);
      expect(refs[0].via).toBe("tool:subagents");
    });

    it("should filter by minimum relationship strength", () => {
      const detector = new ReferenceDetector();
      const text = "We should use subagents";
      const entity = { id: "plugin:clarity", name: "Clarity", normalized: "clarity" };
      const related = [
        {
          id: "tool:subagents",
          name: "Subagents",
          normalized: "subagents",
          strength: 0.2, // Below default threshold of 0.3
          type: "uses",
        },
      ];

      const refs = detector.detectIndirectReferences(text, entity, related);

      expect(refs).toHaveLength(0);
    });

    it("should return empty for no related entity mentions", () => {
      const detector = new ReferenceDetector();
      const text = "This text mentions nothing relevant";
      const entity = { id: "plugin:clarity", name: "Clarity", normalized: "clarity" };
      const related = [
        {
          id: "tool:subagents",
          name: "Subagents",
          normalized: "subagents",
          strength: 0.8,
          type: "uses",
        },
      ];

      const refs = detector.detectIndirectReferences(text, entity, related);

      expect(refs).toHaveLength(0);
    });

    it("should return empty for missing inputs", () => {
      const detector = new ReferenceDetector();
      const refs = detector.detectIndirectReferences("", null, []);
      expect(refs).toHaveLength(0);
    });
  });

  describe("detectWithGraph", () => {
    it("should combine direct and indirect detection", () => {
      const detector = new ReferenceDetector();
      const graph = new RelationshipGraph();

      // Create relationship: clarity uses subagents
      graph.addRelationship("plugin:clarity", "tool:subagents", RelType.USES, 0.9);

      const text = "Let me check the subagents"; // Mentions subagents, not clarity
      const entities = [
        { id: "plugin:clarity", name: "Clarity", normalized: "clarity" },
        { id: "tool:subagents", name: "Subagents", normalized: "subagents" },
      ];

      const refs = detector.detectWithGraph(text, entities, graph);

      // Should have direct reference to subagents and indirect to clarity
      expect(refs.length).toBeGreaterThan(1);
      expect(refs.some((r) => r.entityId === "plugin:clarity" && r.indirect)).toBe(true);
      expect(refs.some((r) => r.entityId === "tool:subagents" && !r.indirect)).toBe(true);
    });

    it("should not duplicate direct references as indirect", () => {
      const detector = new ReferenceDetector();
      const graph = new RelationshipGraph();
      graph.addRelationship("plugin:clarity", "tool:subagents", RelType.USES, 0.9);

      const text = "We use clarity with subagents"; // Mentions both
      const entities = [
        { id: "plugin:clarity", name: "Clarity", normalized: "clarity" },
        { id: "tool:subagents", name: "Subagents", normalized: "subagents" },
      ];

      const refs = detector.detectWithGraph(text, entities, graph);

      const clarityRefs = refs.filter((r) => r.entityId === "plugin:clarity");
      expect(clarityRefs.length).toBe(1); // Only direct, not indirect
      expect(clarityRefs[0].indirect).toBe(false);
    });

    it("should work without graph (direct only)", () => {
      const detector = new ReferenceDetector();
      const text = "We use the clarity plugin";
      const entities = [{ id: "plugin:clarity", name: "Clarity", normalized: "clarity" }];

      const refs = detector.detectWithGraph(text, entities, null);

      expect(refs).toHaveLength(1);
      expect(refs[0].entityId).toBe("plugin:clarity");
    });
  });

  describe("pronoun detection", () => {
    it("should detect pronoun references when enabled", () => {
      const detector = new ReferenceDetector({ enablePronouns: true });
      const text = "It is working well";
      const previousRefs = [
        {
          entityId: "plugin:clarity",
          name: "Clarity",
          normalized: "clarity",
          position: 0,
          entityType: "plugin",
        },
      ];

      const refs = detector.detectPronounReferences(text, previousRefs);

      expect(refs.length).toBeGreaterThan(0);
      expect(refs[0].isPronoun).toBe(true);
      expect(refs[0].via).toBe("it");
    });

    it("should skip pronoun detection when disabled", () => {
      const detector = new ReferenceDetector({ enablePronouns: false });
      const text = "It is working";
      const previousRefs = [{ entityId: "plugin:clarity", entityType: "plugin", position: 0 }];

      const refs = detector.detectPronounReferences(text, previousRefs);

      expect(refs).toHaveLength(0);
    });

    it("should handle empty previous references", () => {
      const detector = new ReferenceDetector();
      const text = "It is working";

      const refs = detector.detectPronounReferences(text, []);

      expect(refs).toHaveLength(0);
    });
  });

  describe("pattern caching", () => {
    it("should cache patterns for performance", () => {
      const detector = new ReferenceDetector();
      const entity = { id: "plugin:clarity", name: "Clarity", normalized: "clarity" };

      // First call should build and cache
      detector._buildPatterns(entity);
      expect(detector._patternCache.has("plugin:clarity")).toBe(true);

      // Second call should use cache
      const patterns = detector._buildPatterns(entity);
      expect(patterns).toBeDefined();
    });

    it("should clear cache on request", () => {
      const detector = new ReferenceDetector();
      detector._buildPatterns({ id: "test", name: "Test", normalized: "test" });

      detector.clearCache();

      expect(detector._patternCache.size).toBe(0);
    });
  });

  describe("confidence calculation", () => {
    it("should boost confidence for long matches", () => {
      const detector = new ReferenceDetector();
      const text = "The long_entity_name_here is working";
      const entities = [
        {
          id: "entity:long_entity_name_here",
          name: "LongEntityNameHere",
          normalized: "long_entity_name_here",
        },
      ];

      const refs = detector.detectReferences(text, entities);

      expect(refs[0].confidence).toBeGreaterThan(0.9);
    });

    it("should reduce confidence for short matches", () => {
      const detector = new ReferenceDetector();
      const text = "The x tool";
      const entities = [{ id: "tool:x", name: "X", normalized: "x" }];

      const refs = detector.detectReferences(text, entities);

      if (refs.length > 0) {
        expect(refs[0].confidence).toBeLessThan(0.8);
      }
    });
  });

  describe("edge cases", () => {
    it("should handle entities without all fields", () => {
      const detector = new ReferenceDetector();
      const text = "We use clarity";
      const entities = [{ id: "plugin:clarity" }]; // Missing name and normalized

      const refs = detector.detectReferences(text, entities);

      expect(refs.length).toBeGreaterThan(0);
    });

    it("should handle special regex characters in entity names", () => {
      const detector = new ReferenceDetector();
      const text = "The test.value is working";
      const entities = [{ id: "entity:test.value", name: "test.value", normalized: "test.value" }];

      const refs = detector.detectReferences(text, entities);

      expect(refs).toHaveLength(1);
    });

    it("should handle multiple occurrences", () => {
      const detector = new ReferenceDetector();
      const text = "Clarity is good. We use Clarity often.";
      const entities = [{ id: "plugin:clarity", name: "Clarity", normalized: "clarity" }];

      const refs = detector.detectReferences(text, entities);

      // Should detect both but only return one reference per entity
      expect(refs).toHaveLength(1);
    });
  });
});

// Run tests
console.log("Running ReferenceDetector Tests...");
