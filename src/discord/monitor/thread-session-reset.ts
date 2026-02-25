import path from "node:path";
import { updateSessionStore } from "../../config/sessions.js";
import { logVerbose } from "../../globals.js";

/**
 * When a Discord thread is archived, mark the corresponding session as stale
 * so the next message creates a fresh session.
 */
export function handleThreadArchivedSessionReset(params: {
  threadId: string;
  guildId?: string;
  accountId: string;
  agentDirs: Array<{ agentId: string; sessionsDir: string }>;
}): void {
  for (const { agentId, sessionsDir } of params.agentDirs) {
    const storePath = path.join(sessionsDir, "sessions.json");
    void updateSessionStore(storePath, (store) => {
      const sessionKey = `agent:${agentId}:discord:channel:${params.threadId}`;
      const entry = store[sessionKey];
      if (entry) {
        entry.updatedAt = 0;
        logVerbose(`thread-session-reset: marked ${sessionKey} stale (thread archived)`);
      }
    });
  }
}
