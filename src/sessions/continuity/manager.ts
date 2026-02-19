import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { SessionContinuityConfig, HistoricalSession } from "./types.js";
import { generateSummary } from "./summarizer.js";

const DEFAULT_CONFIG: SessionContinuityConfig = {
  enabled: false,
  inheritMode: "summary",
  maxHistoricalSessions: 3,
};

export class SessionContinuityManager {
  private config: SessionContinuityConfig;
  private sessionsDir: string;

  constructor(sessionsDir: string, config?: Partial<SessionContinuityConfig>) {
    this.sessionsDir = sessionsDir;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  updateConfig(config: Partial<SessionContinuityConfig>): void {
    this.config = { ...this.config, ...config };
  }

  isEnabled(): boolean {
    return this.config.enabled ?? false;
  }

  async getHistoricalSessions(
    currentSessionKey: string,
    agentId: string,
  ): Promise<HistoricalSession[]> {
    if (!this.config.enabled) {
      return [];
    }

    try {
      const agentDir = join(this.sessionsDir, agentId);
      const files = await readdir(agentDir);

      const sessionFiles = files
        .filter((f) => f.endsWith(".jsonl"))
        .filter((f) => !f.includes(currentSessionKey))
        .toSorted((a, b) => b.localeCompare(a))
        .slice(0, this.config.maxHistoricalSessions);

      const sessions: HistoricalSession[] = [];

      for (const file of sessionFiles) {
        const filePath = join(agentDir, file);
        try {
          const content = await readFile(filePath, "utf-8");
          const lines = content.split("\n").filter((l) => l.trim());

          const lastLine = lines[lines.length - 1];

          let lastMessage = "";
          try {
            const lastEntry = JSON.parse(lastLine);
            lastMessage = lastEntry.content?.slice(0, 200) || "";
          } catch {
            lastMessage = lastLine.slice(0, 200);
          }

          const sessionId = file.replace(".jsonl", "");

          const summaryOrPoints = generateSummary(
            lines,
            this.config.inheritMode === "key_points" ? "key_points" : "summary",
          );

          sessions.push({
            sessionId,
            sessionKey: sessionId,
            lastMessage,
            summary: typeof summaryOrPoints === "string" ? summaryOrPoints : undefined,
            keyPoints: Array.isArray(summaryOrPoints) ? summaryOrPoints : undefined,
            timestamp: Date.now(),
          });
        } catch (error) {
          console.error(`[continuity] Failed to read session ${file}:`, error);
        }
      }

      return sessions;
    } catch (error) {
      console.error("[continuity] Failed to get historical sessions:", error);
      return [];
    }
  }

  buildContextPrompt(sessions: HistoricalSession[]): string {
    if (sessions.length === 0) {
      return "";
    }

    const parts: string[] = ["## Previous Sessions Context\n"];

    for (const session of sessions) {
      parts.push(`### Session ${session.sessionId.slice(0, 8)}`);

      if (this.config.inheritMode === "key_points" && session.keyPoints) {
        parts.push("Key points:");
        for (const point of session.keyPoints) {
          parts.push(`- ${point}`);
        }
      } else if (session.summary) {
        parts.push(session.summary);
      } else {
        parts.push(session.lastMessage);
      }
      parts.push("");
    }

    return parts.join("\n");
  }
}
