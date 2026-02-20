/**
 * simple-test-runner.js - Minimal test runner for scorer tests
 * Uses Node.js built-in assert instead of Jest
 */

const assert = require("assert");
const { EntityScorer } = require("./lib/v2/scorer");
const {
  WEIGHTS,
  ANCHOR_BONUS,
  THRESHOLDS,
  RECENCY,
  TERM_FREQUENCY,
  RELATIONSHIP,
} = require("./lib/v2/weights");

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

function describe(name, fn) {
  console.log(`\n${name}`);
  fn();
}

function test(name, fn) {
  testsRun++;
  try {
    fn();
    testsPassed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    testsFailed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
  }
}

function expect(value) {
  return {
    toBe(expected) {
      assert.strictEqual(value, expected);
    },
    toBeCloseTo(expected, precision = 2) {
      const diff = Math.abs(value - expected);
      const epsilon = Math.pow(10, -precision);
      assert(diff < epsilon, `Expected ${value} to be close to ${expected}`);
    },
    toBeGreaterThan(expected) {
      assert(value > expected, `Expected ${value} to be greater than ${expected}`);
    },
    toBeLessThan(expected) {
      assert(value < expected, `Expected ${value} to be less than ${expected}`);
    },
    toBeLessThanOrEqual(expected) {
      assert(value <= expected, `Expected ${value} to be <= ${expected}`);
    },
    toHaveLength(expected) {
      assert.strictEqual(value.length, expected);
    },
    toEqual(expected) {
      assert.deepStrictEqual(value, expected);
    },
    toContainEqual(expected) {
      const found = value.some((item) => JSON.stringify(item) === JSON.stringify(expected));
      assert(found, `Expected array to contain ${JSON.stringify(expected)}`);
    },
    toBeInstanceOf(expected) {
      assert(value instanceof expected);
    },
  };
}

// ============ TESTS ============

describe("EntityScorer", () => {
  let scorer = new EntityScorer({ currentTurn: 50 });

  describe("computeTF()", () => {
    test("returns 0 for entity with no mention history", () => {
      const entity = { mentionHistory: [] };
      expect(scorer.computeTF(entity)).toBe(0);
    });

    test("returns 0 for undefined mention history", () => {
      const entity = {};
      expect(scorer.computeTF(entity)).toBe(0);
    });

    test("calculates log-scaled term frequency for recent mentions", () => {
      const entity = { mentionHistory: [50, 49, 48, 47] };
      const tf = scorer.computeTF(entity);
      expect(tf).toBeCloseTo(Math.log(5), 3);
    });

    test("ignores mentions outside recent window", () => {
      const entity = { mentionHistory: [50, 49, 30, 20] };
      const tf = scorer.computeTF(entity);
      expect(tf).toBeCloseTo(Math.log(3), 3);
    });

    test("scales logarithmically (diminishing returns)", () => {
      const entity1 = { mentionHistory: [50] };
      const entity10 = { mentionHistory: [50, 49, 48, 47, 46, 45, 44, 43, 42, 41] };

      const tf1 = scorer.computeTF(entity1);
      const tf10 = scorer.computeTF(entity10);

      expect(tf10 / tf1).toBeLessThan(5);
      expect(tf1).toBeCloseTo(Math.log(2), 3);
      expect(tf10).toBeCloseTo(Math.log(11), 3);
    });
  });

  describe("computeIDF()", () => {
    test("returns log(totalDocs) for unseen terms (default df=1)", () => {
      scorer.totalDocuments = 100;
      const idf = scorer.computeIDF("unseen_term");
      expect(idf).toBeCloseTo(Math.log(100), 3);
    });

    test("returns 0 for terms appearing in all documents", () => {
      scorer.totalDocuments = 100;
      scorer.documentFrequency.set("common_term", 100);
      const idf = scorer.computeIDF("common_term");
      expect(idf).toBe(0);
    });

    test("returns higher values for rare terms", () => {
      scorer.totalDocuments = 1000;
      scorer.documentFrequency.set("rare_term", 1);
      scorer.documentFrequency.set("common_term", 500);

      const rareIDF = scorer.computeIDF("rare_term");
      const commonIDF = scorer.computeIDF("common_term");

      expect(rareIDF).toBeGreaterThan(commonIDF);
      expect(rareIDF).toBeCloseTo(Math.log(1000), 2);
      expect(commonIDF).toBeCloseTo(Math.log(2), 2);
    });
  });

  describe("computeRecency()", () => {
    // Create fresh scorer for this describe block
    let s = new EntityScorer({ currentTurn: 50 });

    test("returns 1.0 for current turn mention", () => {
      const recency = s.computeRecency(50, 50);
      expect(recency).toBe(1.0);
    });

    test("returns maxScore for future mentions (edge case)", () => {
      const recency = s.computeRecency(60, 50);
      expect(recency).toBe(RECENCY.maxScore);
    });

    test("exponentially decays over time", () => {
      // exp(-5/5) = exp(-1) ≈ 0.368 (not 0.5 - that would be different formula)
      const recency5 = s.computeRecency(45, 50);
      expect(recency5).toBeCloseTo(Math.exp(-1), 2);

      // exp(-10/5) = exp(-2) ≈ 0.135
      const recency10 = s.computeRecency(40, 50);
      expect(recency10).toBeCloseTo(Math.exp(-2), 2);
    });

    test("approaches zero for old mentions", () => {
      const recency = s.computeRecency(0, 50);
      expect(recency).toBeCloseTo(Math.exp(-50 / RECENCY.halfLife), 5);
      expect(recency).toBeLessThan(0.01);
    });

    test("handles missing lastMentionTurn", () => {
      expect(s.computeRecency(undefined)).toBe(0);
      expect(s.computeRecency(null)).toBe(0);
    });
  });

  describe("computeRelationshipBoost()", () => {
    test("returns 0 for entities with no relationships", () => {
      const entity = { relationships: [] };
      expect(scorer.computeRelationshipBoost(entity)).toBe(0);
    });

    test("returns 0 for undefined relationships", () => {
      const entity = {};
      expect(scorer.computeRelationshipBoost(entity)).toBe(0);
    });

    test("calculates average strength correctly", () => {
      const entity = {
        relationships: [{ strength: 0.8 }, { strength: 0.6 }, { strength: 0.4 }],
      };
      const boost = scorer.computeRelationshipBoost(entity);
      expect(boost).toBe(6);
    });

    test("handles single relationship", () => {
      const entity = {
        relationships: [{ strength: 0.5 }],
      };
      const boost = scorer.computeRelationshipBoost(entity);
      expect(boost).toBe(5);
    });

    test("caps at max when all relationships have strength 1", () => {
      const entity = {
        relationships: [{ strength: 1.0 }, { strength: 1.0 }],
      };
      const boost = scorer.computeRelationshipBoost(entity);
      expect(boost).toBe(RELATIONSHIP.strengthMultiplier);
    });
  });

  describe("scoreEntity()", () => {
    test("returns zero score for null entity", () => {
      const result = scorer.scoreEntity(null);
      expect(result.totalScore).toBe(0);
      expect(result.isAboveThreshold.track).toBe(false);
    });

    test("applies reduced anchor bonus (5 instead of 100)", () => {
      scorer.totalDocuments = 100;
      scorer.documentFrequency.set("anchored", 50);
      scorer.currentTurn = 50;

      const entity = {
        id: "test:anchored",
        name: "Anchored",
        normalized: "anchored",
        mentionHistory: [50],
        lastMentionTurn: 50,
        isAnchor: true,
        relationships: [],
      };

      const result = scorer.scoreEntity(entity);
      expect(result.components.anchor.weighted).toBe(ANCHOR_BONUS);
      expect(ANCHOR_BONUS).toBe(5);
    });

    test("caps score at 100", () => {
      scorer.totalDocuments = 1000;
      scorer.documentFrequency.set("high_scorer", 1);
      scorer.currentTurn = 50;

      const entity = {
        id: "test:high_scorer",
        name: "High Scorer",
        normalized: "high_scorer",
        mentionHistory: [50, 49, 48, 47, 46, 45, 44, 43, 42, 41],
        lastMentionTurn: 50,
        isAnchor: true,
        relationships: [{ strength: 1.0 }, { strength: 0.9 }],
      };

      const result = scorer.scoreEntity(entity);
      expect(result.totalScore).toBe(100);
      expect(result.totalScore).toBeLessThanOrEqual(100);
    });

    test("returns correct threshold flags", () => {
      scorer.totalDocuments = 100;
      scorer.documentFrequency.set("threshold_test", 50);
      scorer.currentTurn = 50;

      const lowEntity = {
        id: "test:low",
        normalized: "low",
        mentionHistory: [30],
        lastMentionTurn: 30,
        isAnchor: false,
        relationships: [],
      };

      const lowResult = scorer.scoreEntity(lowEntity);
      expect(lowResult.isAboveThreshold.track).toBe(lowResult.totalScore >= THRESHOLDS.track);
    });
  });

  describe("Document Frequency Tracking", () => {
    test("updateDocumentFrequency increments term counts", () => {
      let s = new EntityScorer({ currentTurn: 50 });
      s.updateDocumentFrequency(["term1", "term2", "term1"]);

      expect(s.documentFrequency.get("term1")).toBe(1); // Set dedupes within one doc
      expect(s.documentFrequency.get("term2")).toBe(1);
      expect(s.totalDocuments).toBe(1);
    });

    test("updateDocumentFrequency handles Sets", () => {
      let s = new EntityScorer({ currentTurn: 50 });
      s.updateDocumentFrequency(new Set(["a", "b", "c"]));

      expect(s.documentFrequency.get("a")).toBe(1);
      expect(s.documentFrequency.get("b")).toBe(1);
      expect(s.documentFrequency.get("c")).toBe(1);
    });

    test("accumulates across multiple updates", () => {
      let s = new EntityScorer({ currentTurn: 50 });
      s.updateDocumentFrequency(["term1", "term2"]);
      s.updateDocumentFrequency(["term1", "term3"]);
      s.updateDocumentFrequency(["term2", "term3"]);

      expect(s.documentFrequency.get("term1")).toBe(2);
      expect(s.documentFrequency.get("term2")).toBe(2);
      expect(s.documentFrequency.get("term3")).toBe(2);
      expect(s.totalDocuments).toBe(3);
    });

    test("getDocumentFrequencyStats returns correct stats", () => {
      let s = new EntityScorer({ currentTurn: 50 });
      s.updateDocumentFrequency(["a", "b", "c"]);
      s.updateDocumentFrequency(["a", "b", "d"]);
      s.updateDocumentFrequency(["a", "e"]);

      const stats = s.getDocumentFrequencyStats();

      expect(stats.totalDocuments).toBe(3);
      expect(stats.uniqueTerms).toBe(5);
    });
  });

  describe("Serialization", () => {
    test("serialize returns correct structure", () => {
      scorer.totalDocuments = 10;
      scorer.documentFrequency.set("term1", 5);
      scorer.documentFrequency.set("term2", 3);

      const serialized = scorer.serialize();

      expect(serialized.totalDocuments).toBe(10);
      expect(serialized.documentFrequency).toContainEqual(["term1", 5]);
      expect(serialized.documentFrequency).toContainEqual(["term2", 3]);
      expect(serialized.timestamp).toBeGreaterThan(0);
    });

    test("deserialize restores scorer state", () => {
      const data = {
        totalDocuments: 100,
        documentFrequency: [
          ["rare", 1],
          ["common", 50],
        ],
      };

      const restored = EntityScorer.deserialize(data);

      expect(restored.totalDocuments).toBe(100);
      expect(restored.documentFrequency.get("rare")).toBe(1);
      expect(restored.documentFrequency.get("common")).toBe(50);
    });

    test("deserialize handles null data", () => {
      const restored = EntityScorer.deserialize(null);
      expect(restored).toBeInstanceOf(EntityScorer);
      expect(restored.totalDocuments).toBe(0);
    });
  });
});

// ============ SUMMARY ============

console.log(`\n${"=".repeat(40)}`);
console.log(`Tests run: ${testsRun}`);
console.log(`Tests passed: ${testsPassed}`);
console.log(`Tests failed: ${testsFailed}`);
console.log(`${"=".repeat(40)}`);

process.exit(testsFailed > 0 ? 1 : 0);
