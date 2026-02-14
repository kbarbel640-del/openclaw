/**
 * obsidian-sync.test.ts — Tests for vault sync and chunking
 */
import { describe, it, expect } from "vitest";
import { chunkMarkdown } from "./obsidian-sync.js";

describe("chunkMarkdown", () => {
  it("chunks text into segments within size limit", () => {
    const content = Array.from({ length: 50 }, (_, i) => `Line ${i + 1}: Some content here.`).join(
      "\n",
    );
    const chunks = chunkMarkdown(content, 100, 0); // ~100 tokens ≈ 400 chars
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      // Each chunk should be within 1.5x the limit (allowing for flush boundary)
      expect(chunk.text.length).toBeLessThan(400 * 1.5);
    }
  });

  it("preserves line number tracking", () => {
    const content = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5";
    const chunks = chunkMarkdown(content, 100, 0);
    expect(chunks.length).toBe(1);
    expect(chunks[0].startLine).toBe(1);
    expect(chunks[0].endLine).toBe(5);
  });

  it("applies overlap between chunks", () => {
    // Create content that will produce multiple chunks
    const lines = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}: ${"x".repeat(30)}`);
    const content = lines.join("\n");

    const chunksNoOverlap = chunkMarkdown(content, 100, 0);
    const chunksWithOverlap = chunkMarkdown(content, 100, 20);

    // With overlap, chunks should have more total text (some content repeated)
    const totalNoOverlap = chunksNoOverlap.reduce((sum, c) => sum + c.text.length, 0);
    const totalWithOverlap = chunksWithOverlap.reduce((sum, c) => sum + c.text.length, 0);

    // Overlapping chunks have more total chars
    if (chunksNoOverlap.length > 1) {
      expect(totalWithOverlap).toBeGreaterThan(totalNoOverlap);
    }
  });

  it("handles empty content", () => {
    const chunks = chunkMarkdown("", 100, 0);
    expect(chunks.length).toBe(0);
  });

  it("handles single-line content", () => {
    const chunks = chunkMarkdown("Hello world", 100, 0);
    expect(chunks.length).toBe(1);
    expect(chunks[0].text).toBe("Hello world");
    expect(chunks[0].startLine).toBe(1);
    expect(chunks[0].endLine).toBe(1);
  });

  it("generates unique hashes per chunk", () => {
    const content = Array.from(
      { length: 50 },
      (_, i) => `Unique line ${i}: ${"x".repeat(50)}`,
    ).join("\n");
    const chunks = chunkMarkdown(content, 50, 0);

    const hashes = chunks.map((c) => c.hash);
    const uniqueHashes = new Set(hashes);
    expect(uniqueHashes.size).toBe(hashes.length);
  });

  it("chunks have contiguous line coverage", () => {
    const content = Array.from({ length: 30 }, (_, i) => `Line ${i + 1}`).join("\n");
    const chunks = chunkMarkdown(content, 30, 0);

    // First chunk starts at line 1
    expect(chunks[0].startLine).toBe(1);

    // Without overlap, each chunk should start after or at the previous end
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i].startLine).toBeLessThanOrEqual(chunks[i - 1].endLine + 1);
    }

    // Last chunk should end at or near the last line
    expect(chunks[chunks.length - 1].endLine).toBe(30);
  });
});
