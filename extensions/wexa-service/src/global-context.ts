/**
 * Shared global session context store for Wexa extensions.
 *
 * This module provides read access to the process-global Map for user context
 * (orgId/userId/projectId) that is written by data-service.setContext.
 *
 * Architecture:
 * - data-service.setContext writes to globalThis.__wexaSessionContext
 * - wexa-service tools read from this store via getGlobalSessionContext
 * - Both extensions remain independent (no import dependency)
 */

/** Context stored per session */
export type WexaSessionContext = {
  orgId: string;
  userId: string;
  projectId?: string;
  apiKey?: string;
};

/** Entry in the global store with TTL */
type StoreEntry = {
  context: WexaSessionContext;
  expiresAt: number;
};

/** Global store type */
type GlobalStore = Map<string, StoreEntry>;

/** Context TTL in milliseconds (30 minutes) */
const CONTEXT_TTL_MS = 30 * 60 * 1000;

// Declare the global variable
declare global {
  // eslint-disable-next-line no-var
  var __wexaSessionContext: GlobalStore | undefined;
}

/**
 * Get the global session context store, creating it if needed.
 */
function getGlobalStore(): GlobalStore {
  if (!globalThis.__wexaSessionContext) {
    globalThis.__wexaSessionContext = new Map();
  }
  return globalThis.__wexaSessionContext;
}

/**
 * Get session context from the global store.
 * Returns undefined if not found or expired.
 */
export function getGlobalSessionContext(sessionKey: string): WexaSessionContext | undefined {
  const store = getGlobalStore();

  // Try exact key
  let entry = store.get(sessionKey);
  if (entry) {
    if (entry.expiresAt > Date.now()) {
      // Refresh TTL on access
      entry.expiresAt = Date.now() + CONTEXT_TTL_MS;
      return entry.context;
    }
    store.delete(sessionKey);
  }

  // Try canonical key
  const canonicalKey = sessionKey.startsWith("agent:") ? sessionKey : `agent:main:${sessionKey}`;
  if (canonicalKey !== sessionKey) {
    entry = store.get(canonicalKey);
    if (entry) {
      if (entry.expiresAt > Date.now()) {
        entry.expiresAt = Date.now() + CONTEXT_TTL_MS;
        return entry.context;
      }
      store.delete(canonicalKey);
    }
  }

  return undefined;
}
