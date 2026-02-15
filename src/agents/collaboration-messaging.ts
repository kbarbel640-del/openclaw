/**
 * COLLABORATION MESSAGING
 *
 * Handles persistence of agent-to-agent messages.
 * Messages are stored in .collaboration-storage/messages.jsonl
 */

import fs from "node:fs/promises";
import path from "node:path";
import { loadConfig } from "../config/config.js";

export type AgentMessage = {
  id: string;
  from: string;
  to: string;
  topic: string;
  content: string;
  timestamp: number;
  read: boolean;
};

function getStoragePath(): string {
  const cfg = loadConfig();
  const workspace = cfg.agents?.defaults?.workspace || "./";
  return path.join(workspace, ".collaboration-storage");
}

function getMessagesPath(): string {
  return path.join(getStoragePath(), "messages.jsonl");
}

/**
 * Save a new message to disk (append only)
 */
export async function persistMessage(msg: AgentMessage): Promise<void> {
  try {
    const storePath = getStoragePath();
    await fs.mkdir(storePath, { recursive: true });

    const filePath = getMessagesPath();
    const line = JSON.stringify(msg) + "\n";
    await fs.appendFile(filePath, line, "utf-8");
  } catch (err) {
    console.error("Failed to persist agent message:", err);
  }
}

/**
 * Load all messages from disk
 */
export async function loadMessages(filter?: {
  recipientId?: string;
  topic?: string;
  senderId?: string;
  since?: number;
}): Promise<AgentMessage[]> {
  try {
    const filePath = getMessagesPath();
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.split("\n").filter(Boolean);

    const messages = lines
      .map((line) => {
        try {
          return JSON.parse(line) as AgentMessage;
        } catch {
          return null;
        }
      })
      .filter((m): m is AgentMessage => m !== null);

    return messages.filter((msg) => {
      if (filter?.recipientId && msg.to !== filter.recipientId) {
        return false;
      }
      if (filter?.senderId && msg.from !== filter.senderId) {
        return false;
      }
      if (filter?.topic && msg.topic !== filter.topic) {
        return false;
      }
      if (filter?.since && msg.timestamp < filter.since) {
        return false;
      }
      return true;
    });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("Failed to load agent messages:", err);
    }
    return [];
  }
}

/**
 * Mark messages as read (requires rewriting the file - potentially expensive)
 * optimizing to only do this periodically or on demand
 */
export async function markMessagesRead(messageIds: string[]): Promise<void> {
  if (messageIds.length === 0) {
    return;
  }

  try {
    const filePath = getMessagesPath();
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.split("\n").filter(Boolean);

    const newLines = lines.map((line) => {
      try {
        const msg = JSON.parse(line) as AgentMessage;
        if (messageIds.includes(msg.id)) {
          msg.read = true;
          return JSON.stringify(msg);
        }
        return line;
      } catch {
        return line;
      }
    });

    await fs.writeFile(filePath, newLines.join("\n") + "\n", "utf-8");
  } catch (err) {
    console.error("Failed to mark messages as read:", err);
  }
}
