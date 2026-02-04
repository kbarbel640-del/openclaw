import { describe, expect, it } from "vitest";

import {
  formatProactiveMemorySection,
  buildProactiveContextSection,
  type MemorySnippet,
} from "./proactive-memory.js";

describe("proactive-memory", () => {
  describe("formatProactiveMemorySection", () => {
    it("returns empty string for empty memories", () => {
      const result = formatProactiveMemorySection([]);
      expect(result).toBe("");
    });

    it("formats single memory snippet", () => {
      const memories: MemorySnippet[] = [
        {
          path: "memory/2026-01-15-api-design.md",
          score: 0.85,
          snippet: "Discussed REST API design patterns and pagination.",
          source: "memory",
        },
      ];

      const result = formatProactiveMemorySection(memories);

      expect(result).toContain("<proactive-memory>");
      expect(result).toContain("</proactive-memory>");
      expect(result).toContain("Relevant memories from previous sessions");
      expect(result).toContain("[memory] memory/2026-01-15-api-design.md (score: 0.85)");
      expect(result).toContain("Discussed REST API design patterns");
    });

    it("formats multiple memory snippets", () => {
      const memories: MemorySnippet[] = [
        {
          path: "memory/2026-01-15-api.md",
          score: 0.9,
          snippet: "First memory content",
          source: "memory",
        },
        {
          path: "sessions/2026-01-14.jsonl",
          score: 0.75,
          snippet: "Second memory content",
          source: "sessions",
        },
      ];

      const result = formatProactiveMemorySection(memories);

      expect(result).toContain("[memory] memory/2026-01-15-api.md (score: 0.90)");
      expect(result).toContain("[sessions] sessions/2026-01-14.jsonl (score: 0.75)");
      expect(result).toContain("First memory content");
      expect(result).toContain("Second memory content");
    });

    it("rounds score to 2 decimal places", () => {
      const memories: MemorySnippet[] = [
        {
          path: "test.md",
          score: 0.8888888,
          snippet: "test",
          source: "memory",
        },
      ];

      const result = formatProactiveMemorySection(memories);
      expect(result).toContain("(score: 0.89)");
    });
  });

  describe("buildProactiveContextSection", () => {
    it("returns empty string when no memories and reminder disabled", () => {
      const result = buildProactiveContextSection({
        memories: [],
        includeReminder: false,
      });
      expect(result).toBe("");
    });

    it("includes only reminder when no memories but reminder enabled", () => {
      const result = buildProactiveContextSection({
        memories: [],
        includeReminder: true,
      });

      expect(result).toContain("<style-reminder>");
      expect(result).toContain("반말만 사용");
      expect(result).toContain('"~요" 금지');
      expect(result).toContain("</style-reminder>");
      expect(result).not.toContain("<proactive-memory>");
    });

    it("includes both memories and reminder when both present", () => {
      const memories: MemorySnippet[] = [
        {
          path: "test.md",
          score: 0.8,
          snippet: "test content",
          source: "memory",
        },
      ];

      const result = buildProactiveContextSection({
        memories,
        includeReminder: true,
      });

      expect(result).toContain("<proactive-memory>");
      expect(result).toContain("test content");
      expect(result).toContain("</proactive-memory>");
      expect(result).toContain("<style-reminder>");
      expect(result).toContain("반말만 사용");
      expect(result).toContain("</style-reminder>");
    });

    it("includes only memories when reminder disabled", () => {
      const memories: MemorySnippet[] = [
        {
          path: "test.md",
          score: 0.8,
          snippet: "test content",
          source: "memory",
        },
      ];

      const result = buildProactiveContextSection({
        memories,
        includeReminder: false,
      });

      expect(result).toContain("<proactive-memory>");
      expect(result).toContain("test content");
      expect(result).not.toContain("<style-reminder>");
    });
  });
});
