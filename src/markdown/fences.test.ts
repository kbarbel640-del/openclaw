import { describe, expect, it } from "vitest";
import { parseFenceSpans, findFenceSpanAt, isSafeFenceBreak } from "./fences.js";

describe("parseFenceSpans", () => {
  it("returns empty for plain text", () => {
    expect(parseFenceSpans("hello world")).toEqual([]);
  });

  it("detects a backtick fence", () => {
    const text = "before\n```\ncode\n```\nafter";
    const spans = parseFenceSpans(text);
    expect(spans).toHaveLength(1);
    expect(spans[0].marker).toBe("```");
    expect(text.slice(spans[0].start, spans[0].end)).toContain("code");
  });

  it("detects a tilde fence", () => {
    const text = "~~~\ncode\n~~~";
    const spans = parseFenceSpans(text);
    expect(spans).toHaveLength(1);
    expect(spans[0].marker).toBe("~~~");
  });

  it("detects multiple fences", () => {
    const text = "```\na\n```\n\n```\nb\n```";
    const spans = parseFenceSpans(text);
    expect(spans).toHaveLength(2);
  });

  it("handles unclosed fence", () => {
    const text = "```\nopen code";
    const spans = parseFenceSpans(text);
    expect(spans).toHaveLength(1);
    expect(spans[0].end).toBe(text.length);
  });

  it("requires matching marker type to close", () => {
    const text = "```\ncode\n~~~";
    const spans = parseFenceSpans(text);
    // tilde can't close backtick fence; stays open
    expect(spans).toHaveLength(1);
    expect(spans[0].end).toBe(text.length);
  });

  it("allows longer marker to close shorter", () => {
    const text = "```\ncode\n````";
    const spans = parseFenceSpans(text);
    expect(spans).toHaveLength(1);
    // Closed by the longer marker (end is at end-of-line = text.length since no trailing newline)
    expect(spans[0].end).toBe(text.length);
  });

  it("captures indent", () => {
    const text = "  ```\n  code\n  ```";
    const spans = parseFenceSpans(text);
    expect(spans).toHaveLength(1);
    expect(spans[0].indent).toBe("  ");
  });
});

describe("findFenceSpanAt", () => {
  it("returns undefined outside any span", () => {
    const spans = parseFenceSpans("plain text");
    expect(findFenceSpanAt(spans, 5)).toBeUndefined();
  });

  it("finds span at index inside fence", () => {
    const text = "before\n```\ncode\n```\nafter";
    const spans = parseFenceSpans(text);
    const codePos = text.indexOf("code");
    expect(findFenceSpanAt(spans, codePos)).toBeDefined();
  });

  it("returns undefined at span boundary (start)", () => {
    const text = "```\ncode\n```";
    const spans = parseFenceSpans(text);
    // At exact start boundary, findFenceSpanAt uses strict >
    expect(findFenceSpanAt(spans, 0)).toBeUndefined();
  });
});

describe("isSafeFenceBreak", () => {
  it("returns true outside fences", () => {
    const text = "a\n```\ncode\n```\nb";
    const spans = parseFenceSpans(text);
    expect(isSafeFenceBreak(spans, 0)).toBe(true);
  });

  it("returns false inside a fence", () => {
    const text = "```\ncode\n```";
    const spans = parseFenceSpans(text);
    const codePos = text.indexOf("code");
    expect(isSafeFenceBreak(spans, codePos)).toBe(false);
  });
});
