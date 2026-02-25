import crypto from "node:crypto";
import type { OpenClawConfig } from "../../config/config.js";
import { loadSessionStore, resolveStorePath, type SessionEntry } from "../../config/sessions.js";

export function resolveCronSession(params: {
  cfg: OpenClawConfig;
  sessionKey: string;
  nowMs: number;
  agentId: string;
  // Isolated cron runs must not carry prior turn context across executions.
  forceNew?: boolean;
  /** When true, ignore any existing session entry (fresh slate). Default: true. */
  freshSession?: boolean;
}) {
  const sessionCfg = params.cfg.session;
  const storePath = resolveStorePath(sessionCfg?.store, {
    agentId: params.agentId,
  });
  const store = loadSessionStore(storePath);
  // When freshSession is true (default) or forceNew is set, skip the existing
  // entry so the run starts with a clean session — no carried-over model
  // overrides, thinking levels, or other state from previous runs (#20092).
  const fresh = params.forceNew || params.freshSession !== false;
  const entry = fresh ? undefined : store[params.sessionKey];
  const sessionId = crypto.randomUUID();
  const systemSent = false;
  const sessionEntry: SessionEntry = {
    // Preserve existing per-session overrides even when rolling to a new sessionId.
    ...entry,
    // Always update these core fields
    sessionId,
    updatedAt: params.nowMs,
    systemSent,
  };
  return { storePath, store, sessionEntry, systemSent, isNewSession: true };
}
