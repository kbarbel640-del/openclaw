import type { OpenClawConfig } from "../../config/config.js";
import { loadConfig } from "../../config/config.js";
import { loadSessionStore, resolveStorePath, updateSessionStore } from "../../config/sessions.js";
import {
  mergeSessionEntry,
  type SessionAcpMeta,
  type SessionEntry,
} from "../../config/sessions/types.js";
import { parseAgentSessionKey } from "../../routing/session-key.js";

export type AcpSessionStoreEntry = {
  cfg: OpenClawConfig;
  storePath: string;
  sessionKey: string;
  storeSessionKey: string;
  entry?: SessionEntry;
  acp?: SessionAcpMeta;
};

function resolveStoreSessionKey(store: Record<string, SessionEntry>, sessionKey: string): string {
  const normalized = sessionKey.trim();
  if (!normalized) {
    return "";
  }
  if (store[normalized]) {
    return normalized;
  }
  const lower = normalized.toLowerCase();
  if (store[lower]) {
    return lower;
  }
  for (const key of Object.keys(store)) {
    if (key.toLowerCase() === lower) {
      return key;
    }
  }
  return lower;
}

export function resolveSessionStorePathForAcp(params: {
  sessionKey: string;
  cfg?: OpenClawConfig;
}): { cfg: OpenClawConfig; storePath: string } {
  const cfg = params.cfg ?? loadConfig();
  const parsed = parseAgentSessionKey(params.sessionKey);
  const storePath = resolveStorePath(cfg.session?.store, {
    agentId: parsed?.agentId,
  });
  return { cfg, storePath };
}

export function readAcpSessionEntry(params: {
  sessionKey: string;
  cfg?: OpenClawConfig;
}): AcpSessionStoreEntry | null {
  const sessionKey = params.sessionKey.trim();
  if (!sessionKey) {
    return null;
  }
  const { cfg, storePath } = resolveSessionStorePathForAcp({
    sessionKey,
    cfg: params.cfg,
  });
  let store: Record<string, SessionEntry>;
  try {
    store = loadSessionStore(storePath);
  } catch {
    store = {};
  }
  const storeSessionKey = resolveStoreSessionKey(store, sessionKey);
  const entry = store[storeSessionKey];
  return {
    cfg,
    storePath,
    sessionKey,
    storeSessionKey,
    entry,
    acp: entry?.acp,
  };
}

export async function upsertAcpSessionMeta(params: {
  sessionKey: string;
  cfg?: OpenClawConfig;
  mutate: (
    current: SessionAcpMeta | undefined,
    entry: SessionEntry | undefined,
  ) => SessionAcpMeta | null | undefined;
}): Promise<SessionEntry | null> {
  const sessionKey = params.sessionKey.trim();
  if (!sessionKey) {
    return null;
  }
  const { storePath } = resolveSessionStorePathForAcp({
    sessionKey,
    cfg: params.cfg,
  });
  return await updateSessionStore(
    storePath,
    (store) => {
      const storeSessionKey = resolveStoreSessionKey(store, sessionKey);
      const currentEntry = store[storeSessionKey];
      const nextMeta = params.mutate(currentEntry?.acp, currentEntry);
      if (nextMeta === undefined) {
        return currentEntry ?? null;
      }
      if (nextMeta === null && !currentEntry) {
        return null;
      }

      const nextEntry = mergeSessionEntry(currentEntry, {
        acp: nextMeta ?? undefined,
      });
      if (nextMeta === null) {
        delete nextEntry.acp;
      }
      store[storeSessionKey] = nextEntry;
      return nextEntry;
    },
    {
      activeSessionKey: sessionKey.toLowerCase(),
    },
  );
}
