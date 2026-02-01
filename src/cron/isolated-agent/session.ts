import crypto from "node:crypto";
import type { OpenClawConfig } from "../../config/config.js";
import {
  loadSessionStore,
  mergeSessionEntry,
  resolveStorePath,
  type SessionEntry,
  updateSessionStore,
} from "../../config/sessions.js";

export async function resolveCronSession(params: {
  cfg: OpenClawConfig;
  sessionKey: string;
  nowMs: number;
  agentId: string;
}) {
  const sessionCfg = params.cfg.session;
  const storePath = resolveStorePath(sessionCfg?.store, {
    agentId: params.agentId,
  });
  const store = loadSessionStore(storePath);
  const existing = store[params.sessionKey];

  const sessionId = existing?.sessionId ?? crypto.randomUUID();
  const isNewSession = !existing;
  const systemSent = false;

  const patch: Partial<SessionEntry> = {
    sessionId,
    updatedAt: params.nowMs,
    systemSent,
  };

  const sessionEntry = await updateSessionStore(storePath, (currentStore) => {
    const current = currentStore[params.sessionKey];
    const merged = mergeSessionEntry(current, patch);
    currentStore[params.sessionKey] = merged;
    return merged;
  });

  return {
    storePath,
    store,
    sessionEntry,
    systemSent,
    isNewSession,
  };
}
