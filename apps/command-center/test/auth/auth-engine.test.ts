/**
 * AuthEngine — unit tests for the auth orchestration layer.
 *
 * Tests login flows (password, TOTP, biometric, lockout), elevation,
 * first-run setup, recovery codes, and user management facades.
 *
 * Uses mock AuthStore and SessionManager to isolate engine logic.
 */

/* eslint-disable typescript-eslint/unbound-method */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock electron (biometric.ts imports it)
vi.mock("electron", () => ({
  systemPreferences: {
    canPromptTouchID: vi.fn(() => false),
    promptTouchID: vi.fn(),
  },
}));

// Mock otplib
vi.mock("otplib", () => ({
  authenticator: {
    options: {},
    generateSecret: vi.fn(() => "TESTSECRET123456"),
    keyuri: vi.fn((_user: string, _service: string, secret: string) => `otpauth://totp/OCCC:user?secret=${secret}`),
    verify: vi.fn(() => false), // default: invalid code
  },
}));

// Mock qrcode
vi.mock("qrcode", () => ({
  toDataURL: vi.fn(async () => "data:image/png;base64,FAKE_QR"),
}));

import { AuthEngine } from "../../src/main/auth/auth-engine.js";
import type { AuthStore } from "../../src/main/auth/auth-store.js";
import type { SessionManager } from "../../src/main/auth/session-manager.js";
import type { AuthSession, UserRole } from "../../src/shared/ipc-types.js";
import { authenticator } from "otplib";

// ─── Mock Factories ──────────────────────────────────────────────────────

function makeSession(overrides: Partial<AuthSession> = {}): AuthSession {
  return {
    userId: "u1",
    role: "admin",
    authenticatedAt: Date.now(),
    expiresAt: Date.now() + 3_600_000,
    elevated: false,
    ...overrides,
  };
}

function makeMockStore(overrides: Partial<AuthStore> = {}): AuthStore {
  return {
    hasUsers: vi.fn(() => false),
    createUser: vi.fn(async (params: { username: string; role: UserRole }) => ({
      id: "new-user-id",
      username: params.username,
      role: params.role,
      biometricEnrolled: false,
      totpEnabled: false,
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
    })),
    getUserByUsername: vi.fn(() => ({
      id: "u1",
      username: "admin",
      role: "super-admin" as UserRole,
      password_hash: "argon2id$salt$hash",
      totp_secret_enc: "encrypted",
      totp_enabled: 1,
      biometric_enrolled: 0,
      recovery_codes_enc: "",
      created_at: new Date().toISOString(),
      last_login_at: null,
    })),
    getUserById: vi.fn(() => null),
    verifyPassword: vi.fn(async () => true),
    getTotpSecret: vi.fn(() => "TESTSECRET123456"),
    setTotpSecret: vi.fn(),
    setBiometricEnrolled: vi.fn(),
    updateLastLogin: vi.fn(),
    auditLog: vi.fn(),
    listUsers: vi.fn(() => []),
    updateUserRole: vi.fn(() => ({ ok: true })),
    deleteUser: vi.fn(() => ({ ok: true })),
    resetPassword: vi.fn(async () => ({ ok: true })),
    getAuditLog: vi.fn(() => []),
    setRecoveryCodes: vi.fn(async () => {}),
    useRecoveryCode: vi.fn(async () => false),
    getUserRowById: vi.fn(() => null),
    countRecentLoginFailures: vi.fn(() => 0),
    ...overrides,
  } as unknown as AuthStore;
}

function makeMockSessions(overrides: Partial<SessionManager> = {}): SessionManager {
  return {
    createSession: vi.fn((_userId: string, _role: UserRole) => ({
      session: makeSession(),
      token: "session-token-123",
    })),
    resolve: vi.fn(() => makeSession()),
    elevateSession: vi.fn(() => true),
    dropElevation: vi.fn(),
    invalidate: vi.fn(),
    invalidateAllForUser: vi.fn(),
    isValid: vi.fn(() => true),
    destroy: vi.fn(),
    ...overrides,
  } as unknown as SessionManager;
}

// ─── Tests ───────────────────────────────────────────────────────────────

let store: AuthStore;
let sessions: SessionManager;
let engine: AuthEngine;

beforeEach(() => {
  vi.clearAllMocks();
  store = makeMockStore();
  sessions = makeMockSessions();
  engine = new AuthEngine(store, sessions);
});

// ─── isFirstRun() ────────────────────────────────────────────────────────

describe("isFirstRun()", () => {
  it("returns true when store has no users", () => {
    expect(engine.isFirstRun()).toBe(true);
  });

  it("returns false when store has users", () => {
    vi.mocked(store.hasUsers).mockReturnValue(true);
    expect(engine.isFirstRun()).toBe(false);
  });
});

// ─── createInitialUser() ─────────────────────────────────────────────────

describe("createInitialUser()", () => {
  it("creates super-admin with TOTP setup and recovery codes", async () => {
    const result = await engine.createInitialUser({ username: "admin", password: "Test12345678" });

    expect(result.profile.role).toBe("super-admin");
    expect(result.totpSetup.secret).toBeTruthy();
    expect(result.totpSetup.qrDataUrl).toContain("data:image/png");
    expect(result.recoveryCodes).toHaveLength(8);
    expect(result.recoveryCodes[0]).toMatch(/^[A-F0-9]{4}-[A-F0-9]{4}$/);
    expect(vi.mocked(store.setRecoveryCodes)).toHaveBeenCalledWith("new-user-id", result.recoveryCodes);
  });
});

// ─── login() ─────────────────────────────────────────────────────────────

describe("login()", () => {
  it("returns invalid-credentials for unknown username", async () => {
    vi.mocked(store.getUserByUsername).mockReturnValue(null);
    const result = await engine.login("nobody", "pass");
    expect(result.ok).toBe(false);
    if (!result.ok) { expect(result.reason).toBe("invalid-credentials"); }
  });

  it("returns invalid-credentials for wrong password", async () => {
    vi.mocked(store.verifyPassword).mockResolvedValue(false);
    const result = await engine.login("admin", "wrong");
    expect(result.ok).toBe(false);
    if (!result.ok) { expect(result.reason).toBe("invalid-credentials"); }
  });

  it("returns requiresTotp when user has TOTP enabled", async () => {
    vi.mocked(store.verifyPassword).mockResolvedValue(true);
    const result = await engine.login("admin", "correct");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.requiresTotp).toBe(true);
    }
  });

  it("returns session directly when user has no TOTP", async () => {
    vi.mocked(store.verifyPassword).mockResolvedValue(true);
    vi.mocked(store.getUserByUsername).mockReturnValue({
      id: "u2",
      username: "noTotp",
      role: "viewer" as UserRole,
      password_hash: "argon2id$salt$hash",
      totp_secret_enc: "",
      totp_enabled: 0,
      biometric_enrolled: 0,
      recovery_codes_enc: "",
      created_at: new Date().toISOString(),
      last_login_at: null,
    });
    const result = await engine.login("noTotp", "correct");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.requiresTotp).toBe(false);
      expect(result.token).toBeTruthy();
    }
  });
});

// ─── Login Rate Limiting ─────────────────────────────────────────────────

describe("login rate limiting", () => {
  it("locks account after 5 failed attempts", async () => {
    vi.mocked(store.verifyPassword).mockResolvedValue(false);

    // Simulate DB recording failures: countRecentLoginFailures tracks audit events
    let failureCount = 0;
    vi.mocked(store.countRecentLoginFailures).mockImplementation(() => failureCount);
    vi.mocked(store.auditLog).mockImplementation((entry) => {
      if (entry.event === "login_failed") { failureCount++; }
    });

    for (let i = 0; i < 5; i++) {
      await engine.login("admin", "wrong");
    }

    // 6th attempt — countRecentLoginFailures now returns 5 (>= threshold)
    const result = await engine.login("admin", "wrong");
    expect(result.ok).toBe(false);
    if (!result.ok) { expect(result.reason).toBe("account-locked"); }
  });

  it("returns account-locked immediately when failure count reaches threshold", async () => {
    // Directly simulate the DB already holding 5+ failures
    vi.mocked(store.countRecentLoginFailures).mockReturnValue(5);
    const result = await engine.login("admin", "any-password");
    expect(result.ok).toBe(false);
    if (!result.ok) { expect(result.reason).toBe("account-locked"); }
    // verifyPassword must NOT be called when already locked
    expect(vi.mocked(store.verifyPassword)).not.toHaveBeenCalled();
  });

  it("does not lock when failure count is below threshold", async () => {
    vi.mocked(store.countRecentLoginFailures).mockReturnValue(3); // below MAX_FAILED_ATTEMPTS
    vi.mocked(store.verifyPassword).mockResolvedValue(true);
    vi.mocked(store.getUserByUsername).mockReturnValue({
      id: "u1",
      username: "admin",
      role: "super-admin" as UserRole,
      password_hash: "argon2id$salt$hash",
      totp_secret_enc: "",
      totp_enabled: 0,
      biometric_enrolled: 0,
      recovery_codes_enc: "",
      created_at: new Date().toISOString(),
      last_login_at: null,
    });
    const result = await engine.login("admin", "correct");
    expect(result.ok).toBe(true);
  });
});

// ─── verifyTotp() ────────────────────────────────────────────────────────

describe("verifyTotp()", () => {
  it("fails for invalid nonce", async () => {
    const result = await engine.verifyTotp("bad-nonce", "123456");
    expect(result.ok).toBe(false);
    if (!result.ok) { expect(result.reason).toBe("expired"); }
  });

  it("tries recovery code as fallback when TOTP code is invalid", async () => {
    // First set up a pending TOTP login
    vi.mocked(store.verifyPassword).mockResolvedValue(true);
    const loginResult = await engine.login("admin", "correct");
    expect(loginResult.ok).toBe(true);

    const nonce = (loginResult as Record<string, unknown>).nonce as string;
    expect(nonce).toBeTruthy();

    // TOTP verify fails, but recovery code succeeds
    vi.mocked(authenticator.verify).mockReturnValue(false);
    vi.mocked(store.useRecoveryCode).mockResolvedValue(true);

    const result = await engine.verifyTotp(nonce, "AAAA-BBBB");
    expect(result.ok).toBe(true);
    expect(vi.mocked(store.useRecoveryCode)).toHaveBeenCalled();
  });
});

// ─── User Management Facades ─────────────────────────────────────────────

describe("user management facades", () => {
  it("listUsers() delegates to store", () => {
    engine.listUsers();
    expect(vi.mocked(store.listUsers)).toHaveBeenCalled();
  });

  it("createUser() delegates to store", async () => {
    await engine.createUser({ username: "new", role: "viewer", password: "Pass12345678" });
    expect(vi.mocked(store.createUser)).toHaveBeenCalled();
  });

  it("updateUserRole() delegates to store", () => {
    engine.updateUserRole("u1", "admin");
    expect(vi.mocked(store.updateUserRole)).toHaveBeenCalledWith("u1", "admin");
  });

  it("resetPassword() invalidates target sessions", async () => {
    const result = await engine.resetPassword("u1", "NewPass12345");
    expect(result.ok).toBe(true);
    expect(vi.mocked(sessions.invalidateAllForUser)).toHaveBeenCalledWith("u1");
  });

  it("deleteUser() invalidates target sessions", () => {
    engine.deleteUser("u1");
    expect(vi.mocked(store.deleteUser)).toHaveBeenCalledWith("u1");
    expect(vi.mocked(sessions.invalidateAllForUser)).toHaveBeenCalledWith("u1");
  });

  it("changePassword() verifies current password first", async () => {
    vi.mocked(store.verifyPassword).mockResolvedValue(false);
    const result = await engine.changePassword("u1", "wrong", "NewPass");
    expect(result.ok).toBe(false);
    if (!result.ok) { expect(result.reason).toContain("incorrect"); }
    expect(vi.mocked(store.resetPassword)).not.toHaveBeenCalled();
  });

  it("changePassword() succeeds with correct current password", async () => {
    vi.mocked(store.verifyPassword).mockResolvedValue(true);
    const result = await engine.changePassword("u1", "correct", "NewPass");
    expect(result.ok).toBe(true);
    expect(vi.mocked(store.resetPassword)).toHaveBeenCalledWith("u1", "NewPass");
  });

  it("getAuditLog() delegates to store with default limit", () => {
    engine.getAuditLog();
    expect(vi.mocked(store.getAuditLog)).toHaveBeenCalledWith(100);
  });
});

// ─── Session Facades ─────────────────────────────────────────────────────

describe("session facades", () => {
  it("getSession() delegates to session manager", () => {
    engine.getSession("token-123");
    expect(vi.mocked(sessions.resolve)).toHaveBeenCalledWith("token-123");
  });

  it("logout() invalidates session and logs audit", () => {
    engine.logout("token-123");
    expect(vi.mocked(sessions.invalidate)).toHaveBeenCalledWith("token-123");
    expect(vi.mocked(store.auditLog)).toHaveBeenCalledWith(
      expect.objectContaining({ event: "logout" }),
    );
  });
});
