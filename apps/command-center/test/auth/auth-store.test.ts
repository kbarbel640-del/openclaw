/**
 * AuthStore — unit tests for encrypted user storage.
 *
 * Since better-sqlite3 requires native bindings (built specifically for
 * Electron), we fully mock the SQLite layer and test AuthStore's logic
 * through its method contracts: CRUD, password hashing, TOTP encryption,
 * recovery codes, audit log, and role management.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────

// Mock electron.app + safeStorage
vi.mock("electron", () => ({
  app: { getPath: vi.fn(() => "/tmp/occc-test") },
  // isEncryptionAvailable returns false — uses the scrypt fallback path in tests
  safeStorage: { isEncryptionAvailable: vi.fn(() => false) },
}));

// Build an in-memory store that simulates SQLite prepare/exec/pragma
function makeInMemoryDb() {
  const tables: Record<string, Map<string, Record<string, unknown>>> = {};

  function ensureTable(name: string) {
    if (!tables[name]) { tables[name] = new Map(); }
    return tables[name];
  }

  // Simple SQL row store for our two tables
  const users = ensureTable("users");
  const auditLog = ensureTable("auth_audit");

  return {
    pragma: vi.fn(),
    exec: vi.fn(),
    prepare: vi.fn((sql: string) => {
      const normalised = sql.replace(/\s+/g, " ").trim();

      // COUNT users
      if (normalised.includes("SELECT COUNT(*)") && normalised.includes("FROM users")) {
        return {
          get: vi.fn((..._args: unknown[]) => {
            if (normalised.includes("role = 'super-admin'")) {
              let count = 0;
              for (const u of users.values()) { if (u.role === "super-admin") { count++; } }
              return { count };
            }
            return { count: users.size };
          }),
        };
      }
      // SELECT * FROM users WHERE username = ?
      if (normalised.includes("SELECT * FROM users WHERE username")) {
        return {
          get: vi.fn((username: string) => {
            for (const u of users.values()) {
              if ((u.username as string).toLowerCase() === username.toLowerCase()) { return { ...u }; }
            }
            return null;
          }),
        };
      }
      // SELECT * FROM users WHERE id = ?
      if (normalised.includes("SELECT * FROM users WHERE id")) {
        return {
          get: vi.fn((id: string) => {
            const u = users.get(id);
            return u ? { ...u } : null;
          }),
        };
      }
      // SELECT * FROM users ORDER BY
      if (normalised.includes("SELECT * FROM users ORDER BY")) {
        return {
          all: vi.fn(() => [...users.values()].map((u) => ({ ...u }))),
        };
      }
      // INSERT INTO users
      if (normalised.includes("INSERT INTO users")) {
        return {
          run: vi.fn((...args: unknown[]) => {
            const vals = args as string[];
            const id = vals[0];
            const username = vals[1];
            const role = vals[2];
            const phash = vals[3];
            const totp_enc = vals[4];
            const totp_en = vals[5];
            const bio = vals[6];
            const created = vals[7];
            if ([...users.values()].some((u) => (u.username as string).toLowerCase() === username.toLowerCase())) {
              throw new Error("UNIQUE constraint failed: users.username");
            }
            users.set(id, {
              id, username, role, password_hash: phash,
              totp_secret_enc: totp_enc, totp_enabled: Number(totp_en),
              biometric_enrolled: Number(bio), recovery_codes_enc: "",
              created_at: created, last_login_at: null,
            });
          }),
        };
      }
      // UPDATE users SET biometric_enrolled
      if (normalised.includes("UPDATE users SET biometric_enrolled")) {
        return {
          run: vi.fn((val: number, id: string) => {
            const u = users.get(id);
            if (u) { u.biometric_enrolled = val; }
          }),
        };
      }
      // UPDATE users SET last_login_at
      if (normalised.includes("UPDATE users SET last_login_at")) {
        return {
          run: vi.fn((ts: string, id: string) => {
            const u = users.get(id);
            if (u) { u.last_login_at = ts; }
          }),
        };
      }
      // UPDATE users SET role
      if (normalised.includes("UPDATE users SET role")) {
        return {
          run: vi.fn((role: string, id: string) => {
            const u = users.get(id);
            if (u) { u.role = role; }
          }),
        };
      }
      // UPDATE users SET password_hash
      if (normalised.includes("UPDATE users SET password_hash")) {
        return {
          run: vi.fn((hash: string, id: string) => {
            const u = users.get(id);
            if (u) { u.password_hash = hash; }
          }),
        };
      }
      // UPDATE users SET totp_secret_enc
      if (normalised.includes("UPDATE users SET totp_secret_enc")) {
        return {
          run: vi.fn((enc: string, id: string) => {
            const u = users.get(id);
            if (u) { u.totp_secret_enc = enc; u.totp_enabled = 1; }
          }),
        };
      }
      // UPDATE users SET recovery_codes_enc
      if (normalised.includes("UPDATE users SET recovery_codes_enc")) {
        return {
          run: vi.fn((enc: string, id: string) => {
            const u = users.get(id);
            if (u) { u.recovery_codes_enc = enc; }
          }),
        };
      }
      // DELETE FROM users WHERE id
      if (normalised.includes("DELETE FROM users WHERE id")) {
        return {
          run: vi.fn((id: string) => { users.delete(id); }),
        };
      }
      // INSERT INTO auth_audit
      if (normalised.includes("INSERT INTO auth_audit")) {
        return {
          run: vi.fn((...args: unknown[]) => {
            const [id, userId, event, method, success, ipHint, ts] = args as (string | null)[];
            auditLog.set(id!, { id, user_id: userId, event, method, success: Number(success), ip_hint: ipHint, timestamp: ts });
          }),
        };
      }
      // COUNT(*) from auth_audit (used by countRecentLoginFailures)
      if (normalised.includes("COUNT(*)") && normalised.includes("FROM auth_audit")) {
        return {
          get: vi.fn((userId: string, since: string) => {
            const count = [...auditLog.values()].filter((r) =>
              r.user_id === userId && r.event === "login_failed" && String(r.timestamp) > since,
            ).length;
            return { count };
          }),
        };
      }
      // SELECT audit log
      if (normalised.includes("FROM auth_audit")) {
        return {
          all: vi.fn((limit: number) => {
            const entries = [...auditLog.values()]
              .toSorted((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
              .slice(0, limit);
            return entries.map((r) => {
              const userId = r.user_id as string | null;
              const user = userId ? users.get(userId) : null;
              return { ...r, userId, username: user ? (user.username as string) : null };
            });
          }),
        };
      }
      // SELECT value FROM meta
      if (normalised.includes("SELECT value FROM meta")) {
        return { get: vi.fn(() => undefined) };
      }
      // INSERT INTO meta
      if (normalised.includes("INSERT INTO meta")) {
        return { run: vi.fn() };
      }

      // Fallback
      return { run: vi.fn(), get: vi.fn(() => null), all: vi.fn(() => []) };
    }),
    close: vi.fn(),
  };
}

let mockDb: ReturnType<typeof makeInMemoryDb>;

vi.mock("better-sqlite3", () => ({
  default: vi.fn(function () { return mockDb; }),
}));

// Fast Argon2id mock — returns deterministic hex based on input
vi.mock("hash-wasm", () => ({
  argon2id: vi.fn(async ({ password, salt }: { password: string; salt: Uint8Array }) => {
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
  mockDb = makeInMemoryDb();
  store = new AuthStore();
  await store.init();
});

afterEach(() => {
  mockDb.close();
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
    // Both events should be present
    const events = entries.map((e) => e.event);
    expect(events).toContain("test_event");
    expect(events).toContain("test_event_2");
  });

  it("respects the limit parameter", async () => {
    for (let i = 0; i < 10; i++) {
      store.auditLog({ event: `event_${i}`, success: true });
    }
    const entries = store.getAuditLog(3);
    expect(entries).toHaveLength(3);
  });
});
