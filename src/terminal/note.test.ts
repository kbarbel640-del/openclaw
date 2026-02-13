import { describe, expect, it } from "vitest";
import { wrapNoteMessage } from "./note.js";

describe("wrapNoteMessage", () => {
  it("returns short text unchanged", () => {
    expect(wrapNoteMessage("hello world", { maxWidth: 80 })).toBe("hello world");
  });

  it("wraps long lines at word boundaries", () => {
    const input = "the quick brown fox jumps over the lazy dog";
    const result = wrapNoteMessage(input, { maxWidth: 20 });
    const lines = result.split("\n");
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(20);
    }
  });

  it("preserves existing newlines", () => {
    const input = "line one\nline two\nline three";
    const result = wrapNoteMessage(input, { maxWidth: 80 });
    expect(result).toBe("line one\nline two\nline three");
  });

  it("preserves blank lines", () => {
    const input = "before\n\nafter";
    const result = wrapNoteMessage(input, { maxWidth: 80 });
    expect(result).toContain("\n\n");
  });

  it("handles bullet points with continuation indent", () => {
    const input = "- this is a very long bullet point that should wrap to the next line properly";
    const result = wrapNoteMessage(input, { maxWidth: 40 });
    const lines = result.split("\n");
    expect(lines[0]).toMatch(/^- /);
    if (lines.length > 1) {
      // Continuation lines should be indented to align with bullet content
      expect(lines[1]).toMatch(/^\s{2}/);
    }
  });

  it("handles indented text", () => {
    const input = "  indented text here";
    const result = wrapNoteMessage(input, { maxWidth: 80 });
    expect(result).toMatch(/^\s{2}/);
  });

  it("splits very long words", () => {
    const longWord = "a".repeat(100);
    const result = wrapNoteMessage(longWord, { maxWidth: 30 });
    const lines = result.split("\n");
    expect(lines.length).toBeGreaterThan(1);
  });

  it("uses columns option for default width calculation", () => {
    const input = "short";
    const result = wrapNoteMessage(input, { columns: 120 });
    expect(result).toBe("short");
  });
});
