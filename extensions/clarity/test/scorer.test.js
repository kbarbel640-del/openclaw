/**
 * scorer.test.js - Unit tests for EntityScorer
 *
 * Tests all scoring components: TF, IDF, Recency, Relationship, and integration.
 */

const { EntityScorer } = require("../lib/v2/scorer");
const {
  WEIGHTS,
  ANCHOR_BONUS,
  THRESHOLDS,
  RECENCY,
  TERM_FREQUENCY,
  RELATIONSHIP,
} = require("../lib/v2/weights");

describe("EntityScorer", () => {
  let scorer;

  beforeEach(() => {
    scorer = new EntityScorer({ currentTurn: 50 });
  });

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
      // Within recent window (currentTurn=50, window=10 → turns 40-50)
      const entity = {
        mentionHistory: [50, 49, 48, 47], // 4 recent mentions
      };
      const tf = scorer.computeTF(entity);
      // log(1 + 4) = log(5) ≈ 1.609
      expect(tf).toBeCloseTo(Math.log(5), 3);
    });

    test("ignores mentions outside recent window", () => {
      const entity = {
        mentionHistory: [50, 49, 30, 20], // Only 2 within window (40-50)
      };
      const tf = scorer.computeTF(entity);
      // log(1 + 2) = log(3) ≈ 1.099
      expect(tf).toBeCloseTo(Math.log(3), 3);
    });

    test("ignores future mentions (should not happen)", () => {
      const entity = {
        mentionHistory: [50, 51, 52], // 51, 52 are "future"
      };
      const tf = scorer.computeTF(entity);
      // Only turn 50 counts (current turn)
      expect(tf).toBeCloseTo(Math.log(2), 3);
    });

    test("scales logarithmically (diminishing returns)", () => {
      const entity1 = { mentionHistory: [50] }; // 1 mention
      const entity10 = { mentionHistory: [50, 49, 48, 47, 46, 45, 44, 43, 42, 41] }; // 10 mentions

      const tf1 = scorer.computeTF(entity1);
      const tf10 = scorer.computeTF(entity10);

      // log(2) ≈ 0.693 vs log(11) ≈ 2.398
      // 10x mentions should not give 10x score
      expect(tf10 / tf1).toBeLessThan(5);
      expect(tf1).toBeCloseTo(Math.log(2), 3);
      expect(tf10).toBeCloseTo(Math.log(11), 3);
    });
  });

  describe("computeIDF()", () => {
    test("returns log(totalDocs) for unseen terms (default df=1)", () => {
      scorer.totalDocuments = 100;
      const idf = scorer.computeIDF("unseen_term");
      // log(100 / 1) = log(100) ≈ 4.605
      expect(idf).toBeCloseTo(Math.log(100), 3);
    });

    test("returns 0 for terms appearing in all documents", () => {
      scorer.totalDocuments = 100;
      scorer.documentFrequency.set("common_term", 100);
      const idf = scorer.computeIDF("common_term");
      // log(100 / 100) = log(1) = 0
      expect(idf).toBe(0);
    });

    test("returns higher values for rare terms", () => {
      scorer.totalDocuments = 1000;
      scorer.documentFrequency.set("rare_term", 1);
      scorer.documentFrequency.set("common_term", 500);

      const rareIDF = scorer.computeIDF("rare_term");
      const commonIDF = scorer.computeIDF("common_term");

      // Rare term should have higher IDF
      expect(rareIDF).toBeGreaterThan(commonIDF);
      // log(1000/1) ≈ 6.9 vs log(1000/500) ≈ 0.69
      expect(rareIDF).toBeCloseTo(Math.log(1000), 2);
      expect(commonIDF).toBeCloseTo(Math.log(2), 2);
    });

    test("handles single document case", () => {
      scorer.totalDocuments = 1;
      scorer.documentFrequency.set("only_term", 1);
      const idf = scorer.computeIDF("only_term");
      expect(idf).toBe(0); // log(1/1) = 0
    });
  });

  describe("computeRecency()", () => {
    test("returns 1.0 for current turn mention", () => {
      const recency = scorer.computeRecency(50, 50);
      expect(recency).toBe(1.0);
    });

    test("returns maxScore for future mentions (edge case)", () => {
      const recency = scorer.computeRecency(60, 50); // Mentioned 10 turns in future
      expect(recency).toBe(RECENCY.maxScore);
    });

    test("exponentially decays over time", () => {
      // At halfLife (5 turns), score should be ~0.5
      const recency5 = scorer.computeRecency(45, 50);
      expect(recency5).toBeCloseTo(0.5, 2);

      // At 2*halfLife (10 turns), score should be ~0.25
      const recency10 = scorer.computeRecency(40, 50);
      expect(recency10).toBeCloseTo(0.25, 2);
    });

    test("approaches zero for old mentions", () => {
      const recency = scorer.computeRecency(0, 50); // 50 turns ago
      expect(recency).toBeCloseTo(Math.exp(-50 / RECENCY.halfLife), 5);
      expect(recency).toBeLessThan(0.01);
    });

    test("uses instance currentTurn as default", () => {
      scorer.currentTurn = 100;
      const recency = scorer.computeRecency(95); // 5 turns ago
      expect(recency).toBeCloseTo(Math.exp(-5 / RECENCY.halfLife), 5);
    });

    test("handles missing lastMentionTurn", () => {
      expect(scorer.computeRecency(undefined)).toBe(0);
      expect(scorer.computeRecency(null)).toBe(0);
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
      // Average = 0.6, scaled by 10 = 6
      expect(boost).toBe(6);
    });

    test("handles single relationship", () => {
      const entity = {
        relationships: [{ strength: 0.5 }],
      };
      const boost = scorer.computeRelationshipBoost(entity);
      expect(boost).toBe(5);
    });

    test("handles missing strength values gracefully", () => {
      const entity = {
        relationships: [
          { strength: 0.8 },
          { strength: undefined }, // Should count as 0
          { strength: 0.4 },
        ],
      };
      const boost = scorer.computeRelationshipBoost(entity);
      // Average = (0.8 + 0 + 0.4) / 3 = 0.4, scaled = 4
      expect(boost).toBeCloseTo(4, 1);
    });

    test("caps at max when all relationships have strength 1", () => {
      const entity = {
        relationships: [{ strength: 1.0 }, { strength: 1.0 }],
      };
      const boost = scorer.computeRelationshipBoost(entity);
      expect(boost).toBe(RELATIONSHIP.strengthMultiplier); // 10
    });
  });

  describe("scoreEntity()", () => {
    test("returns zero score for null entity", () => {
      const result = scorer.scoreEntity(null);
      expect(result.totalScore).toBe(0);
      expect(result.isAboveThreshold.track).toBe(false);
    });

    test("calculates weighted combination correctly", () => {
      // Set up known state
      scorer.totalDocuments = 100;
      scorer.documentFrequency.set("test_entity", 10);
      scorer.currentTurn = 50;

      const entity = {
        id: "test:test_entity",
        name: "Test Entity",
        normalized: "test_entity",
        mentionHistory: [50, 49, 48], // 3 recent mentions
        lastMentionTurn: 50,
        isAnchor: false,
        relationships: [{ strength: 0.5 }],
      };

      const result = scorer.scoreEntity(entity);

      // Calculate expected:
      // TF: log(1+3) = log(4) ≈ 1.386 * 15 = 20.79
      // IDF: log(100/10) = log(10) ≈ 2.303 * 25 = 57.57
      // Recency: exp(0/5) = 1.0 * 30 = 30
      // Anchor: 0
      // Relationship: 0.5 * 10 = 5 * 10% weight = 5
      // Total: 20.79 + 57.57 + 30 + 0 + 5 = 113.36 → capped at 100

      expect(result.totalScore).toBe(100); // Capped
      expect(result.components.tf.weighted).toBeCloseTo(Math.log(4) * WEIGHTS.tf, 1);
      expect(result.components.idf.weighted).toBeCloseTo(Math.log(10) * WEIGHTS.idf, 1);
      expect(result.components.recency.weighted).toBeCloseTo(1.0 * WEIGHTS.recency, 1);
      expect(result.components.anchor.weighted).toBe(0);
      expect(result.components.relationship.weighted).toBeCloseTo(5, 1);
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

      // Anchor bonus should be exactly 5 (not 100)
      expect(result.components.anchor.weighted).toBe(ANCHOR_BONUS);
      expect(ANCHOR_BONUS).toBe(5); // Verify the reduction from 100
    });

    test("caps score at 100", () => {
      scorer.totalDocuments = 1000;
      scorer.documentFrequency.set("high_scorer", 1); // Very rare
      scorer.currentTurn = 50;

      const entity = {
        id: "test:high_scorer",
        name: "High Scorer",
        normalized: "high_scorer",
        mentionHistory: [50, 49, 48, 47, 46, 45, 44, 43, 42, 41], // 10 mentions
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

      // Low-score entity
      const lowEntity = {
        id: "test:low",
        normalized: "low",
        mentionHistory: [30], // Old mention
        lastMentionTurn: 30,
        isAnchor: false,
        relationships: [],
      };

      const lowResult = scorer.scoreEntity(lowEntity);
      expect(lowResult.isAboveThreshold.track).toBe(lowResult.totalScore >= THRESHOLDS.track);
      expect(lowResult.isAboveThreshold.display).toBe(lowResult.totalScore >= THRESHOLDS.display);

      // High-score entity (anchor with recent mention)
      const highEntity = {
        id: "test:high",
        normalized: "high",
        mentionHistory: [50, 49, 48, 47, 46],
        lastMentionTurn: 50,
        isAnchor: true,
        relationships: [{ strength: 0.8 }],
      };

      const highResult = scorer.scoreEntity(highEntity);
      expect(highResult.isAboveThreshold.highRelevance).toBe(
        highResult.totalScore >= THRESHOLDS.highRelevance,
      );
    });

    test("uses provided currentTurn override", () => {
      scorer.currentTurn = 100;

      const entity = {
        id: "test:override",
        normalized: "override",
        mentionHistory: [50],
        lastMentionTurn: 50,
        isAnchor: false,
        relationships: [],
      };

      // Score with turn 100 (50 turns ago)
      const result1 = scorer.scoreEntity(entity, 100);
      // Score with turn 60 (10 turns ago)
      const result2 = scorer.scoreEntity(entity, 60);

      // More recent scoring should give higher recency
      expect(result2.components.recency.raw).toBeGreaterThan(result1.components.recency.raw);
    });
  });

  describe("scoreEntities()", () => {
    test("scores multiple entities", () => {
      const entities = [
        { id: "1", normalized: "one", mentionHistory: [50], lastMentionTurn: 50 },
        { id: "2", normalized: "two", mentionHistory: [49], lastMentionTurn: 49 },
      ];

      const results = scorer.scoreEntities(entities);

      expect(results).toHaveLength(2);
      expect(results[0].entityId).toBe("1");
      expect(results[1].entityId).toBe("2");
    });

    test("returns empty array for non-array input", () => {
      expect(scorer.scoreEntities(null)).toEqual([]);
      expect(scorer.scoreEntities(undefined)).toEqual([]);
      expect(scorer.scoreEntities("string")).toEqual([]);
    });

    test("returns empty array for empty input", () => {
      expect(scorer.scoreEntities([])).toEqual([]);
    });
  });

  describe("Document Frequency Tracking", () => {
    test("updateDocumentFrequency increments term counts", () => {
      scorer.updateDocumentFrequency(["term1", "term2", "term1"]);

      expect(scorer.documentFrequency.get("term1")).toBe(1); // Set dedupes
      expect(scorer.documentFrequency.get("term2")).toBe(1);
      expect(scorer.totalDocuments).toBe(1);
    });

    test("updateDocumentFrequency handles Sets", () => {
      scorer.updateDocumentFrequency(new Set(["a", "b", "c"]));

      expect(scorer.documentFrequency.get("a")).toBe(1);
      expect(scorer.documentFrequency.get("b")).toBe(1);
      expect(scorer.documentFrequency.get("c")).toBe(1);
    });

    test("updateDocumentFrequency handles null/undefined", () => {
      scorer.updateDocumentFrequency(null);
      scorer.updateDocumentFrequency(undefined);
      expect(scorer.totalDocuments).toBe(0);
    });

    test("accumulates across multiple updates", () => {
      scorer.updateDocumentFrequency(["term1", "term2"]);
      scorer.updateDocumentFrequency(["term1", "term3"]);
      scorer.updateDocumentFrequency(["term2", "term3"]);

      expect(scorer.documentFrequency.get("term1")).toBe(2);
      expect(scorer.documentFrequency.get("term2")).toBe(2);
      expect(scorer.documentFrequency.get("term3")).toBe(2);
      expect(scorer.totalDocuments).toBe(3);
    });

    test("getDocumentFrequencyStats returns correct stats", () => {
      scorer.updateDocumentFrequency(["a", "b", "c"]);
      scorer.updateDocumentFrequency(["a", "b", "d"]);
      scorer.updateDocumentFrequency(["a", "e"]);

      const stats = scorer.getDocumentFrequencyStats();

      expect(stats.totalDocuments).toBe(3);
      expect(stats.uniqueTerms).toBe(5);
      expect(stats.topTerms).toHaveLength(5);
      // 'a' appears in all 3 documents
      expect(stats.topTerms[0]).toEqual(["a", 3]);
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

    test("serialize/deserialize roundtrip preserves state", () => {
      scorer.totalDocuments = 50;
      scorer.documentFrequency.set("term", 25);

      const serialized = scorer.serialize();
      const restored = EntityScorer.deserialize(serialized);

      expect(restored.totalDocuments).toBe(scorer.totalDocuments);
      expect(restored.documentFrequency.get("term")).toBe(25);
    });
  });

  describe("Edge Cases", () => {
    test("handles entity with partial data", () => {
      const entity = {
        id: "partial",
        // Missing normalized, mentionHistory, etc.
      };

      const result = scorer.scoreEntity(entity);
      expect(result.totalScore).toBeGreaterThanOrEqual(0);
      expect(result.entityId).toBe("partial");
    });

    test("handles negative weights gracefully", () => {
      const customScorer = new EntityScorer({
        currentTurn: 50,
        weights: { tf: -10, idf: 25, recency: 30, relationship: 10 },
      });

      const entity = {
        normalized: "test",
        mentionHistory: [50, 49, 48],
        lastMentionTurn: 50,
      };

      const result = customScorer.scoreEntity(entity);
      // Negative TF weight might reduce score but shouldn't break
      expect(result.totalScore).toBeGreaterThanOrEqual(0);
    });

    test("handles very large document counts", () => {
      scorer.totalDocuments = 1000000;
      scorer.documentFrequency.set("rare", 1);

      const idf = scorer.computeIDF("rare");
      expect(idf).toBe(Math.log(1000000));
      expect(Number.isFinite(idf)).toBe(true);
    });

    test("setCurrentTurn updates internal state", () => {
      scorer.setCurrentTurn(100);
      expect(scorer.currentTurn).toBe(100);

      const entity = { lastMentionTurn: 95 };
      const recency = scorer.computeRecency(entity.lastMentionTurn);
      expect(recency).toBeCloseTo(Math.exp(-5 / RECENCY.halfLife), 5);
    });
  });
});
