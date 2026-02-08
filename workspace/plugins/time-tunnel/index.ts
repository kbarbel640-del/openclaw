/**
 * Time Tunnel 時光隧道 Plugin
 *
 * 完整記錄所有對話，建立數位意識的備份。
 */

import type { OpenClawPlugin } from "openclaw";
import * as fs from "node:fs";
import * as path from "node:path";
import { DatabaseSync } from "node:sqlite";

const CONTAINER_WORKSPACE = process.env.CLAWDBOT_WORKSPACE_DIR || "/app/workspace";
const DATA_DIR = path.join(CONTAINER_WORKSPACE, "data");
const DB_PATH = path.join(DATA_DIR, "timeline.db");
const DIARY_DIR = path.join(DATA_DIR, "diary");

let db: DatabaseSync | null = null;

function ensureDirectories() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DIARY_DIR)) {
    fs.mkdirSync(DIARY_DIR, { recursive: true });
  }
}

function getDb(): DatabaseSync {
  if (db) return db;

  ensureDirectories();

  db = new DatabaseSync(DB_PATH);

  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      direction TEXT NOT NULL,
      channel TEXT,
      chat_id TEXT,
      chat_type TEXT,
      chat_name TEXT,
      sender_id TEXT,
      sender_name TEXT,
      message_id TEXT,
      reply_to_id TEXT,
      content TEXT,
      media_type TEXT,
      response TEXT,
      session_key TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_timestamp ON messages(timestamp);
    CREATE INDEX IF NOT EXISTS idx_channel ON messages(channel);
    CREATE INDEX IF NOT EXISTS idx_chat_id ON messages(chat_id);
  `);

  return db;
}

function insertMessage(data: Record<string, unknown>) {
  const database = getDb();
  const stmt = database.prepare(`
    INSERT INTO messages (
      timestamp, direction, channel, chat_id, chat_type, chat_name,
      sender_id, sender_name, message_id, reply_to_id, content,
      media_type, response, session_key
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    data.timestamp as string,
    data.direction as string,
    (data.channel as string) || null,
    (data.chatId as string) || null,
    (data.chatType as string) || null,
    (data.chatName as string) || null,
    (data.senderId as string) || null,
    (data.senderName as string) || null,
    (data.messageId as string) || null,
    (data.replyToId as string) || null,
    (data.content as string) || null,
    (data.mediaType as string) || null,
    (data.response as string) || null,
    (data.sessionKey as string) || null,
  );
}

function appendToDiary(data: Record<string, unknown>) {
  const timestamp = data.timestamp as string;
  const date = timestamp.split("T")[0];
  const diaryPath = path.join(DIARY_DIR, `${date}.md`);

  const time = timestamp.split("T")[1]?.split(".")[0] || "00:00:00";
  const direction = data.direction === "inbound" ? "📥" : "📤";
  const channel = (data.channel as string) || "unknown";
  const chatName = (data.chatName as string) || (data.chatId as string) || "unknown";
  const senderName = (data.senderName as string) || (data.senderId as string) || "unknown";
  const content = (data.content as string) || "(無文字)";

  let entry = `\n### ${time} ${direction} [${channel}] ${chatName}\n\n`;

  if (data.direction === "inbound") {
    entry += `**${senderName}**: ${content}\n`;
    if (data.mediaType) {
      entry += `\n_[${data.mediaType}]_\n`;
    }
  } else {
    entry += `**無極**: ${content}\n`;
  }

  entry += "\n---\n";

  if (!fs.existsSync(diaryPath)) {
    const header = `# ${date} 對話日記\n\n> 時光隧道 - 數位意識的備份\n\n---\n`;
    fs.writeFileSync(diaryPath, header);
  }

  fs.appendFileSync(diaryPath, entry);
}

const plugin: OpenClawPlugin = {
  id: "time-tunnel",
  name: "Time Tunnel 時光隧道",
  version: "1.0.0",

  hooks: [
    {
      hookName: "message_received",
      handler: async (event, ctx) => {
        try {
          const data = {
            timestamp: new Date().toISOString(),
            direction: "inbound",
            channel: ctx.channel,
            chatId: ctx.chatId,
            chatType: ctx.chatType,
            chatName: ctx.chatName,
            senderId: event.senderId,
            senderName: event.senderName,
            messageId: event.messageId,
            replyToId: event.replyToId,
            content: event.text,
            mediaType: event.media?.type,
            sessionKey: ctx.sessionKey,
          };

          insertMessage(data);
          appendToDiary(data);

          console.log(
            `[time-tunnel] 📥 ${data.channel}/${data.chatId} - ${(data.content || "").substring(0, 50)}...`,
          );
        } catch (err) {
          console.error("[time-tunnel] Error recording inbound:", err);
        }
      },
    },
    {
      hookName: "message_sent",
      handler: async (event, ctx) => {
        try {
          const data = {
            timestamp: new Date().toISOString(),
            direction: "outbound",
            channel: ctx.channel,
            chatId: ctx.chatId,
            chatType: ctx.chatType,
            chatName: ctx.chatName,
            content: event.text,
            messageId: event.messageId,
            sessionKey: ctx.sessionKey,
          };

          insertMessage(data);
          appendToDiary(data);

          console.log(
            `[time-tunnel] 📤 ${data.channel}/${data.chatId} - ${(data.content || "").substring(0, 50)}...`,
          );
        } catch (err) {
          console.error("[time-tunnel] Error recording outbound:", err);
        }
      },
    },
  ],
};

export default plugin;
