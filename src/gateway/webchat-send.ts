import fs from "node:fs";
import path from "node:path";
import { resolveSessionAgentId } from "../agents/agent-scope.js";
import { loadConfig } from "../config/config.js";
import { resolveStorePath } from "../config/sessions/paths.js";
import { resolveSessionFilePath } from "../config/sessions/paths.js";
import { appendInjectedAssistantMessageToTranscript } from "./server-methods/chat-transcript-inject.js";
import { loadSessionEntry } from "./session-utils.js";

const CURRENT_SESSION_VERSION = 1;

type SendWebchatDeps = {
  broadcast: (event: string, payload: unknown, opts?: { dropIfSlow?: boolean }) => void;
  nodeSendToSession: (sessionKey: string, event: string, payload: unknown) => void;
};

/**
 * Creates a sendWebchat closure over gateway state. This is architecturally
 * different from every other send function — those are standalone imports that
 * call external APIs. sendWebchat needs broadcast + nodeSendToSession which
 * only exist at gateway runtime.
 */
export function createSendWebchat(deps: SendWebchatDeps) {
  return async (sessionKey: string, text: string): Promise<{ messageId: string }> => {
    const cfg = loadConfig();
    const agentId = resolveSessionAgentId({ sessionKey, config: cfg });
    const storePath = resolveStorePath(cfg.session?.store, { agentId });

    // Try to load existing session entry
    const { entry } = loadSessionEntry(sessionKey);
    const sessionId = entry?.sessionId ?? sessionKey;

    // Resolve transcript path
    const sessionsDir = storePath ? path.dirname(storePath) : undefined;
    let transcriptPath: string | null = null;
    try {
      transcriptPath = resolveSessionFilePath(
        sessionId,
        entry?.sessionFile ? { sessionFile: entry.sessionFile } : undefined,
        sessionsDir || agentId ? { sessionsDir, agentId } : undefined,
      );
    } catch {
      // Fall through to error
    }

    if (!transcriptPath) {
      throw new Error(`webchat send: could not resolve transcript path for session ${sessionKey}`);
    }

    // createIfMissing: true — cron may fire before user has ever chatted
    if (!fs.existsSync(transcriptPath)) {
      fs.mkdirSync(path.dirname(transcriptPath), { recursive: true });
      const header = {
        type: "session",
        version: CURRENT_SESSION_VERSION,
        id: sessionId,
        timestamp: new Date().toISOString(),
        cwd: process.cwd(),
      };
      fs.writeFileSync(transcriptPath, `${JSON.stringify(header)}\n`, {
        encoding: "utf-8",
        mode: 0o600,
      });
    }

    // Append the message to the transcript
    const appended = appendInjectedAssistantMessageToTranscript({
      transcriptPath,
      message: text,
      label: "cron",
    });

    if (!appended.ok || !appended.messageId) {
      throw new Error(`webchat send: failed to write transcript: ${appended.error ?? "unknown"}`);
    }

    // Broadcast as chat event — same structure as chat.inject
    const chatPayload = {
      runId: `cron-${appended.messageId}`,
      sessionKey,
      seq: 0,
      state: "final" as const,
      message: appended.message,
    };
    deps.broadcast("chat", chatPayload);
    deps.nodeSendToSession(sessionKey, "chat", chatPayload);

    return { messageId: appended.messageId };
  };
}
