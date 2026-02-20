/**
 * Unit tests for RelationshipGraph
 */

"use strict";

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
    toBeLessThanOrEqual(expected) {
      if (!(actual <= expected)) {
        throw new Error(`Expected ${actual} to be <= ${expected}`);
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
    toThrow(expectedMessage) {
      try {
        actual();
        throw new Error(`Expected function to throw`);
      } catch (err) {
        if (expectedMessage && !err.message.includes(expectedMessage)) {
          throw new Error(`Expected error with "${expectedMessage}", got "${err.message}"`);
        }
      }
    },
  };
}

// Tests
describe("RelationshipGraph", () => {
  describe("Constructor", () => {
    it("should create graph with default options", () => {
      const graph = new RelationshipGraph();
      expect(graph.currentTurn).toBe(0);
    });

    it("should accept custom options", () => {
      const graph = new RelationshipGraph({
        decayHalfLife: 30,
        maxRelationshipsPerEntity: 100,
      });
      expect(graph.currentTurn).toBe(0);
    });
  });

  describe("addRelationship", () => {
    it("should add a relationship", () => {
      const graph = new RelationshipGraph();
      const rel = graph.addRelationship("plugin:clarity", "tool:subagents", RelType.USES, 0.8);

      expect(rel).toBeDefined();
      expect(rel.sourceId).toBe("plugin:clarity");
      expect(rel.targetId).toBe("tool:subagents");
      expect(rel.type).toBe(RelType.USES);
      expect(rel.strength).toBe(0.8);
    });

    it("should throw on missing sourceId", () => {
      const graph = new RelationshipGraph();
      expect(() => graph.addRelationship(null, "target", RelType.RELATED)).toThrow("required");
    });

    it("should throw on missing targetId", () => {
      const graph = new RelationshipGraph();
      expect(() => graph.addRelationship("source", null, RelType.RELATED)).toThrow("required");
    });

    it("should return null for self-loops", () => {
      const graph = new RelationshipGraph();
      const rel = graph.addRelationship("entity:a", "entity:a", RelType.RELATED);
      expect(rel).toBeNull();
    });

    it("should clamp strength to 0-1", () => {
      const graph = new RelationshipGraph();
      const rel1 = graph.addRelationship("a", "b", RelType.RELATED, 1.5);
      expect(rel1.strength).toBe(1);

      const rel2 = graph.addRelationship("a", "c", RelType.RELATED, -0.5);
      expect(rel2.strength).toBe(0);
    });

    it("should strengthen existing relationship", () => {
      const graph = new RelationshipGraph();
      graph.addRelationship("a", "b", RelType.RELATED, 0.5);
      const rel = graph.addRelationship("a", "b", RelType.RELATED, 0.3);

      expect(rel.cooccurrenceCount).toBe(2);
      expect(rel.strength).toBeGreaterThan(0.5);
    });
  });

  describe("getRelated", () => {
    it("should return related entities", () => {
      const graph = new RelationshipGraph();
      graph.addRelationship("plugin:clarity", "tool:subagents", RelType.USES, 0.8);
      graph.addRelationship("plugin:clarity", "project:openclaw", RelType.DEPENDS_ON, 0.6);

      const related = graph.getRelated("plugin:clarity", 0);

      expect(related).toHaveLength(2);
      expect(related[0].strength).toBeGreaterThanOrEqual(related[1].strength);
    });

    it("should filter by minimum strength", () => {
      const graph = new RelationshipGraph();
      graph.addRelationship("a", "b", RelType.RELATED, 0.8);
      graph.addRelationship("a", "c", RelType.RELATED, 0.3);

      const related = graph.getRelated("a", 0.5);

      expect(related).toHaveLength(1);
      expect(related[0].entityId).toBe("b");
    });

    it("should return empty array for unknown entity", () => {
      const graph = new RelationshipGraph();
      const related = graph.getRelated("unknown", 0);
      expect(related).toHaveLength(0);
    });

    it("should support indirect relationships with depth", () => {
      const graph = new RelationshipGraph();
      graph.addRelationship("a", "b", RelType.RELATED, 0.8);
      graph.addRelationship("b", "c", RelType.RELATED, 0.8);

      const related = graph.getRelated("a", 0, { includeIndirect: true, indirectDepth: 2 });

      expect(related.length).toBeGreaterThan(1);
      expect(related.some((r) => r.entityId === "c")).toBe(true);
    });
  });

  describe("detectCooccurrences", () => {
    it("should detect co-occurrences in window", () => {
      const graph = new RelationshipGraph();
      const text = "The clarity plugin uses subagents for spawning sessions";
      const entities = [
        { id: "plugin:clarity", positions: [1] },
        { id: "tool:subagents", positions: [4] },
      ];

      const rels = graph.detectCooccurrences(text, entities, { windowSize: 5 });

      expect(rels.length).toBeGreaterThan(0);
    });

    it("should create bidirectional relationships", () => {
      const graph = new RelationshipGraph();
      const text = "clarity and subagents work together";
      const entities = [
        { id: "a", positions: [0] },
        { id: "b", positions: [2] },
      ];

      graph.detectCooccurrences(text, entities, { windowSize: 5 });

      const relatedA = graph.getRelated("a", 0);
      const relatedB = graph.getRelated("b", 0);

      expect(relatedA.length).toBeGreaterThan(0);
      expect(relatedB.length).toBeGreaterThan(0);
    });

    it("should calculate strength based on proximity", () => {
      const graph = new RelationshipGraph();
      const text = "a b c d e f g h";
      const entities = [
        { id: "entity:a", positions: [0] },
        { id: "entity:b", positions: [2] },
        { id: "entity:c", positions: [7] },
      ];

      graph.detectCooccurrences(text, entities, { windowSize: 10 });

      const relatedA = graph.getRelated("entity:a", 0);

      // a and b are closer than a and c
      const relAB = relatedA.find((r) => r.entityId === "entity:b");
      const relAC = relatedA.find((r) => r.entityId === "entity:c");

      if (relAB && relAC) {
        expect(relAB.strength).toBeGreaterThan(relAC.strength);
      }
    });
  });

  describe("removeRelationship", () => {
    it("should remove existing relationship", () => {
      const graph = new RelationshipGraph();
      graph.addRelationship("a", "b", RelType.RELATED, 0.8);

      const removed = graph.removeRelationship("a", "b");

      expect(removed).toBe(true);
      expect(graph.getRelated("a", 0)).toHaveLength(0);
    });

    it("should return false for non-existing relationship", () => {
      const graph = new RelationshipGraph();
      const removed = graph.removeRelationship("a", "b");
      expect(removed).toBe(false);
    });
  });

  describe("getRelationships", () => {
    it("should return all relationships for entity", () => {
      const graph = new RelationshipGraph();
      graph.addRelationship("a", "b", RelType.USES, 0.8);
      graph.addRelationship("c", "a", RelType.DEPENDS_ON, 0.6);

      const rels = graph.getRelationships("a");

      expect(rels).toHaveLength(2);
    });

    it("should apply decay to relationship strength", () => {
      const graph = new RelationshipGraph();
      graph.setCurrentTurn(0);
      graph.addRelationship("a", "b", RelType.RELATED, 1.0);

      graph.setCurrentTurn(20); // One half-life later
      const rels = graph.getRelationships("a");

      expect(rels[0].strength).toBeLessThan(0.6);
      expect(rels[0].strength).toBeGreaterThan(0.3);
    });
  });

  describe("getStats", () => {
    it("should return correct statistics", () => {
      const graph = new RelationshipGraph();
      graph.addRelationship("a", "b", RelType.USES, 0.8);
      graph.addRelationship("a", "c", RelType.RELATED, 0.6);
      graph.addRelationship("b", "c", RelType.DEPENDS_ON, 0.5);

      const stats = graph.getStats();

      expect(stats.entityCount).toBe(3);
      expect(stats.totalRelationships).toBe(3);
      expect(stats.averageRelationshipsPerEntity).toBe(1);
      expect(stats.typeDistribution[RelType.USES]).toBe(1);
      expect(stats.typeDistribution[RelType.RELATED]).toBe(1);
      expect(stats.typeDistribution[RelType.DEPENDS_ON]).toBe(1);
    });

    it("should handle empty graph", () => {
      const graph = new RelationshipGraph();
      const stats = graph.getStats();

      expect(stats.entityCount).toBe(0);
      expect(stats.totalRelationships).toBe(0);
      expect(stats.averageRelationshipsPerEntity).toBe(0);
    });
  });

  describe("toJSON / fromJSON", () => {
    it("should serialize to JSON", () => {
      const graph = new RelationshipGraph();
      graph.setCurrentTurn(42);
      graph.addRelationship("a", "b", RelType.USES, 0.8);

      const json = graph.toJSON();

      expect(json.version).toBe("1.0");
      expect(json.currentTurn).toBe(42);
      expect(json.relationships).toHaveLength(1);
      expect(json.config).toBeDefined();
    });

    it("should deserialize from JSON", () => {
      const original = new RelationshipGraph();
      original.setCurrentTurn(42);
      original.addRelationship("a", "b", RelType.USES, 0.8);

      const json = original.toJSON();
      const restored = RelationshipGraph.fromJSON(json);

      expect(restored.currentTurn).toBe(42);
      expect(restored.getRelated("a", 0)).toHaveLength(1);
    });

    it("should preserve relationship properties", () => {
      const graph = new RelationshipGraph();
      graph.setCurrentTurn(10);
      graph.addRelationship("a", "b", RelType.USES, 0.8);

      const json = graph.toJSON();
      const restored = RelationshipGraph.fromJSON(json);
      const rels = restored.getRelationships("a");

      expect(rels[0].type).toBe(RelType.USES);
      expect(rels[0].strength).toBe(0.8);
    });
  });

  describe("fromString", () => {
    it("should parse JSON string", () => {
      const graph = new RelationshipGraph();
      graph.addRelationship("a", "b", RelType.RELATED, 0.5);

      const jsonString = JSON.stringify(graph.toJSON());
      const restored = RelationshipGraph.fromString(jsonString);

      expect(restored.getRelated("a", 0)).toHaveLength(1);
    });

    it("should throw on invalid JSON", () => {
      expect(() => RelationshipGraph.fromString("invalid json")).toThrow("Failed to parse");
    });
  });

  describe("pruning", () => {
    it("should prune weak relationships when limit exceeded", () => {
      const graph = new RelationshipGraph({ maxRelationshipsPerEntity: 3 });

      // Add 5 relationships from 'a'
      for (let i = 0; i < 5; i++) {
        graph.addRelationship("a", `target${i}`, RelType.RELATED, 0.1 * (i + 1));
      }

      // Should have pruned to 3
      const stats = graph.getStats();
      const relsA = graph.getRelationships("a");

      expect(relsA.length).toBeLessThanOrEqual(3);
      // Strongest relationships should be kept
      expect(relsA[0].targetId).toBe("target4");
    });
  });

  describe("turn management", () => {
    it("should update current turn", () => {
      const graph = new RelationshipGraph();
      graph.setCurrentTurn(10);
      expect(graph.currentTurn).toBe(10);
    });

    it("should increment turn", () => {
      const graph = new RelationshipGraph();
      graph.setCurrentTurn(5);
      graph.nextTurn();
      expect(graph.currentTurn).toBe(6);
    });
  });

  describe("clear", () => {
    it("should clear all relationships", () => {
      const graph = new RelationshipGraph();
      graph.addRelationship("a", "b", RelType.RELATED, 0.8);
      graph.clear();

      expect(graph.getStats().entityCount).toBe(0);
      expect(graph.currentTurn).toBe(0);
    });
  });
});

// Run tests
console.log("Running RelationshipGraph Tests...");
