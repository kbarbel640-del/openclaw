import type { Collection, Document } from "mongodb";
import { describe, it, expect, vi } from "vitest";
import type { DetectedCapabilities } from "./mongodb-schema.js";
import { searchKB } from "./mongodb-kb-search.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockKBChunksCol(results: Document[] = []): Collection {
  return {
    aggregate: vi.fn(() => ({
      toArray: vi.fn(async () => results),
    })),
  } as unknown as Collection;
}

const baseCapabilities: DetectedCapabilities = {
  vectorSearch: true,
  textSearch: true,
  automatedEmbedding: false,
  scoreFusion: false,
  rankFusion: false,
};

const noSearchCapabilities: DetectedCapabilities = {
  vectorSearch: false,
  textSearch: false,
  automatedEmbedding: false,
  scoreFusion: false,
  rankFusion: false,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("searchKB", () => {
  it("returns results from vector search", async () => {
    const col = mockKBChunksCol([
      {
        path: "guide.md",
        startLine: 1,
        endLine: 10,
        text: "KB content about architecture",
        docId: "doc-1",
        score: 0.85,
      },
    ]);

    const results = await searchKB(col, "architecture", [0.1, 0.2], {
      maxResults: 5,
      minScore: 0.1,
      vectorIndexName: "test_kb_chunks_vector",
      textIndexName: "test_kb_chunks_text",
      capabilities: baseCapabilities,
      embeddingMode: "managed",
    });

    expect(results).toHaveLength(1);
    expect(results[0].source).toBe("kb");
    expect(results[0].score).toBe(0.85);
    expect(results[0].snippet).toContain("KB content about architecture");
  });

  it("returns empty results when no matches", async () => {
    const col = mockKBChunksCol([]);

    const results = await searchKB(col, "nonexistent", [0.1, 0.2], {
      maxResults: 5,
      minScore: 0.1,
      vectorIndexName: "test_kb_chunks_vector",
      textIndexName: "test_kb_chunks_text",
      capabilities: baseCapabilities,
      embeddingMode: "managed",
    });

    expect(results).toHaveLength(0);
  });

  it("filters results below minScore threshold", async () => {
    const col = mockKBChunksCol([
      { path: "low.md", startLine: 1, endLine: 5, text: "Low score content", score: 0.05 },
    ]);

    const results = await searchKB(col, "content", [0.1], {
      maxResults: 5,
      minScore: 0.3,
      vectorIndexName: "test_kb_chunks_vector",
      textIndexName: "test_kb_chunks_text",
      capabilities: baseCapabilities,
      embeddingMode: "managed",
    });

    expect(results).toHaveLength(0);
  });

  it("falls back to $text search when no vector capabilities", async () => {
    const col = mockKBChunksCol([
      { path: "fallback.md", startLine: 1, endLine: 3, text: "Fallback text match", score: 1.5 },
    ]);

    const results = await searchKB(col, "fallback", null, {
      maxResults: 5,
      minScore: 0.1,
      vectorIndexName: "test_kb_chunks_vector",
      textIndexName: "test_kb_chunks_text",
      capabilities: noSearchCapabilities,
      embeddingMode: "managed",
    });

    expect(results).toHaveLength(1);
    expect(results[0].source).toBe("kb");
  });

  it("uses automated embedding mode query", async () => {
    const col = mockKBChunksCol([
      { path: "auto.md", startLine: 1, endLine: 5, text: "Auto embed result", score: 0.9 },
    ]);

    const results = await searchKB(col, "auto embed", null, {
      maxResults: 5,
      minScore: 0.1,
      vectorIndexName: "test_kb_chunks_vector",
      textIndexName: "test_kb_chunks_text",
      capabilities: baseCapabilities,
      embeddingMode: "automated",
    });

    expect(results).toHaveLength(1);
    // In automated mode, vector search uses query text instead of queryVector
    const aggregateCalls = (col.aggregate as ReturnType<typeof vi.fn>).mock.calls;
    expect(aggregateCalls.length).toBeGreaterThan(0);
  });
});
