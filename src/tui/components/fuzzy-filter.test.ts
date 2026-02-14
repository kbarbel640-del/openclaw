import { describe, expect, it } from "vitest";
import {
  isWordBoundary,
  findWordBoundaryIndex,
  fuzzyMatchLower,
  fuzzyFilterLower,
  prepareSearchItems,
} from "./fuzzy-filter.js";

// ---------------------------------------------------------------------------
// isWordBoundary
// ---------------------------------------------------------------------------

describe("isWordBoundary", () => {
  it("returns true at index 0 (start of string)", () => {
    expect(isWordBoundary("hello", 0)).toBe(true);
  });

  it("returns true after word boundary characters", () => {
    expect(isWordBoundary("a-b", 2)).toBe(true);
    expect(isWordBoundary("a_b", 2)).toBe(true);
    expect(isWordBoundary("a b", 2)).toBe(true);
    expect(isWordBoundary("a/b", 2)).toBe(true);
    expect(isWordBoundary("a.b", 2)).toBe(true);
    expect(isWordBoundary("a:b", 2)).toBe(true);
  });

  it("returns false within a word", () => {
    expect(isWordBoundary("hello", 3)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// findWordBoundaryIndex
// ---------------------------------------------------------------------------

describe("findWordBoundaryIndex", () => {
  it("returns null for empty query", () => {
    expect(findWordBoundaryIndex("hello world", "")).toBeNull();
  });

  it("finds match at start of string", () => {
    expect(findWordBoundaryIndex("hello world", "hello")).toBe(0);
  });

  it("finds match at word boundary", () => {
    expect(findWordBoundaryIndex("hello-world", "world")).toBe(6);
  });

  it("is case-insensitive", () => {
    expect(findWordBoundaryIndex("Hello World", "world")).toBe(6);
  });

  it("returns null when no word boundary match", () => {
    expect(findWordBoundaryIndex("helloworld", "world")).toBeNull();
  });

  it("returns null when query is longer than text", () => {
    expect(findWordBoundaryIndex("hi", "hello")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// fuzzyMatchLower
// ---------------------------------------------------------------------------

describe("fuzzyMatchLower", () => {
  it("returns 0 for empty query", () => {
    expect(fuzzyMatchLower("", "hello")).toBe(0);
  });

  it("returns null when query longer than text", () => {
    expect(fuzzyMatchLower("hello", "hi")).toBeNull();
  });

  it("matches exact substring", () => {
    const score = fuzzyMatchLower("hello", "hello world");
    expect(score).not.toBeNull();
  });

  it("matches fuzzy characters", () => {
    const score = fuzzyMatchLower("hlo", "hello");
    expect(score).not.toBeNull();
  });

  it("returns null for no match", () => {
    expect(fuzzyMatchLower("xyz", "hello")).toBeNull();
  });

  it("scores consecutive matches better than gaps", () => {
    const consecutive = fuzzyMatchLower("hel", "hello");
    const gapped = fuzzyMatchLower("hlo", "hello");
    expect(consecutive).not.toBeNull();
    expect(gapped).not.toBeNull();
    expect(consecutive!).toBeLessThan(gapped!);
  });

  it("scores word boundary matches better", () => {
    const boundary = fuzzyMatchLower("w", "hello-world");
    const mid = fuzzyMatchLower("o", "hello-world");
    expect(boundary).not.toBeNull();
    expect(mid).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// fuzzyFilterLower
// ---------------------------------------------------------------------------

describe("fuzzyFilterLower", () => {
  const items = [
    { searchTextLower: "apple pie" },
    { searchTextLower: "banana split" },
    { searchTextLower: "cherry tart" },
  ];

  it("returns all items for empty query", () => {
    expect(fuzzyFilterLower(items, "")).toEqual(items);
    expect(fuzzyFilterLower(items, "  ")).toEqual(items);
  });

  it("filters matching items", () => {
    const result = fuzzyFilterLower(items, "app");
    expect(result).toHaveLength(1);
    expect(result[0].searchTextLower).toBe("apple pie");
  });

  it("supports space-separated token matching (all must match)", () => {
    const result = fuzzyFilterLower(items, "ban spl");
    expect(result).toHaveLength(1);
    expect(result[0].searchTextLower).toBe("banana split");
  });

  it("returns empty when no matches", () => {
    expect(fuzzyFilterLower(items, "xyz")).toEqual([]);
  });

  it("sorts by match score", () => {
    const data = [
      { searchTextLower: "some-config-path" },
      { searchTextLower: "apple pie" },
      { searchTextLower: "configuration" },
    ];
    const result = fuzzyFilterLower(data, "config");
    // Non-matching "apple pie" should be excluded
    expect(result.every((r) => r.searchTextLower !== "apple pie")).toBe(true);
    expect(result.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// prepareSearchItems
// ---------------------------------------------------------------------------

describe("prepareSearchItems", () => {
  it("combines label, description, and searchText into searchTextLower", () => {
    const items = [{ label: "Hello", description: "World", searchText: "Extra" }];
    const result = prepareSearchItems(items);
    expect(result[0].searchTextLower).toBe("hello world extra");
  });

  it("handles missing fields", () => {
    const items = [{ label: "Only Label" }];
    const result = prepareSearchItems(items);
    expect(result[0].searchTextLower).toBe("only label");
  });

  it("handles empty items", () => {
    const items = [{}];
    const result = prepareSearchItems(items);
    expect(result[0].searchTextLower).toBe("");
  });

  it("preserves original item fields", () => {
    const items = [{ label: "Test", extra: 42 }];
    const result = prepareSearchItems(items);
    expect(result[0].label).toBe("Test");
    expect((result[0] as Record<string, unknown>).extra).toBe(42);
  });
});
