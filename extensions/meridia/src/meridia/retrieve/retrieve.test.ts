import { describe, expect, it } from "vitest";
import type { MeridiaExperienceRecord } from "../types.js";
import { buildReconstitutionIntent, buildSearchIntent } from "./intent.js";
import { rankResults, type ScoredResult } from "./ranker.js";
import { NullVectorAdapter, GraphitiVectorAdapter } from "./vector-adapter.js";

// ────────────────────────────────────────────────────────────────────────
// Test helpers
// ────────────────────────────────────────────────────────────────────────

function makeRecord(
  id: string,
  score: number,
  toolName = "bash",
  hoursAgo = 0,
): MeridiaExperienceRecord {
  const ts = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
  return {
    id,
    ts,
    kind: "tool_result",
    session: { key: "s1" },
    tool: { name: toolName, callId: `tc-${id}`, isError: false },
    capture: {
      score,
      evaluation: { kind: "heuristic", score, reason: `reason for ${id}` },
    },
    data: {},
  };
}

function makeScoredResult(
  id: string,
  score: number,
  source: "canonical" | "vector" = "canonical",
  toolName = "bash",
  hoursAgo = 0,
  sourceScore = 0,
): ScoredResult {
  return {
    record: makeRecord(id, score, toolName, hoursAgo),
    source,
    sourceScore,
    finalScore: score,
  };
}

// ────────────────────────────────────────────────────────────────────────
// Intent tests
// ────────────────────────────────────────────────────────────────────────

describe("retrieve/intent", () => {
  describe("buildReconstitutionIntent", () => {
    it("builds an intent with time window", () => {
      const intent = buildReconstitutionIntent({
        lookbackHours: 24,
        minScore: 0.6,
        maxResults: 50,
        sessionKey: "s1",
      });

      expect(intent.timeWindow).toBeDefined();
      expect(intent.minScore).toBe(0.6);
      expect(intent.maxResults).toBe(50);
      expect(intent.sessionKey).toBe("s1");
      expect(intent.query).toBeUndefined();
    });

    it("calculates correct time window", () => {
      const before = Date.now();
      const intent = buildReconstitutionIntent({
        lookbackHours: 48,
        minScore: 0.5,
        maxResults: 10,
      });
      const after = Date.now();

      const fromMs = Date.parse(intent.timeWindow!.from);
      const toMs = Date.parse(intent.timeWindow!.to);
      const expectedFromMs = before - 48 * 60 * 60 * 1000;

      expect(fromMs).toBeGreaterThanOrEqual(expectedFromMs - 100);
      expect(toMs).toBeGreaterThanOrEqual(before);
      expect(toMs).toBeLessThanOrEqual(after + 100);
    });
  });

  describe("buildSearchIntent", () => {
    it("builds an intent with query", () => {
      const intent = buildSearchIntent({
        query: "debugging",
        limit: 15,
      });

      expect(intent.query).toBe("debugging");
      expect(intent.maxResults).toBe(15);
      expect(intent.timeWindow).toBeUndefined();
    });

    it("builds an intent with date range", () => {
      const intent = buildSearchIntent({
        from: "2025-01-01",
        to: "2025-01-31",
      });

      expect(intent.timeWindow!.from).toBe("2025-01-01");
      expect(intent.timeWindow!.to).toBe("2025-01-31");
      expect(intent.maxResults).toBe(20); // default
    });

    it("builds an intent with from only", () => {
      const intent = buildSearchIntent({ from: "2025-01-01" });
      expect(intent.timeWindow!.from).toBe("2025-01-01");
      expect(intent.timeWindow!.to).toBeTruthy(); // defaults to now
    });

    it("passes through all filters", () => {
      const intent = buildSearchIntent({
        query: "test",
        sessionKey: "s1",
        toolName: "bash",
        minScore: 0.7,
        tag: "debug",
      });
      expect(intent.sessionKey).toBe("s1");
      expect(intent.toolName).toBe("bash");
      expect(intent.minScore).toBe(0.7);
      expect(intent.tag).toBe("debug");
    });
  });
});

// ────────────────────────────────────────────────────────────────────────
// Ranker tests
// ────────────────────────────────────────────────────────────────────────

describe("retrieve/ranker", () => {
  describe("rankResults", () => {
    it("deduplicates by record ID", () => {
      const results: ScoredResult[] = [
        makeScoredResult("r1", 0.9, "canonical", "bash", 0, -5),
        makeScoredResult("r1", 0.9, "vector", "bash", 0, 0.8),
      ];

      const ranked = rankResults(results, 10);
      expect(ranked).toHaveLength(1);
    });

    it("keeps result with higher source score during dedup", () => {
      const results: ScoredResult[] = [
        makeScoredResult("r1", 0.9, "canonical", "bash", 0, -10),
        makeScoredResult("r1", 0.9, "vector", "bash", 0, 0.8),
      ];

      const ranked = rankResults(results, 10);
      expect(ranked[0]!.source).toBe("vector");
    });

    it("ranks higher significance records first", () => {
      const results: ScoredResult[] = [
        makeScoredResult("r1", 0.5, "canonical"),
        makeScoredResult("r2", 0.9, "canonical"),
      ];

      const ranked = rankResults(results, 10);
      expect(ranked[0]!.record.id).toBe("r2");
    });

    it("considers recency in ranking", () => {
      const results: ScoredResult[] = [
        makeScoredResult("r1", 0.7, "canonical", "bash", 48), // 48 hours old
        makeScoredResult("r2", 0.7, "canonical", "bash", 0), // brand new
      ];

      const ranked = rankResults(results, 10);
      // r2 should rank higher due to recency
      expect(ranked[0]!.record.id).toBe("r2");
    });

    it("applies diversity penalty for same-tool clustering", () => {
      const results: ScoredResult[] = [
        makeScoredResult("r1", 0.8, "canonical", "bash", 0),
        makeScoredResult("r2", 0.79, "canonical", "bash", 0),
        makeScoredResult("r3", 0.78, "canonical", "read", 0),
      ];

      const ranked = rankResults(results, 10);
      // "read" tool should get boosted relative position due to diversity
      const readIdx = ranked.findIndex((r) => r.record.tool?.name === "read");
      expect(readIdx).toBeLessThanOrEqual(2);
    });

    it("limits results to maxResults", () => {
      const results: ScoredResult[] = Array.from({ length: 20 }, (_, i) =>
        makeScoredResult(`r${i}`, 0.5 + i * 0.02, "canonical"),
      );

      const ranked = rankResults(results, 5);
      expect(ranked).toHaveLength(5);
    });

    it("handles empty input", () => {
      const ranked = rankResults([], 10);
      expect(ranked).toEqual([]);
    });

    it("respects custom weights", () => {
      const results: ScoredResult[] = [
        makeScoredResult("r1", 0.5, "canonical", "bash", 0),
        makeScoredResult("r2", 0.9, "canonical", "bash", 48),
      ];

      // Weight recency heavily
      const ranked = rankResults(results, 10, { recency: 0.8, significance: 0.1 });
      expect(ranked[0]!.record.id).toBe("r1");
    });
  });
});

// ────────────────────────────────────────────────────────────────────────
// Vector adapter tests
// ────────────────────────────────────────────────────────────────────────

describe("retrieve/vector-adapter", () => {
  describe("NullVectorAdapter", () => {
    it("is not available", async () => {
      const adapter = new NullVectorAdapter();
      expect(await adapter.isAvailable()).toBe(false);
    });

    it("returns empty results", async () => {
      const adapter = new NullVectorAdapter();
      expect(await adapter.search("test")).toEqual([]);
    });
  });

  describe("GraphitiVectorAdapter", () => {
    it("checks availability via search", async () => {
      const client = {
        searchMemoryFacts: async () => ({ facts: [] }),
      };
      const adapter = new GraphitiVectorAdapter(client);
      expect(await adapter.isAvailable()).toBe(true);
    });

    it("returns false when client throws", async () => {
      const client = {
        searchMemoryFacts: async () => {
          throw new Error("Connection refused");
        },
      };
      const adapter = new GraphitiVectorAdapter(client);
      expect(await adapter.isAvailable()).toBe(false);
    });

    it("maps search results to VectorMatch", async () => {
      const client = {
        searchMemoryFacts: async () => ({
          facts: [
            { uuid: "id-1", fact: "some fact", score: 0.8 },
            { uuid: "id-2", fact: "other fact" },
          ],
        }),
      };
      const adapter = new GraphitiVectorAdapter(client);
      const results = await adapter.search("query");

      expect(results).toHaveLength(2);
      expect(results[0]!.id).toBe("id-1");
      expect(results[0]!.similarity).toBe(0.8);
      expect(results[1]!.similarity).toBe(0.5); // default when no score
    });

    it("returns empty array on search error", async () => {
      const client = {
        searchMemoryFacts: async () => {
          throw new Error("timeout");
        },
      };
      const adapter = new GraphitiVectorAdapter(client);
      expect(await adapter.search("query")).toEqual([]);
    });

    it("passes topK option", async () => {
      let capturedParams: unknown;
      const client = {
        searchMemoryFacts: async (params: unknown) => {
          capturedParams = params;
          return { facts: [] };
        },
      };
      const adapter = new GraphitiVectorAdapter(client, "my-group");
      await adapter.search("test", { topK: 5 });

      expect(capturedParams).toEqual({
        query: "test",
        group_ids: ["my-group"],
        max_facts: 5,
      });
    });
  });
});
