import type { Operator } from "./keystore.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Session {
  operatorId: string;
  phone: string;
  publicKey: string;
  createdAt: number;
  expiresAt: number;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Default session TTL: 1 hour. */
const SESSION_TTL_MS = 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------

/**
 * In-memory session store keyed by normalised phone number.
 *
 * NOTE: In production this would be backed by Redis (mcp-redis at
 * nasidius:6379) so sessions survive process restarts and are shared across
 * replicas.  For the MVP, an in-memory Map is sufficient.
 */
const sessions: Map<string, Session> = new Map();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a new authenticated session for an operator.
 *
 * Any existing session for the same phone number is replaced.
 */
export function createSession(operator: Operator): Session {
  const now = Date.now();
  const session: Session = {
    operatorId: operator.id,
    phone: operator.phone,
    publicKey: operator.publicKey,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  };

  sessions.set(normalizePhone(operator.phone), session);
  return session;
}

/**
 * Retrieve a session for the given phone number.
 *
 * Returns `undefined` if no session exists or if the session has expired.
 * Expired sessions are automatically pruned from the store.
 */
export function getSession(phone: string): Session | undefined {
  const key = normalizePhone(phone);
  const session = sessions.get(key);

  if (!session) {
    return undefined;
  }

  if (Date.now() > session.expiresAt) {
    sessions.delete(key);
    return undefined;
  }

  return session;
}

/**
 * Revoke (end) an active session.
 *
 * @returns `true` if a session existed and was removed; `false` otherwise.
 */
export function revokeSession(phone: string): boolean {
  return sessions.delete(normalizePhone(phone));
}

/**
 * Check whether a phone number has a valid (non-expired) session.
 */
export function isAuthenticated(phone: string): boolean {
  return getSession(phone) !== undefined;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}
