/**
 * AuthStore — unit tests for encrypted user storage.
 *
 * Uses an in-memory SQLite database (no disk) by mocking Electron's `app`
 * and the `hash-wasm` Argon2id function for speed.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";

// ─── Mocks ────────────────────────────────────────────────────────────────

// Mock electron.app so getPath returns a tmp dir
vi.mock("electron", () => ({
  app: { getPath: vi.fn(() => "/tmp/occc-test") },
}));

// Intercept better-sqlite3 to use in-memory DB
let testDb: InstanceType<typeof Database>;
vi.mock("better-sqlite3", () => ({
  default: vi.fn(() => testDb),
}));

// Fast Argon2id mock — returns deterministic hex based on input
vi.mock("hash-wasm", () => ({
  argon2id: vi.fn(async ({ password, salt }: { password: string; salt: Uint8Array }) => {
    // Deterministic fast hash for tests (NOT secure — test only)
    const { createHash } = await import("node:crypto");
    return createHash("sha256")
      .update(password)
      .update(Buffer.from(salt))
      .digest("hex")
      .slice(0, 64);
  }),
}));

import { AuthStore } from "../../src/main/auth/auth-store.js";

let store: AuthStore;

beforeEach(async () => {
  testDb = new Database(":memory:");
  testDb.pragma("journal_mode = WAL");
  testDb.pragma("foreign_keys = ON");
  store = new AuthStore();
  await store.init();
});

afterEach(() => {
  testDb.close();
});

// ─── hasUsers() ──────────────────────────────────────────────────────────

describe("hasUsers()", () => {
  it("returns false on empty DB", () => {
    expect(store.hasUsers()).toBe(false);
  });

  it("returns true after creating a user", async () => {
    await store.createUser({ username: "admin", role: "super-admin", password: "Test1234abcd" });
    expect(store.hasUsers()).toBe(true);
  });
});

// ─── createUser() ────────────────────────────────────────────────────────

describe("createUser()", () => {
  it("creates a user with the correct profile shape", async () => {
    const profile = await store.createUser({ username: "alice", role: "admin", password: "SecureP@ss12" });
    expect(profile.id).toBeTruthy();
    expect(profile.username).toBe("alice");
    expect(profile.role).toBe("admin");
    expect(profile.biometricEnrolled).toBe(false);
    expect(profile.createdAt).toBeTruthy();
  });

  it("rejects duplicate usernames (case-insensitive)", async () => {
    await store.createUser({ username: "bob", role: "viewer", password: "Pass123456xz" });
    await expect(store.createUser({ username: "Bob", role: "viewer", password: "Pass123456xz" }))
      .rejects.toThrow();
  });
});

// ─── verifyPassword() ────────────────────────────────────────────────────

describe("verifyPassword()", () => {
  it("returns true for correct password", async () => {
    const profile = await store.createUser({ username: "carol", role: "operator", password: "MyP@ssw0rd12" });
    expect(await store.verifyPassword(profile.id, "MyP@ssw0rd12")).toBe(true);
  });

  it("returns false for wrong password", async () => {
    const profile = await store.createUser({ username: "dave", role: "operator", password: "RightPass123" });
    expect(await store.verifyPassword(profile.id, "WrongPass123")).toBe(false);
  });

  it("returns false for non-existent user", async () => {
    expect(await store.verifyPassword("nonexistent", "anything")).toBe(false);
  });
});

// ─── getUserByUsername() / getUserById() ──────────────────────────────────

describe("user lookups", () => {
  it("finds user by username (case-insensitive)", async () => {
    await store.createUser({ username: "Eve", role: "viewer", password: "TestPass1234" });
    const row = store.getUserByUsername("eve");
    expect(row).not.toBeNull();
    expect(row!.username).toBe("Eve");
  });

  it("finds user by ID", async () => {
    const profile = await store.createUser({ username: "frank", role: "admin", password: "TestPass1234" });
    const row = store.getUserById(profile.id);
    expect(row).not.toBeNull();
    expect(row!.id).toBe(profile.id);
  });
});

// ─── listUsers() ─────────────────────────────────────────────────────────

describe("listUsers()", () => {
  it("lists all users as UserProfile objects", async () => {
    await store.createUser({ username: "u1", role: "super-admin", password: "Pass12345678" });
    await store.createUser({ username: "u2", role: "viewer", password: "Pass12345678" });
    const list = store.listUsers();
    expect(list).toHaveLength(2);
    expect(list[0].username).toBe("u1");
    expect(list[1].username).toBe("u2");
  });
});

// ─── TOTP ────────────────────────────────────────────────────────────────

describe("TOTP management", () => {
  it("stores and retrieves an encrypted TOTP secret", async () => {
    const profile = await store.createUser({ username: "totp-user", role: "admin", password: "Pass12345678" });
    store.setTotpSecret(profile.id, "JBSWY3DPEHPK3PXP");
    const secret = store.getTotpSecret(profile.id);
    expect(secret).toBe("JBSWY3DPEHPK3PXP");
  });

  it("returns null for a user without TOTP", async () => {
    const profile = await store.createUser({ username: "no-totp", role: "viewer", password: "Pass12345678" });
    expect(store.getTotpSecret(profile.id)).toBeNull();
  });
});

// ─── Biometric Enrollment ────────────────────────────────────────────────

describe("biometric enrollment", () => {
  it("toggles biometric_enrolled flag", async () => {
    const profile = await store.createUser({ username: "bio", role: "operator", password: "Pass12345678" });
    store.setBiometricEnrolled(profile.id, true);
    const row = store.getUserById(profile.id);
    expect(row!.biometric_enrolled).toBe(1);

    store.setBiometricEnrolled(profile.id, false);
    const row2 = store.getUserById(profile.id);
    expect(row2!.biometric_enrolled).toBe(0);
  });
});

// ─── Recovery Codes ──────────────────────────────────────────────────────

describe("recovery codes", () => {
  it("stores and validates a recovery code (one-time use)", async () => {
    const profile = await store.createUser({ username: "rc-user", role: "admin", password: "Pass12345678" });
    const codes = ["AAAA-BBBB", "CCCC-DDDD", "EEEE-FFFF"];
    await store.setRecoveryCodes(profile.id, codes);

    // Valid code succeeds
    expect(await store.useRecoveryCode(profile.id, "AAAA-BBBB")).toBe(true);

    // Same code fails on second use
    expect(await store.useRecoveryCode(profile.id, "AAAA-BBBB")).toBe(false);

    // Other codes still work
    expect(await store.useRecoveryCode(profile.id, "CCCC-DDDD")).toBe(true);
  });

  it("returns false for an invalid recovery code", async () => {
    const profile = await store.createUser({ username: "rc-bad", role: "admin", password: "Pass12345678" });
    await store.setRecoveryCodes(profile.id, ["AAAA-BBBB"]);
    expect(await store.useRecoveryCode(profile.id, "XXXX-YYYY")).toBe(false);
  });

  it("returns false for user with no recovery codes", async () => {
    const profile = await store.createUser({ username: "rc-none", role: "viewer", password: "Pass12345678" });
    expect(await store.useRecoveryCode(profile.id, "AAAA-BBBB")).toBe(false);
  });
});

// ─── deleteUser() ────────────────────────────────────────────────────────

describe("deleteUser()", () => {
  it("deletes a user", async () => {
    const profile = await store.createUser({ username: "del-me", role: "viewer", password: "Pass12345678" });
    const result = store.deleteUser(profile.id);
    expect(result.ok).toBe(true);
    expect(store.getUserById(profile.id)).toBeNull();
  });

  it("prevents deleting the last super-admin", async () => {
    const profile = await store.createUser({ username: "sole-admin", role: "super-admin", password: "Pass12345678" });
    const result = store.deleteUser(profile.id);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("last super-admin");
  });
});

// ─── updateUserRole() ────────────────────────────────────────────────────

describe("updateUserRole()", () => {
  it("changes a user's role", async () => {
    const profile = await store.createUser({ username: "role-change", role: "viewer", password: "Pass12345678" });
    const result = store.updateUserRole(profile.id, "operator");
    expect(result.ok).toBe(true);
    expect(store.getUserById(profile.id)!.role).toBe("operator");
  });

  it("prevents demoting the last super-admin", async () => {
    const profile = await store.createUser({ username: "last-sa", role: "super-admin", password: "Pass12345678" });
    const result = store.updateUserRole(profile.id, "admin");
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("last super-admin");
  });
});

// ─── resetPassword() ─────────────────────────────────────────────────────

describe("resetPassword()", () => {
  it("resets password and new password verifies", async () => {
    const profile = await store.createUser({ username: "pw-reset", role: "operator", password: "OldPass12345" });
    const result = await store.resetPassword(profile.id, "NewPass12345");
    expect(result.ok).toBe(true);
    expect(await store.verifyPassword(profile.id, "NewPass12345")).toBe(true);
    expect(await store.verifyPassword(profile.id, "OldPass12345")).toBe(false);
  });
});

// ─── auditLog() / getAuditLog() ──────────────────────────────────────────

describe("audit log", () => {
  it("writes and retrieves audit entries", async () => {
    store.auditLog({ event: "test_event", userId: "u1", success: true });
    store.auditLog({ event: "test_event_2", success: false });
    const entries = store.getAuditLog(10);
    expect(entries.length).toBeGreaterThanOrEqual(2);
    // Most recent first
    expect(entries[0].event).toBe("test_event_2");
  });

  it("respects the limit parameter", async () => {
    for (let i = 0; i < 10; i++) {
      store.auditLog({ event: `event_${i}`, success: true });
    }
    const entries = store.getAuditLog(3);
    expect(entries).toHaveLength(3);
  });
});
