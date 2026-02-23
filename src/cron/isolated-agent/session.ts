import crypto from "node:crypto";
import type { OpenClawConfig } from "../../config/config.js";
import { loadSessionStore, resolveStorePath, type SessionEntry } from "../../config/sessions.js";

export function resolveCronSession(params: {
  cfg: OpenClawConfig;
  sessionKey: string;
  nowMs: number;
  agentId: string;
  /** When true, ignore any existing session entry (fresh slate). Default: true. */
  freshSession?: boolean;
}) {
  const sessionCfg = params.cfg.session;
  const storePath = resolveStorePath(sessionCfg?.store, {
    agentId: params.agentId,
  });
  const store = loadSessionStore(storePath);
  // When freshSession is true (default), skip the existing entry so
  // the run starts with a clean session — no carried-over model overrides,
  // thinking levels, or other state from previous runs (#20092).
  const fresh = params.freshSession !== false;
  const entry = fresh ? undefined : store[params.sessionKey];
  const sessionId = crypto.randomUUID();
  const systemSent = false;
  const sessionEntry: SessionEntry = {
    sessionId,
    updatedAt: params.nowMs,
    systemSent,
    thinkingLevel: entry?.thinkingLevel,
    verboseLevel: entry?.verboseLevel,
    model: entry?.model,
    modelOverride: entry?.modelOverride,
    providerOverride: entry?.providerOverride,
    contextTokens: entry?.contextTokens,
    sendPolicy: entry?.sendPolicy,
    lastChannel: entry?.lastChannel,
    lastTo: entry?.lastTo,
    lastAccountId: entry?.lastAccountId,
    label: entry?.label,
    displayName: entry?.displayName,
    skillsSnapshot: entry?.skillsSnapshot,
  };
  return { storePath, store, sessionEntry, systemSent, isNewSession: true };
}
