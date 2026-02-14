/**
 * obsidian-search.test.ts — Tests for the Obsidian search pipeline
 */
import { describe, it, expect } from "vitest";
import {
  reciprocalRankFusion,
  type ObsidianVectorResult,
  type ObsidianKeywordResult,
} from "./obsidian-search.js";

describe("reciprocalRankFusion", () => {
  it("merges vector and keyword results by rank", () => {
    const vecResults: ObsidianVectorResult[] = [
      { id: "c1", path: "/notes/a.md", distance: 0.1, text: "chunk a", startLine: 1, endLine: 5 },
      { id: "c2", path: "/notes/b.md", distance: 0.3, text: "chunk b", startLine: 1, endLine: 5 },
      { id: "c3", path: "/notes/c.md", distance: 0.5, text: "chunk c", startLine: 1, endLine: 5 },
    ];

    const ftsResults: ObsidianKeywordResult[] = [
      { path: "/notes/b.md", bm25Score: -5.0 },
      { path: "/notes/d.md", bm25Score: -3.0 },
      { path: "/notes/a.md", bm25Score: -1.0 },
    ];

    const results = reciprocalRankFusion(vecResults, ftsResults, 60);

    // a.md: vec_rank=1 (lowest distance), fts_rank=3 → RRF = 1/61 + 1/63
    // b.md: vec_rank=2, fts_rank=1 → RRF = 1/62 + 1/61
    // Both should score high; b.md has best combined rank
    expect(results.length).toBeGreaterThanOrEqual(4);
    expect(results[0].path).toBe("/notes/b.md"); // best combined
    expect(results[1].path).toBe("/notes/a.md"); // second best

    // d.md: fts_rank=2, vec_rank=999 → lower score
    const dResult = results.find((r) => r.path === "/notes/d.md");
    expect(dResult).toBeDefined();
    expect(dResult!.vecRank).toBe(999);
    expect(dResult!.ftsRank).toBe(2);
  });

  it("handles empty vector results", () => {
    const ftsResults: ObsidianKeywordResult[] = [{ path: "/notes/a.md", bm25Score: -5.0 }];

    const results = reciprocalRankFusion([], ftsResults, 60);
    expect(results.length).toBe(1);
    expect(results[0].path).toBe("/notes/a.md");
    expect(results[0].vecRank).toBe(999);
    expect(results[0].ftsRank).toBe(1);
    expect(results[0].bestChunk).toBeNull();
  });

  it("handles empty keyword results", () => {
    const vecResults: ObsidianVectorResult[] = [
      { id: "c1", path: "/notes/a.md", distance: 0.1, text: "chunk", startLine: 1, endLine: 5 },
    ];

    const results = reciprocalRankFusion(vecResults, [], 60);
    expect(results.length).toBe(1);
    expect(results[0].ftsRank).toBe(999);
    expect(results[0].vecRank).toBe(1);
    expect(results[0].bestChunk).not.toBeNull();
  });

  it("deduplicates vector results per file (keeps best)", () => {
    const vecResults: ObsidianVectorResult[] = [
      { id: "c1", path: "/notes/a.md", distance: 0.5, text: "chunk 1", startLine: 1, endLine: 5 },
      { id: "c2", path: "/notes/a.md", distance: 0.1, text: "chunk 2", startLine: 6, endLine: 10 },
      { id: "c3", path: "/notes/a.md", distance: 0.9, text: "chunk 3", startLine: 11, endLine: 15 },
    ];

    const results = reciprocalRankFusion(vecResults, [], 60);
    expect(results.length).toBe(1);
    expect(results[0].bestChunk!.distance).toBe(0.1); // kept the best
    expect(results[0].bestChunk!.text).toBe("chunk 2");
  });

  it("scores decrease monotonically with worse ranks", () => {
    const vecResults: ObsidianVectorResult[] = Array.from({ length: 20 }, (_, i) => ({
      id: `c${i}`,
      path: `/notes/${i}.md`,
      distance: i * 0.05,
      text: `chunk ${i}`,
      startLine: 1,
      endLine: 5,
    }));

    const results = reciprocalRankFusion(vecResults, [], 60);
    for (let i = 1; i < results.length; i++) {
      expect(results[i].rrfScore).toBeLessThanOrEqual(results[i - 1].rrfScore);
    }
  });

  it("produces correct RRF score math", () => {
    const vecResults: ObsidianVectorResult[] = [
      { id: "c1", path: "/a.md", distance: 0.1, text: "", startLine: 1, endLine: 1 },
    ];
    const ftsResults: ObsidianKeywordResult[] = [{ path: "/a.md", bm25Score: -5.0 }];

    const results = reciprocalRankFusion(vecResults, ftsResults, 60);
    // Both rank 1: score = 1/61 + 1/61
    const expected = 1 / 61 + 1 / 61;
    expect(results[0].rrfScore).toBeCloseTo(expected, 10);
  });
});

describe("chunkMarkdown (via obsidian-sync)", () => {
  // Import from sync module
  it("is tested in obsidian-sync.test.ts", () => {
    expect(true).toBe(true);
  });
});
