import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { resolveStateDir } from "../../config/paths.js";
import type { CommandHandler } from "./commands-types.js";

// ============================================================================
// Types
// ============================================================================

type Bookmark = {
  id: string;
  sessionKey: string;
  label: string;
  createdAt: number;
  preview: string;
};

type BookmarkStore = {
  bookmarks: Bookmark[];
};

// ============================================================================
// Storage helpers
// ============================================================================

function resolveBookmarksPath(agentId: string): string {
  const stateDir = resolveStateDir(process.env);
  return path.join(stateDir, "agents", agentId, "bookmarks.json");
}

function loadBookmarks(bookmarksPath: string): BookmarkStore {
  try {
    const raw = fs.readFileSync(bookmarksPath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      "bookmarks" in parsed &&
      Array.isArray((parsed as { bookmarks: unknown }).bookmarks)
    ) {
      return parsed as BookmarkStore;
    }
  } catch {
    // File missing or corrupt — start with an empty store.
  }
  return { bookmarks: [] };
}

function saveBookmarks(bookmarksPath: string, store: BookmarkStore): void {
  try {
    fs.mkdirSync(path.dirname(bookmarksPath), { recursive: true });
    fs.writeFileSync(bookmarksPath, JSON.stringify(store, null, 2), "utf-8");
  } catch {
    // Best-effort; don't crash the command handler.
  }
}

// ============================================================================
// Helpers
// ============================================================================

function buildPreview(raw: string | undefined): string {
  const text = (raw ?? "").replace(/\s+/g, " ").trim();
  return text.length > 100 ? `${text.slice(0, 97)}...` : text;
}

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// ============================================================================
// Command handlers
// ============================================================================

export const handleBookmarkCreateCommand: CommandHandler = async (params, allowTextCommands) => {
  if (!allowTextCommands) {
    return null;
  }
  const body = params.command.commandBodyNormalized;
  if (body !== "/bookmark" && !body.startsWith("/bookmark ")) {
    return null;
  }
  if (!params.command.isAuthorizedSender) {
    return { shouldContinue: false };
  }

  const agentId = params.agentId ?? params.sessionKey?.split(":")?.[0] ?? "main";
  const sessionKey = params.sessionKey;

  // Extract optional label from the command body.
  const rawLabel = body.startsWith("/bookmark ") ? body.slice("/bookmark ".length).trim() : "";
  const label =
    rawLabel ||
    `Bookmark ${new Date().toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit", hour12: false })}`;

  // Build a short preview from the current message body.
  const preview = buildPreview(params.ctx.RawBody ?? params.ctx.CommandBody ?? params.ctx.Body);

  const bookmark: Bookmark = {
    id: crypto.randomUUID(),
    sessionKey,
    label,
    createdAt: Date.now(),
    preview,
  };

  const bookmarksPath = resolveBookmarksPath(agentId);
  const store = loadBookmarks(bookmarksPath);
  store.bookmarks.push(bookmark);
  saveBookmarks(bookmarksPath, store);

  return {
    shouldContinue: false,
    reply: {
      text: `🔖 Bookmark saved: *${label}*`,
    },
  };
};

export const handleBookmarkListCommand: CommandHandler = async (params, allowTextCommands) => {
  if (!allowTextCommands) {
    return null;
  }
  if (params.command.commandBodyNormalized !== "/bookmarks") {
    return null;
  }
  if (!params.command.isAuthorizedSender) {
    return { shouldContinue: false };
  }

  const agentId = params.agentId ?? params.sessionKey?.split(":")?.[0] ?? "main";
  const sessionKey = params.sessionKey;

  const bookmarksPath = resolveBookmarksPath(agentId);
  const store = loadBookmarks(bookmarksPath);

  // Filter to the current session only.
  const sessionBookmarks = store.bookmarks.filter((b) => b.sessionKey === sessionKey);

  if (sessionBookmarks.length === 0) {
    return {
      shouldContinue: false,
      reply: {
        text: "🔖 No bookmarks for the current session yet. Use `/bookmark [label]` to create one.",
      },
    };
  }

  const lines: string[] = [`🔖 *Bookmarks* (${sessionBookmarks.length})\n`];
  for (const bookmark of sessionBookmarks) {
    const ts = formatTimestamp(bookmark.createdAt);
    lines.push(`• *${bookmark.label}* — ${ts}`);
    if (bookmark.preview) {
      lines.push(`  _${bookmark.preview}_`);
    }
  }

  return {
    shouldContinue: false,
    reply: { text: lines.join("\n") },
  };
};
