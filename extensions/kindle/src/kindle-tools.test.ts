import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs/promises", () => {
  return {
    default: {
      readFile: vi.fn(),
      stat: vi.fn(),
    },
  };
});

import fs from "node:fs/promises";
import type { OpenClawPluginApi } from "../../../src/plugins/types.js";
import { createKindleTools, parseClippings } from "./kindle-tools.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXTURE_CLIPPINGS = `Thinking, Fast and Slow (Daniel Kahneman)
- Your Highlight on page 25 | location 302-305 | Added on Monday, January 15, 2024 3:42:17 PM

Nothing in life is as important as you think it is, while you are thinking about it.
==========
Thinking, Fast and Slow (Daniel Kahneman)
- Your Highlight on page 35 | location 402-410 | Added on Tuesday, January 16, 2024 10:15:00 AM

A reliable way to make people believe in falsehoods is frequent repetition, because familiarity is not easily distinguished from truth.
==========
Sapiens: A Brief History of Humankind (Yuval Noah Harari)
- Your Highlight on page 12 | location 150-155 | Added on Wednesday, January 17, 2024 2:00:00 PM

You could never convince a monkey to give you a banana by promising him limitless bananas after death in monkey heaven.
==========
Sapiens: A Brief History of Humankind (Yuval Noah Harari)
- Your Note on page 13 | location 160 | Added on Wednesday, January 17, 2024 2:05:00 PM

This is a great point about shared myths.
==========
Sapiens: A Brief History of Humankind (Yuval Noah Harari)
- Your Bookmark on page 14 | location 170 | Added on Wednesday, January 17, 2024 2:10:00 PM

==========
The Design of Everyday Things (Don Norman)
- Your Highlight on page 1 | location 10-12 | Added on Thursday, January 18, 2024 8:00:00 AM

Good design is actually a lot harder to notice than poor design, in part because good designs fit our needs so well that the design is invisible.
==========`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fakeApi(overrides: Record<string, unknown> = {}) {
  return {
    id: "kindle",
    name: "kindle",
    source: "test",
    config: {},
    pluginConfig: { clippingsPath: "/fake/My Clippings.txt" },
    runtime: { version: "test" },
    logger: { debug() {}, info() {}, warn() {}, error() {} },
    registerTool() {},
    registerHook() {},
    registerHttpHandler() {},
    registerHttpRoute() {},
    registerChannel() {},
    registerGatewayMethod() {},
    registerCli() {},
    registerService() {},
    registerProvider() {},
    registerCommand() {},
    on() {},
    resolvePath: (p: string) => p,
    ...overrides,
  } as unknown as OpenClawPluginApi;
}

function mockFs() {
  vi.mocked(fs.stat).mockResolvedValue({ mtimeMs: Date.now() } as Awaited<
    ReturnType<typeof fs.stat>
  >);
  vi.mocked(fs.readFile).mockResolvedValue(FIXTURE_CLIPPINGS);
}

function getTools(api?: OpenClawPluginApi) {
  const tools = createKindleTools(api ?? fakeApi());
  const search = tools.find((t) => t.name === "kindle_search_highlights")!;
  const listBooks = tools.find((t) => t.name === "kindle_list_books")!;
  const getBook = tools.find((t) => t.name === "kindle_get_book_highlights")!;
  return { search, listBooks, getBook };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("parseClippings", () => {
  it("correctly parses highlights, notes, and bookmarks", () => {
    const clippings = parseClippings(FIXTURE_CLIPPINGS);
    expect(clippings).toHaveLength(6);

    const highlights = clippings.filter((c) => c.type === "highlight");
    expect(highlights).toHaveLength(4);

    const notes = clippings.filter((c) => c.type === "note");
    expect(notes).toHaveLength(1);

    const bookmarks = clippings.filter((c) => c.type === "bookmark");
    expect(bookmarks).toHaveLength(1);
    expect(notes[0]!.content).toBe("This is a great point about shared myths.");
  });

  it("parses book title and author correctly", () => {
    const clippings = parseClippings(FIXTURE_CLIPPINGS);
    const first = clippings[0]!;
    expect(first.bookTitle).toBe("Thinking, Fast and Slow");
    expect(first.author).toBe("Daniel Kahneman");
  });

  it("parses page, location, and date", () => {
    const clippings = parseClippings(FIXTURE_CLIPPINGS);
    const first = clippings[0]!;
    expect(first.page).toBe(25);
    expect(first.location).toBe("302-305");
    expect(first.date).toBe("Monday, January 15, 2024 3:42:17 PM");
  });

  it("handles missing author gracefully", () => {
    const raw = `A Book Without Author
- Your Highlight on page 1 | location 1-5 | Added on Monday, January 1, 2024 12:00:00 PM

Some text here.
==========`;
    const clippings = parseClippings(raw);
    expect(clippings).toHaveLength(1);
    expect(clippings[0]!.bookTitle).toBe("A Book Without Author");
    expect(clippings[0]!.author).toBe("");
  });

  it("handles empty/malformed entries", () => {
    const raw = `==========

==========
Just a title line
==========
Some Book (Author)
- Not a valid meta line

Content here
==========`;
    const clippings = parseClippings(raw);
    expect(clippings).toHaveLength(0);
  });

  it("handles multi-line content", () => {
    const raw = `Some Book (Author)
- Your Highlight on page 5 | location 50-55 | Added on Monday, January 1, 2024 12:00:00 PM

First line of highlight.
Second line of highlight.
Third line.
==========`;
    const clippings = parseClippings(raw);
    expect(clippings).toHaveLength(1);
    expect(clippings[0]!.content).toBe(
      "First line of highlight.\nSecond line of highlight.\nThird line.",
    );
  });
});

describe("kindle_search_highlights", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFs();
  });

  it("finds highlights matching query text", async () => {
    const { search } = getTools();
    // oxlint-disable-next-line typescript/no-explicit-any
    const res = (await search.execute("id", { query: "monkey" })) as any;
    expect(res.details).toHaveLength(1);
    expect(res.details[0].bookTitle).toBe("Sapiens: A Brief History of Humankind");
  });

  it("filters by book title when specified", async () => {
    const { search } = getTools();
    // oxlint-disable-next-line typescript/no-explicit-any
    const res = (await search.execute("id", { query: "a", book: "Thinking" })) as any;
    for (const item of res.details) {
      expect(item.bookTitle).toContain("Thinking");
    }
  });

  it("is case-insensitive", async () => {
    const { search } = getTools();
    // oxlint-disable-next-line typescript/no-explicit-any
    const lower = (await search.execute("id", { query: "NOTHING IN LIFE" })) as any;
    expect(lower.details).toHaveLength(1);
    // oxlint-disable-next-line typescript/no-explicit-any
    const upper = (await search.execute("id", { query: "nothing in life" })) as any;
    expect(upper.details).toHaveLength(1);
  });

  it("respects limit", async () => {
    const { search } = getTools();
    // Search for common word that matches many highlights
    // oxlint-disable-next-line typescript/no-explicit-any
    const res = (await search.execute("id", { query: "is", limit: 2 })) as any;
    expect(res.details.length).toBeLessThanOrEqual(2);
  });
});

describe("kindle_list_books", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFs();
  });

  it("returns books sorted by highlight count", async () => {
    const { listBooks } = getTools();
    // oxlint-disable-next-line typescript/no-explicit-any
    const res = (await listBooks.execute("id", {})) as any;
    const counts = res.details.map((b: { highlightCount: number }) => b.highlightCount);
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i - 1]).toBeGreaterThanOrEqual(counts[i]);
    }
  });

  it("includes correct highlight counts (excludes bookmarks)", async () => {
    const { listBooks } = getTools();
    // oxlint-disable-next-line typescript/no-explicit-any
    const res = (await listBooks.execute("id", {})) as any;

    const thinking = res.details.find(
      (b: { bookTitle: string }) => b.bookTitle === "Thinking, Fast and Slow",
    );
    expect(thinking.highlightCount).toBe(2);

    // Sapiens has 1 highlight + 1 note (bookmark excluded)
    const sapiens = res.details.find(
      (b: { bookTitle: string }) => b.bookTitle === "Sapiens: A Brief History of Humankind",
    );
    expect(sapiens.highlightCount).toBe(2);

    const design = res.details.find(
      (b: { bookTitle: string }) => b.bookTitle === "The Design of Everyday Things",
    );
    expect(design.highlightCount).toBe(1);
  });
});

describe("kindle_get_book_highlights", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFs();
  });

  it("returns all highlights for a matching book", async () => {
    const { getBook } = getTools();
    const res = (await getBook.execute("id", {
      book: "Thinking, Fast and Slow",
      // oxlint-disable-next-line typescript/no-explicit-any
    })) as any;
    expect(res.details).toHaveLength(2);
    for (const item of res.details) {
      expect(item.bookTitle).toBe("Thinking, Fast and Slow");
    }
  });

  it("supports partial book title match and excludes bookmarks", async () => {
    const { getBook } = getTools();
    // oxlint-disable-next-line typescript/no-explicit-any
    const res = (await getBook.execute("id", { book: "Sapiens" })) as any;
    // Sapiens has 3 clippings (highlight + note + bookmark), but bookmark is excluded
    expect(res.details).toHaveLength(2);
    for (const item of res.details) {
      expect(item.bookTitle).toContain("Sapiens");
      expect(item.type).not.toBe("bookmark");
    }
  });

  it("returns results ordered by page/location", async () => {
    const { getBook } = getTools();
    // oxlint-disable-next-line typescript/no-explicit-any
    const res = (await getBook.execute("id", { book: "Thinking" })) as any;
    const pages = res.details.map((h: { page: number }) => h.page);
    for (let i = 1; i < pages.length; i++) {
      expect(pages[i - 1]).toBeLessThanOrEqual(pages[i]);
    }
  });
});

describe("error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("all tools throw when clippingsPath is missing", async () => {
    const api = fakeApi({ pluginConfig: {} });
    const { search, listBooks, getBook } = getTools(api);

    await expect(search.execute("id", { query: "test" })).rejects.toThrow(/clippingsPath/);
    await expect(listBooks.execute("id", {})).rejects.toThrow(/clippingsPath/);
    await expect(getBook.execute("id", { book: "test" })).rejects.toThrow(/clippingsPath/);
  });

  it("tools throw readable error when file does not exist", async () => {
    vi.mocked(fs.stat).mockRejectedValue(new Error("ENOENT"));
    const { search } = getTools();
    await expect(search.execute("id", { query: "test" })).rejects.toThrow(
      /clippings file not found/i,
    );
  });
});
