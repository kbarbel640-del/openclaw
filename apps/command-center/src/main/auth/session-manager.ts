/**
 * Session Manager — manages authenticated user sessions.
 *
 * Sessions have two modes:
 *   - Normal: created on login, expires after AUTH_SESSION_TIMEOUT_MS idle
 *   - Elevated: created on re-auth (biometric/2FA), required for sensitive ops
 *
 * Sessions are stored in memory only — never persisted to disk.
 */

import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import type { AuthSession, UserRole } from "../../shared/ipc-types.js";
import { AUTH_SESSION_TIMEOUT_MS } from "../../shared/constants.js";

/** In-memory session store. */
interface StoredSession {
  session: AuthSession;
  /** HMAC-signed session token. */
  token: string;
  /** Timestamp of last activity (for idle timeout). */
  lastActivity: number;
}

/** How long an elevated session lasts (5 minutes). */
const ELEVATED_SESSION_DURATION_MS = 5 * 60 * 1000;

export class SessionManager {
  private sessions = new Map<string, StoredSession>();
  private signingKey = randomBytes(32); // In-memory, rotated on app restart
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    // Prune expired sessions every minute
    this.cleanupInterval = setInterval(() => this.pruneExpired(), 60_000);
  }

  // ─── Session Lifecycle ───────────────────────────────────────────────

  /** Create a new normal session after successful login. */
  createSession(userId: string, role: UserRole): { session: AuthSession; token: string } {
    const now = Date.now();
    const sessionId = randomBytes(16).toString("hex");

    const session: AuthSession = {
      userId,
      role,
      authenticatedAt: now,
      expiresAt: now + AUTH_SESSION_TIMEOUT_MS,
      elevated: false,
    };

    const token = this.signToken(sessionId);
    this.sessions.set(sessionId, { session, token, lastActivity: now });

    return { session, token };
  }

  /** Elevate an existing session (after biometric/TOTP re-auth). */
  elevateSession(token: string): boolean {
    const entry = this.resolveToken(token);
    if (!entry) {return false;}

    entry.session.elevated = true;
    entry.session.expiresAt = Date.now() + ELEVATED_SESSION_DURATION_MS;
    entry.lastActivity = Date.now();
    return true;
  }

  /** Drop elevation (call after a sensitive operation completes). */
  dropElevation(token: string): void {
    const entry = this.resolveToken(token);
    if (!entry) {return;}
    entry.session.elevated = false;
    entry.session.expiresAt = Date.now() + AUTH_SESSION_TIMEOUT_MS;
  }

  /** Invalidate (log out) a session. */
  invalidate(token: string): void {
    const sessionId = this.extractSessionId(token);
    if (sessionId) {this.sessions.delete(sessionId);}
  }

  /** Invalidate all sessions for a user (e.g., on role change or account deletion). */
  invalidateAllForUser(userId: string): void {
    for (const [id, entry] of this.sessions) {
      if (entry.session.userId === userId) {
        this.sessions.delete(id);
      }
    }
  }

  // ─── Session Resolution ──────────────────────────────────────────────

  /** Resolve a token to its session, refreshing the idle timer. Returns null if invalid. */
  resolve(token: string): AuthSession | null {
    const entry = this.resolveToken(token);
    if (!entry) {return null;}

    // Refresh idle timeout for non-elevated sessions
    if (!entry.session.elevated) {
      entry.session.expiresAt = Date.now() + AUTH_SESSION_TIMEOUT_MS;
    }
    entry.lastActivity = Date.now();

    return { ...entry.session };
  }

  /** Check if a token is valid without refreshing the idle timer. */
  isValid(token: string): boolean {
    return this.resolveToken(token) !== null;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────

  private resolveToken(token: string): StoredSession | null {
    const sessionId = this.extractSessionId(token);
    if (!sessionId) {return null;}

    const entry = this.sessions.get(sessionId);
    if (!entry) {return null;}

    // Constant-time token comparison
    if (!timingSafeEqual(Buffer.from(entry.token), Buffer.from(token))) {return null;}

    // Check expiry
    if (Date.now() > entry.session.expiresAt) {
      this.sessions.delete(sessionId);
      return null;
    }

    return entry;
  }

  /**
   * Token format: "<sessionId_hex>.<hmac_hex>"
   * HMAC is over the sessionId, signed with the in-memory key.
   */
  private signToken(sessionId: string): string {
    const hmac = createHmac("sha256", this.signingKey).update(sessionId).digest("hex");
    return `${sessionId}.${hmac}`;
  }

  private extractSessionId(token: string): string | null {
    const [sessionId] = token.split(".");
    if (!sessionId) {return null;}
    // Verify HMAC before trusting the session ID
    const expected = this.signToken(sessionId);
    try {
      if (timingSafeEqual(Buffer.from(expected), Buffer.from(token))) {
        return sessionId;
      }
    } catch {
      // Lengths differ → definitely invalid
    }
    return null;
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [id, entry] of this.sessions) {
      if (now > entry.session.expiresAt) {
        this.sessions.delete(id);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.sessions.clear();
  }
}
