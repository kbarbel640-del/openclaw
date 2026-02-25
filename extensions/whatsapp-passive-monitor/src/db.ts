import fs from "node:fs";
import path from "node:path";
import type { StoredMessage } from "./types.js";

// Re-export for test imports
export type MessageDb = {
  insertMessage: (msg: Omit<StoredMessage, "id">) => void;
  getConversationContext: (conversationId: string, limit: number) => StoredMessage[];
  close: () => void;
};

/**
 * Create a SQLite-backed message store.
 * Uses node:sqlite (Node 22+ built-in). Auto-creates schema on first run.
 */
export function createMessageDb(dbPath: string): MessageDb {
  // Ensure parent directory exists
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Dynamic import of node:sqlite via createRequire (same pattern as core)
  // oxlint-disable-next-line @typescript-eslint/no-require-imports
  const { DatabaseSync } = require("node:sqlite") as typeof import("node:sqlite");
  const db = new DatabaseSync(dbPath);

  // Create schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT NOT NULL,
      sender TEXT NOT NULL,
      sender_name TEXT,
      content TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      direction TEXT NOT NULL,
      channel_id TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_conv_ts ON messages (conversation_id, timestamp DESC);
  `);

  // Prepared statements for performance
  const insertStmt = db.prepare(`
    INSERT INTO messages (conversation_id, sender, sender_name, content, timestamp, direction, channel_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // Query: grab last N by timestamp DESC, then reverse to chronological
  const queryStmt = db.prepare(`
    SELECT id, conversation_id, sender, sender_name, content, timestamp, direction, channel_id
    FROM messages
    WHERE conversation_id = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `);

  function insertMessage(msg: Omit<StoredMessage, "id">): void {
    insertStmt.run(
      msg.conversation_id,
      msg.sender,
      msg.sender_name,
      msg.content,
      msg.timestamp,
      msg.direction,
      msg.channel_id,
    );
  }

  function getConversationContext(conversationId: string, limit: number): StoredMessage[] {
    const rows = queryStmt.all(conversationId, limit) as StoredMessage[];
    // Reverse from DESC to chronological order (oldest first)
    return rows.reverse();
  }

  function close(): void {
    db.close();
  }

  return { insertMessage, getConversationContext, close };
}
