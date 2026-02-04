import { CoreMemories, FlashEntry, KeywordSearchResult } from "./index.js";
import { SessionContinuation } from "./session-continuation.js";

export interface SessionContinuationIntegration {
  enabled: boolean;
  lastSessionFile: string;
}

export async function initSessionContinuation(
  coreMemories: CoreMemories,
  userId: string = "default",
): Promise<string | undefined> {
  try {
    const lastSession = await getLastSessionTime(userId);

    if (!lastSession) {
      return undefined;
    }

    const sc = new SessionContinuation(coreMemories);
    const result = await sc.checkSession(userId, lastSession.timestamp);

    await updateLastSessionTime(userId);

    return result.message;
  } catch {
    return undefined;
  }
}

export async function heartbeatSessionCheck(coreMemories: CoreMemories): Promise<void> {
  try {
    const flashEntries = coreMemories.getFlashEntries();
    const highSalience = flashEntries.filter((e: FlashEntry) => e.emotionalSalience > 0.8);

    if (highSalience.length > 0) {
      console.log(`${highSalience.length} high-priority memories pending`);
    }
  } catch {
    console.error("HEARTBEAT session check error");
  }
}

export async function getSmartReminderContext(
  coreMemories: CoreMemories,
  reminderTopic: string,
): Promise<string> {
  try {
    const flashResults: KeywordSearchResult = coreMemories.findByKeyword(reminderTopic);

    if (flashResults.flash.length > 0) {
      const context = flashResults.flash
        .slice(0, 2)
        .map((r: FlashEntry) => r.content)
        .join(" ");
      return `Context: ${context}`;
    }

    return "";
  } catch {
    return "";
  }
}

interface SessionRecord {
  timestamp: number;
  gap?: number;
}

async function getLastSessionTime(userId: string): Promise<SessionRecord | null> {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");

    const sessionFile = path.join(
      process.env.OPENCLAW_WORKSPACE || ".",
      ".openclaw",
      "sessions.json",
    );

    const data = await fs.readFile(sessionFile, "utf-8");
    const sessions = JSON.parse(data);

    return sessions[userId] || null;
  } catch {
    return null;
  }
}

async function updateLastSessionTime(userId: string): Promise<void> {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");

    const sessionFile = path.join(
      process.env.OPENCLAW_WORKSPACE || ".",
      ".openclaw",
      "sessions.json",
    );

    let sessions: Record<string, SessionRecord> = {};

    try {
      const data = await fs.readFile(sessionFile, "utf-8");
      sessions = JSON.parse(data);
    } catch {
      // File doesn't exist yet
    }

    sessions[userId] = { timestamp: Date.now() };

    await fs.mkdir(path.dirname(sessionFile), { recursive: true });
    await fs.writeFile(sessionFile, JSON.stringify(sessions, null, 2));
  } catch {
    console.error("Failed to update session time");
  }
}

export async function onSessionStart(
  coreMemories: CoreMemories,
  sendMessage: (msg: string) => void,
): Promise<void> {
  const message = await initSessionContinuation(coreMemories);

  if (message) {
    sendMessage(message);
  }
}
