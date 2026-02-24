/**
 * SessionManager — unit tests for session lifecycle.
 *
 * Covers: create, resolve, elevate+drop, timeout/expiry, prune,
 * invalidate (single + all-for-user).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SessionManager } from "../../src/main/auth/session-manager.js";

let manager: SessionManager;

beforeEach(() => {
  manager = new SessionManager();
});

afterEach(() => {
  manager.destroy();
});

// ─── createSession() ─────────────────────────────────────────────────────

describe("createSession()", () => {
  it("returns a session and token", () => {
    const { session, token } = manager.createSession("u1", "admin");
    expect(session.userId).toBe("u1");
    expect(session.role).toBe("admin");
    expect(session.elevated).toBe(false);
    expect(token).toContain(".");
    expect(token.length).toBeGreaterThan(20);
  });

  it("creates distinct tokens for the same user", () => {
    const a = manager.createSession("u1", "admin");
    const b = manager.createSession("u1", "admin");
    expect(a.token).not.toBe(b.token);
  });
});

// ─── resolve() ───────────────────────────────────────────────────────────

describe("resolve()", () => {
  it("resolves a valid token to its session", () => {
    const { session, token } = manager.createSession("u1", "operator");
    const resolved = manager.resolve(token);
    expect(resolved).not.toBeNull();
    expect(resolved!.userId).toBe(session.userId);
    expect(resolved!.role).toBe("operator");
  });

  it("returns null for a garbage token", () => {
    expect(manager.resolve("not.a.real.token")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(manager.resolve("")).toBeNull();
  });

  it("returns a copy (not the same reference)", () => {
    const { token } = manager.createSession("u1", "admin");
    const a = manager.resolve(token);
    const b = manager.resolve(token);
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

// ─── elevateSession() / dropElevation() ──────────────────────────────────

describe("elevation", () => {
  it("elevates a session", () => {
    const { token } = manager.createSession("u1", "admin");
    expect(manager.elevateSession(token)).toBe(true);
    const resolved = manager.resolve(token);
    expect(resolved!.elevated).toBe(true);
  });

  it("drops elevation back to normal", () => {
    const { token } = manager.createSession("u1", "admin");
    manager.elevateSession(token);
    manager.dropElevation(token);
    const resolved = manager.resolve(token);
    expect(resolved!.elevated).toBe(false);
  });

  it("returns false for an invalid token", () => {
    expect(manager.elevateSession("invalid.token")).toBe(false);
  });
});

// ─── invalidate() ────────────────────────────────────────────────────────

describe("invalidate()", () => {
  it("invalidates a session by token", () => {
    const { token } = manager.createSession("u1", "admin");
    manager.invalidate(token);
    expect(manager.resolve(token)).toBeNull();
  });

  it("does not throw for an already-invalid token", () => {
    expect(() => manager.invalidate("bogus.token")).not.toThrow();
  });
});

// ─── invalidateAllForUser() ──────────────────────────────────────────────

describe("invalidateAllForUser()", () => {
  it("removes all sessions for a user", () => {
    const a = manager.createSession("u1", "admin");
    const b = manager.createSession("u1", "admin");
    const c = manager.createSession("u2", "operator");

    manager.invalidateAllForUser("u1");

    expect(manager.resolve(a.token)).toBeNull();
    expect(manager.resolve(b.token)).toBeNull();
    expect(manager.resolve(c.token)).not.toBeNull(); // u2 untouched
  });
});

// ─── isValid() ───────────────────────────────────────────────────────────

describe("isValid()", () => {
  it("returns true for a valid token", () => {
    const { token } = manager.createSession("u1", "admin");
    expect(manager.isValid(token)).toBe(true);
  });

  it("returns false after invalidation", () => {
    const { token } = manager.createSession("u1", "admin");
    manager.invalidate(token);
    expect(manager.isValid(token)).toBe(false);
  });
});

// ─── Session Expiry ──────────────────────────────────────────────────────

describe("session expiry", () => {
  it("returns null for an expired session", () => {
    const { token } = manager.createSession("u1", "admin");

    // Fast-forward time past the session expiry (30 min + margin)
    vi.useFakeTimers();
    vi.advanceTimersByTime(31 * 60 * 1000);

    expect(manager.resolve(token)).toBeNull();
    vi.useRealTimers();
  });
});
