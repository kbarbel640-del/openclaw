/**
 * Request-scoped context for multi-tenant support.
 *
 * For Wexa Coworker Web integration:
 * - Context (orgId/userId) MUST be set via data-service.setContext gateway method
 * - Context is stored per-session and automatically looked up during tool execution
 *
 * Architecture:
 * 1. Session-keyed Map stores context with TTL (primary storage)
 * 2. Global store (globalThis.__wexaSessionContext) for cross-extension sharing
 * 3. before_tool_call hook sets currentSessionKey for context lookup
 * 4. Tools call getRequestContext() to retrieve orgId/userId
 *
 * Cross-extension sharing:
 * - setSessionContext() writes to both local store AND global store
 * - wexa-service extension reads from the global store
 * - This allows wexa-service tools to use the same context without import dependency
 */

import { AsyncLocalStorage } from "node:async_hooks";

// ============================================================================
// Global Store for Cross-Extension Sharing
// ============================================================================

/** Context stored per session in global store */
type GlobalSessionContext = {
  orgId: string;
  userId: string;
  projectId?: string;
  apiKey?: string;
};

/** Entry in the global store with TTL */
type GlobalStoreEntry = {
  context: GlobalSessionContext;
  expiresAt: number;
};

/** Global store type */
type GlobalStore = Map<string, GlobalStoreEntry>;

// Declare the global variable that wexa-service also uses
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
 * Write context to the global store for cross-extension sharing.
 */
function writeToGlobalStore(
  sessionKey: string,
  context: DataServiceRequestContext,
  ttlMs: number,
): void {
  const store = getGlobalStore();
  const entry = {
    context: {
      orgId: context.orgId,
      userId: context.userId,
      projectId: context.projectId,
      apiKey: context.apiKey,
    },
    expiresAt: Date.now() + ttlMs,
  };
  store.set(sessionKey, entry);

  // Also store under canonical key if different
  const canonicalKey = sessionKey.startsWith("agent:") ? sessionKey : `agent:main:${sessionKey}`;
  if (canonicalKey !== sessionKey) {
    store.set(canonicalKey, entry);
  }

  // Periodic cleanup when store gets large
  if (store.size > 100) {
    const now = Date.now();
    for (const [key, e] of store) {
      if (e.expiresAt < now) {
        store.delete(key);
      }
    }
  }
}

/**
 * Clear context from the global store.
 */
function clearFromGlobalStore(sessionKey: string): void {
  const store = getGlobalStore();
  store.delete(sessionKey);

  const canonicalKey = sessionKey.startsWith("agent:") ? sessionKey : `agent:main:${sessionKey}`;
  if (canonicalKey !== sessionKey) {
    store.delete(canonicalKey);
  }
}

// ============================================================================
// Local Context Store
// ============================================================================

/** Context passed per-request for multi-tenant isolation */
export type DataServiceRequestContext = {
  orgId: string;
  userId: string;
  /** Optional project ID */
  projectId?: string;
  /** Optional API key override */
  apiKey?: string;
};

/** AsyncLocalStorage instance for request-scoped context (fallback) */
const requestContextStorage = new AsyncLocalStorage<DataServiceRequestContext>();

/**
 * Session-keyed context store.
 * Primary storage for multi-tenant context.
 * Key: sessionKey, Value: { context, expiresAt }
 */
const sessionContextStore = new Map<
  string,
  { context: DataServiceRequestContext; expiresAt: number }
>();

/** Context TTL in milliseconds (30 minutes for long-running sessions) */
const CONTEXT_TTL_MS = 30 * 60 * 1000;

/**
 * Current session key for the executing tool.
 * Set by the before_tool_call hook, cleared by after_tool_call.
 */
let currentSessionKey: string | undefined;

/**
 * Set the current session key (called by before_tool_call hook).
 */
export function setCurrentSessionKey(sessionKey: string | undefined): void {
  currentSessionKey = sessionKey;
}

/**
 * Clear the current session key (called by after_tool_call hook).
 */
export function clearCurrentSessionKey(): void {
  currentSessionKey = undefined;
}

/**
 * Get the current request context (orgId/userId).
 *
 * Lookup order:
 * 1. Session store using currentSessionKey (set by before_tool_call hook)
 * 2. Session store using provided sessionKey
 * 3. AsyncLocalStorage (fallback)
 *
 * Returns undefined if no context is set — tools should return an error.
 */
export function getRequestContext(sessionKey?: string): DataServiceRequestContext | undefined {
  // Primary: use currentSessionKey (set by before_tool_call hook)
  if (currentSessionKey) {
    const entry = sessionContextStore.get(currentSessionKey);
    if (entry && entry.expiresAt > Date.now()) {
      // Refresh TTL on access
      entry.expiresAt = Date.now() + CONTEXT_TTL_MS;
      return entry.context;
    }
    if (entry) {
      sessionContextStore.delete(currentSessionKey);
    }
  }

  // Try provided sessionKey
  if (sessionKey) {
    const entry = sessionContextStore.get(sessionKey);
    if (entry && entry.expiresAt > Date.now()) {
      entry.expiresAt = Date.now() + CONTEXT_TTL_MS;
      return entry.context;
    }
    if (entry) {
      sessionContextStore.delete(sessionKey);
    }
  }

  // Fallback: AsyncLocalStorage
  return requestContextStorage.getStore();
}

/**
 * Set context for a session key.
 * Called by data-service.setContext gateway method.
 *
 * Writes to both:
 * 1. Local session store (for data-service tools)
 * 2. Global store (for wexa-service tools via globalThis.__wexaSessionContext)
 */
export function setSessionContext(sessionKey: string, context: DataServiceRequestContext): void {
  // Write to local store
  sessionContextStore.set(sessionKey, {
    context,
    expiresAt: Date.now() + CONTEXT_TTL_MS,
  });

  // Write to global store for cross-extension sharing (wexa-service)
  writeToGlobalStore(sessionKey, context, CONTEXT_TTL_MS);

  // Periodic cleanup of expired entries (when store gets large)
  if (sessionContextStore.size > 100) {
    cleanupExpiredSessions();
  }
}

/**
 * Clear context for a session key.
 * Called by data-service.clearContext gateway method.
 *
 * Clears from both:
 * 1. Local session store
 * 2. Global store (for wexa-service)
 */
export function clearSessionContext(sessionKey: string): void {
  sessionContextStore.delete(sessionKey);
  clearFromGlobalStore(sessionKey);
}

/**
 * Get the number of active sessions with context.
 * Used by data-service.status gateway method.
 */
export function getSessionContextCount(): number {
  // Clean up expired entries first
  cleanupExpiredSessions();
  return sessionContextStore.size;
}

/**
 * Clean up expired session contexts.
 */
function cleanupExpiredSessions(): void {
  const now = Date.now();
  for (const [key, entry] of sessionContextStore) {
    if (entry.expiresAt < now) {
      sessionContextStore.delete(key);
    }
  }
}
