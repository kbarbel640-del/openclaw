import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";
import { resolveSessionTranscriptPath, type SessionEntry } from "../../config/sessions.js";
import { saveSessionSnapshotToMemory } from "./session-memory-snapshot.js";

describe("saveSessionSnapshotToMemory", () => {
  it("prefers canonical transcript when sessionEntry.sessionFile points to a different session", async () => {
    const prevStateDir = process.env.OPENCLAW_STATE_DIR;
    const stateDir = await fs.mkdtemp(path.join(tmpdir(), "openclaw-snapshot-canonical-"));
    process.env.OPENCLAW_STATE_DIR = stateDir;
    try {
      const sessionKey = "agent:ops:telegram:group:123:topic:456";
      const sessionId = "session-current";
      const staleSessionFile = resolveSessionTranscriptPath("session-old", "ops", "456");
      const canonicalSessionFile = resolveSessionTranscriptPath(sessionId, "ops", "456");

      await fs.mkdir(path.dirname(staleSessionFile), { recursive: true });
      await fs.writeFile(
        staleSessionFile,
        `${JSON.stringify({ type: "message", message: { role: "user", content: "stale message" } })}\n`,
        "utf-8",
      );

      await fs.mkdir(path.dirname(canonicalSessionFile), { recursive: true });
      await fs.writeFile(
        canonicalSessionFile,
        `${JSON.stringify({ type: "message", message: { role: "user", content: "fresh message" } })}\n`,
        "utf-8",
      );

      const sessionEntry: SessionEntry = {
        sessionId,
        updatedAt: Date.now(),
        sessionFile: staleSessionFile,
      };
      const filePath = await saveSessionSnapshotToMemory({
        cfg: {} as OpenClawConfig,
        sessionKey,
        sessionEntry,
        reason: "session corruption",
      });

      expect(filePath).toBeTruthy();
      const snapshot = await fs.readFile(filePath!, "utf-8");
      expect(snapshot).toContain("fresh message");
      expect(snapshot).not.toContain("stale message");
    } finally {
      if (prevStateDir) {
        process.env.OPENCLAW_STATE_DIR = prevStateDir;
      } else {
        delete process.env.OPENCLAW_STATE_DIR;
      }
    }
  });
});
