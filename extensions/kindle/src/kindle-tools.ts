import { Type } from "@sinclair/typebox";
import fs from "node:fs/promises";
import type { OpenClawPluginApi } from "../../../src/plugins/types.js";

export type KindleClipping = {
  bookTitle: string;
  author: string;
  type: "highlight" | "note" | "bookmark";
  page?: number;
  location?: string;
  date?: string;
  content: string;
};

const META_RE =
  /^-\s*Your\s+(Highlight|Note|Bookmark)\s+(?:on\s+page\s+(\d+)\s*\|?\s*)?(?:location\s+([\d-]+)\s*\|?\s*)?(?:Added\s+on\s+(.+))?$/i;

function parseBookLine(line: string): { bookTitle: string; author: string } {
  const match = line.match(/^(.+)\s+\(([^)]+)\)\s*$/);
  if (match) {
    return { bookTitle: match[1]!.trim(), author: match[2]!.trim() };
  }
  return { bookTitle: line.trim(), author: "" };
}

function parseClippingType(raw: string): KindleClipping["type"] {
  const lower = raw.toLowerCase();
  if (lower === "highlight") return "highlight";
  if (lower === "note") return "note";
  return "bookmark";
}

export function parseClippings(raw: string): KindleClipping[] {
  const blocks = raw.split("==========");
  const clippings: KindleClipping[] = [];

  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trimEnd());

    while (lines.length > 0 && lines[0]!.trim() === "") {
      lines.shift();
    }

    if (lines.length < 2) continue;

    const bookLine = lines[0]!;
    const metaLine = lines[1]!;

    if (!bookLine.trim() || !metaLine.trim()) continue;

    const { bookTitle, author } = parseBookLine(bookLine);
    const metaMatch = metaLine.match(META_RE);
    if (!metaMatch) continue;

    const clipType = parseClippingType(metaMatch[1]!);
    const page = metaMatch[2] ? Number.parseInt(metaMatch[2], 10) : undefined;
    const location = metaMatch[3]?.trim() || undefined;
    const date = metaMatch[4]?.trim() || undefined;

    const contentLines = lines.slice(2);
    while (contentLines.length > 0 && contentLines[0]!.trim() === "") {
      contentLines.shift();
    }
    const content = contentLines.join("\n").trim();

    clippings.push({
      bookTitle,
      author,
      type: clipType,
      page,
      location,
      date,
      content,
    });
  }

  return clippings;
}

let cache: { path: string; mtime: number; clippings: KindleClipping[] } | null = null;

async function loadClippings(filePath: string): Promise<KindleClipping[]> {
  let stat: Awaited<ReturnType<typeof fs.stat>>;
  try {
    stat = await fs.stat(filePath);
  } catch {
    throw new Error(`Kindle clippings file not found: ${filePath}`);
  }

  const mtime = stat.mtimeMs;
  if (cache && cache.path === filePath && cache.mtime === mtime) {
    return cache.clippings;
  }

  const raw = await fs.readFile(filePath, "utf-8");
  const clippings = parseClippings(raw);
  cache = { path: filePath, mtime, clippings };
  return clippings;
}

function resolveClippingsPath(api: OpenClawPluginApi): string {
  const cfg = api.pluginConfig as { clippingsPath?: string } | undefined;
  if (!cfg?.clippingsPath) {
    throw new Error("clippingsPath is not configured. Set it in the Kindle plugin config.");
  }
  return api.resolvePath(cfg.clippingsPath);
}

export function createKindleTools(api: OpenClawPluginApi) {
  const searchHighlights = {
    name: "kindle_search_highlights",
    label: "Search Kindle Highlights",
    description:
      "Search your Kindle highlights and notes by text query, optionally filtering by book title.",
    parameters: Type.Object({
      query: Type.String({ description: "Text to search for in highlight content" }),
      book: Type.Optional(Type.String({ description: "Filter by book title (substring match)" })),
      limit: Type.Optional(Type.Number({ description: "Max results to return (default 20)" })),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const filePath = resolveClippingsPath(api);
      const clippings = await loadClippings(filePath);

      const query = (typeof params.query === "string" ? params.query : "").toLowerCase();
      const bookFilter = typeof params.book === "string" ? params.book.toLowerCase() : undefined;
      const limit = typeof params.limit === "number" ? params.limit : 20;

      const matches = clippings.filter((c) => {
        if (c.type === "bookmark") return false;
        const contentMatch = c.content.toLowerCase().includes(query);
        if (!contentMatch) return false;
        if (bookFilter && !c.bookTitle.toLowerCase().includes(bookFilter)) return false;
        return true;
      });

      const results = matches.slice(0, limit).map((c) => ({
        bookTitle: c.bookTitle,
        author: c.author,
        type: c.type,
        page: c.page,
        location: c.location,
        content: c.content,
      }));

      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
        details: results,
      };
    },
  };

  const listBooks = {
    name: "kindle_list_books",
    label: "List Kindle Books",
    description:
      "List all books in your Kindle clippings with highlight counts, sorted by count descending.",
    parameters: Type.Object({
      limit: Type.Optional(Type.Number({ description: "Max books to return (default 50)" })),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const filePath = resolveClippingsPath(api);
      const clippings = await loadClippings(filePath);

      const limit = typeof params.limit === "number" ? params.limit : 50;

      const bookMap = new Map<string, { author: string; count: number }>();
      for (const c of clippings) {
        if (c.type === "bookmark") continue;
        const existing = bookMap.get(c.bookTitle);
        if (existing) {
          existing.count++;
        } else {
          bookMap.set(c.bookTitle, { author: c.author, count: 1 });
        }
      }

      const books = [...bookMap.entries()]
        .map(([title, info]) => ({
          bookTitle: title,
          author: info.author,
          highlightCount: info.count,
        }))
        .sort((a, b) => b.highlightCount - a.highlightCount)
        .slice(0, limit);

      return {
        content: [{ type: "text", text: JSON.stringify(books, null, 2) }],
        details: books,
      };
    },
  };

  const getBookHighlights = {
    name: "kindle_get_book_highlights",
    label: "Get Book Highlights",
    description: "Get all highlights for a specific book by exact or partial title match.",
    parameters: Type.Object({
      book: Type.String({ description: "Book title or partial title to match" }),
      limit: Type.Optional(Type.Number({ description: "Max highlights to return (default 50)" })),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const filePath = resolveClippingsPath(api);
      const clippings = await loadClippings(filePath);

      const bookQuery = (typeof params.book === "string" ? params.book : "").toLowerCase();
      const limit = typeof params.limit === "number" ? params.limit : 50;

      const matches = clippings.filter(
        (c) => c.type !== "bookmark" && c.bookTitle.toLowerCase().includes(bookQuery),
      );

      matches.sort((a, b) => {
        const pageDiff = (a.page ?? 0) - (b.page ?? 0);
        if (pageDiff !== 0) return pageDiff;
        const locA = a.location?.split("-")[0] ?? "0";
        const locB = b.location?.split("-")[0] ?? "0";
        return Number.parseInt(locA, 10) - Number.parseInt(locB, 10);
      });

      const results = matches.slice(0, limit).map((c) => ({
        bookTitle: c.bookTitle,
        author: c.author,
        type: c.type,
        page: c.page,
        location: c.location,
        content: c.content,
      }));

      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
        details: results,
      };
    },
  };

  return [searchHighlights, listBooks, getBookHighlights];
}
