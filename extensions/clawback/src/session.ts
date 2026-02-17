import type { SessionEntry, Tier } from "./types.js";

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

const sessions = new Map<string, SessionEntry>();
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

export function pinSession(sessionKey: string, model: string, tier: Tier): void {
  sessions.set(sessionKey, {
    model,
    tier,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
}

export function getPinnedModel(sessionKey: string): SessionEntry | undefined {
  const entry = sessions.get(sessionKey);
  if (!entry) {
    return undefined;
  }
  if (Date.now() > entry.expiresAt) {
    sessions.delete(sessionKey);
    return undefined;
  }
  return entry;
}

function cleanup(): void {
  const now = Date.now();
  for (const [key, entry] of sessions) {
    if (now > entry.expiresAt) {
      sessions.delete(key);
    }
  }
}

export function startCleanup(): void {
  if (cleanupTimer) {
    return;
  }
  cleanupTimer = setInterval(cleanup, CLEANUP_INTERVAL_MS);
  cleanupTimer.unref();
}

export function stopCleanup(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
  sessions.clear();
}
