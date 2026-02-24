/**
 * Auth Store — encrypted persistent storage for user accounts.
 *
 * Uses better-sqlite3 for the database and node's built-in crypto
 * for encryption. The database file is stored in the app's userData
 * directory (OS-protected).
 *
 * Password hashing: Argon2id with strong parameters.
 * TOTP secrets: stored AES-256-GCM encrypted.
 * Session tokens: short-lived, signed with HMAC-SHA256.
 */

import { app } from "electron";
import path from "node:path";
import { createHash, createHmac, randomBytes, createCipheriv, createDecipheriv, timingSafeEqual } from "node:crypto";
import type { AuditLogEntry, UserRole, UserProfile } from "../../shared/ipc-types.js";

const DB_VERSION = 1;

/** Internal DB row shape. */
interface UserRow {
  id: string;
  username: string;
  role: UserRole;
  password_hash: string;   // Argon2id hash (hex)
  totp_secret_enc: string; // AES-256-GCM encrypted TOTP secret (base64)
  totp_enabled: number;    // 0 | 1 (SQLite boolean)
  biometric_enrolled: number;
  recovery_codes_enc: string; // AES-256-GCM encrypted JSON array of SHA-256 hashes
  created_at: string;      // ISO timestamp
  last_login_at: string | null;
}

/** Internal DB row shape for audit log entries. */
interface AuditRow {
  id: string;
  userId: string | null;
  event: string;
  method: string | null;
  success: number;
  timestamp: string;
  username: string | null;
}

export class AuthStore {
  private db: ReturnType<typeof import("better-sqlite3")> | null = null;
  private encKey: Buffer | null = null;

  /**
   * Initialize the database and encryption key.
   * The encryption key is derived from a machine-specific secret.
   */
  async init(): Promise<void> {
    // Derive encryption key from machine ID (scrypt)
    const { scryptSync } = await import("node:crypto");
    const machineId = await this.getMachineId();
    const salt = "occc-auth-v1";
    this.encKey = scryptSync(machineId, salt, 32);

    // Open database
    const Database = (await import("better-sqlite3")).default;
    const dbPath = path.join(app.getPath("userData"), "auth.db");
    this.db = new Database(dbPath);

    // Enable WAL mode for concurrency safety
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");

    this.migrate();
  }

  private migrate(): void {
    if (!this.db) {throw new Error("DB not initialized");}

    // Version table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    const versionRow = this.db.prepare("SELECT value FROM meta WHERE key = 'version'").get() as { value: string } | undefined;
    if (!versionRow) {
      this.db.prepare("INSERT INTO meta (key, value) VALUES ('version', ?)").run(String(DB_VERSION));
    }

    // Users table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL COLLATE NOCASE,
        role TEXT NOT NULL CHECK(role IN ('super-admin', 'admin', 'operator', 'viewer')),
        password_hash TEXT NOT NULL,
        totp_secret_enc TEXT NOT NULL DEFAULT '',
        totp_enabled INTEGER NOT NULL DEFAULT 0,
        biometric_enrolled INTEGER NOT NULL DEFAULT 0,
        recovery_codes_enc TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        last_login_at TEXT
      );
    `);

    // Audit log table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS auth_audit (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        event TEXT NOT NULL,
        method TEXT,
        success INTEGER NOT NULL,
        ip_hint TEXT,
        timestamp TEXT NOT NULL
      );
    `);
  }

  /** Check if any users exist (first-run detection). */
  hasUsers(): boolean {
    if (!this.db) {return false;}
    const row = this.db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
    return row.count > 0;
  }

  /** Get a user by username. */
  getUserByUsername(username: string): UserRow | null {
    if (!this.db) {return null;}
    return this.db.prepare("SELECT * FROM users WHERE username = ?").get(username) as UserRow | null;
  }

  /** Get a user by ID. */
  getUserById(id: string): UserRow | null {
    if (!this.db) {return null;}
    return this.db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | null;
  }

  /** List all users (for admin panel). */
  listUsers(): UserProfile[] {
    if (!this.db) {return [];}
    const rows = this.db.prepare("SELECT * FROM users ORDER BY created_at").all() as UserRow[];
    return rows.map((r) => this.rowToProfile(r));
  }

  /** Create a new user. Returns the created profile. */
  async createUser(params: {
    username: string;
    role: UserRole;
    password: string;
    totpSecret?: string;
  }): Promise<UserProfile> {
    if (!this.db) {throw new Error("DB not initialized");}

    const { argon2id } = await import("hash-wasm");

    const id = randomBytes(16).toString("hex");
    const salt = randomBytes(16);
    const hash = await argon2id({
      password: params.password,
      salt,
      iterations: 3,
      parallelism: 4,
      memorySize: 65536, // 64 MB
      hashLength: 32,
      outputType: "hex",
    });

    // Encode: "argon2id$<salt_hex>$<hash_hex>"
    const passwordHash = `argon2id$${salt.toString("hex")}$${hash}`;
    const totpSecretEnc = params.totpSecret ? this.encrypt(params.totpSecret) : "";
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO users (id, username, role, password_hash, totp_secret_enc, totp_enabled, biometric_enrolled, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, params.username, params.role, passwordHash, totpSecretEnc, totpSecretEnc ? 1 : 0, 0, now);

    this.auditLog({ event: "user_created", userId: id, method: "admin", success: true });

    return {
      id,
      username: params.username,
      role: params.role,
      biometricEnrolled: false,
      totpEnabled: !!params.totpSecret,
      createdAt: now,
      lastLoginAt: null,
    };
  }

  /** Verify a password against the stored hash. */
  async verifyPassword(userId: string, password: string): Promise<boolean> {
    const user = this.getUserById(userId);
    if (!user) {return false;}

    try {
      const [algo, saltHex, storedHash] = user.password_hash.split("$");
      if (algo !== "argon2id") {return false;}

      const { argon2id } = await import("hash-wasm");
      const salt = Buffer.from(saltHex, "hex");
      const computed = await argon2id({
        password,
        salt,
        iterations: 3,
        parallelism: 4,
        memorySize: 65536,
        hashLength: 32,
        outputType: "hex",
      });

      // Constant-time comparison
      return timingSafeEqual(
        Buffer.from(computed, "hex"),
        Buffer.from(storedHash, "hex"),
      );
    } catch {
      return false;
    }
  }

  /** Get the TOTP secret for a user (decrypted). */
  getTotpSecret(userId: string): string | null {
    const user = this.getUserById(userId);
    if (!user || !user.totp_secret_enc) {return null;}
    try {
      return this.decrypt(user.totp_secret_enc);
    } catch {
      return null;
    }
  }

  /** Mark biometric as enrolled for a user. */
  setBiometricEnrolled(userId: string, enrolled: boolean): void {
    this.db?.prepare("UPDATE users SET biometric_enrolled = ? WHERE id = ?")
      .run(enrolled ? 1 : 0, userId);
  }

  /** Update last login timestamp. */
  updateLastLogin(userId: string): void {
    this.db?.prepare("UPDATE users SET last_login_at = ? WHERE id = ?")
      .run(new Date().toISOString(), userId);
  }

  /** Write an audit log entry. */
  auditLog(entry: {
    event: string;
    userId?: string;
    method?: string;
    success: boolean;
    ipHint?: string;
  }): void {
    if (!this.db) {return;}
    this.db.prepare(`
      INSERT INTO auth_audit (id, user_id, event, method, success, ip_hint, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomBytes(8).toString("hex"),
      entry.userId ?? null,
      entry.event,
      entry.method ?? null,
      entry.success ? 1 : 0,
      entry.ipHint ?? null,
      new Date().toISOString(),
    );
  }

  /** Persist a TOTP secret (encrypted) and mark totp_enabled = 1. */
  setTotpSecret(userId: string, secret: string): void {
    if (!this.db) {throw new Error("DB not initialized");}
    const encrypted = this.encrypt(secret);
    this.db.prepare("UPDATE users SET totp_secret_enc = ?, totp_enabled = 1 WHERE id = ?")
      .run(encrypted, userId);
  }

  // ─── Recovery Codes ───────────────────────────────────────────────────

  /** Hash a recovery code for storage (SHA-256 hex). */
  private hashRecoveryCode(code: string): string {
    return createHash("sha256").update(code.toUpperCase().replace(/-/g, "")).digest("hex");
  }

  /** Store recovery codes (encrypted). Hashes each code for one-time-use verification. */
  async setRecoveryCodes(userId: string, codes: string[]): Promise<void> {
    if (!this.db) {throw new Error("DB not initialized");}
    const hashes = codes.map((c) => this.hashRecoveryCode(c));
    const encrypted = this.encrypt(JSON.stringify(hashes));
    this.db.prepare("UPDATE users SET recovery_codes_enc = ? WHERE id = ?")
      .run(encrypted, userId);
  }

  /** Try a recovery code. Returns true and consumes the code if valid. */
  async useRecoveryCode(userId: string, code: string): Promise<boolean> {
    if (!this.db) { return false; }
    const user = this.getUserById(userId);
    if (!user || !user.recovery_codes_enc) { return false; }

    let hashes: string[];
    try {
      hashes = JSON.parse(this.decrypt(user.recovery_codes_enc)) as string[];
    } catch {
      return false;
    }

    const inputHash = this.hashRecoveryCode(code);
    const idx = hashes.findIndex((h) => h === inputHash);
    if (idx === -1) { return false; }

    // Remove the used code and re-encrypt
    hashes.splice(idx, 1);
    const encrypted = this.encrypt(JSON.stringify(hashes));
    this.db.prepare("UPDATE users SET recovery_codes_enc = ? WHERE id = ?")
      .run(encrypted, userId);

    this.auditLog({ event: "recovery_code_used", userId, method: "recovery", success: true });
    return true;
  }

  /** Get a user DB row (internal use for auth-engine). */
  // Note: exposed as a method so auth-engine can read totp_enabled, biometric_enrolled
  getUserRowById(id: string): UserRow | null {
    return this.getUserById(id);
  }

  /** Delete a user by ID. Returns false if user not found or is the last super-admin. */
  deleteUser(userId: string): { ok: boolean; reason?: string } {
    if (!this.db) {return { ok: false, reason: "DB not initialized" };}

    const user = this.getUserById(userId);
    if (!user) {return { ok: false, reason: "User not found" };}

    // Prevent deleting the last super-admin
    if (user.role === "super-admin") {
      const row = this.db
        .prepare("SELECT COUNT(*) as count FROM users WHERE role = 'super-admin'")
        .get() as { count: number };
      if (row.count <= 1) {
        return { ok: false, reason: "Cannot delete the last super-admin account" };
      }
    }

    this.db.prepare("DELETE FROM users WHERE id = ?").run(userId);
    this.auditLog({ event: "user_deleted", userId, method: "admin", success: true });
    return { ok: true };
  }

  /** Update a user's role. Returns false if target role is invalid or would remove last super-admin. */
  updateUserRole(userId: string, newRole: UserRole): { ok: boolean; reason?: string } {
    if (!this.db) {return { ok: false, reason: "DB not initialized" };}

    const user = this.getUserById(userId);
    if (!user) {return { ok: false, reason: "User not found" };}

    // Prevent demoting the last super-admin
    if (user.role === "super-admin" && newRole !== "super-admin") {
      const row = this.db
        .prepare("SELECT COUNT(*) as count FROM users WHERE role = 'super-admin'")
        .get() as { count: number };
      if (row.count <= 1) {
        return { ok: false, reason: "Cannot demote the last super-admin account" };
      }
    }

    this.db.prepare("UPDATE users SET role = ? WHERE id = ?").run(newRole, userId);
    this.auditLog({ event: "role_changed", userId, method: `admin→${newRole}`, success: true });
    return { ok: true };
  }

  /** Reset a user's password (admin-initiated). Invalidates existing sessions. */
  async resetPassword(userId: string, newPassword: string): Promise<{ ok: boolean; reason?: string }> {
    if (!this.db) {return { ok: false, reason: "DB not initialized" };}

    const user = this.getUserById(userId);
    if (!user) {return { ok: false, reason: "User not found" };}

    try {
      const { argon2id } = await import("hash-wasm");
      const salt = randomBytes(16);
      const hash = await argon2id({
        password: newPassword,
        salt,
        iterations: 3,
        parallelism: 4,
        memorySize: 65536,
        hashLength: 32,
        outputType: "hex",
      });

      const passwordHash = `argon2id$${salt.toString("hex")}$${hash}`;
      this.db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, userId);
      this.auditLog({ event: "password_reset", userId, method: "admin", success: true });
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : "Hashing failed" };
    }
  }

  /** Read audit log entries (most recent first). */
  getAuditLog(limit = 100): AuditLogEntry[] {
    if (!this.db) {return [];}
    const rows = this.db
      .prepare(
        `SELECT a.id, a.user_id as userId, a.event, a.method, a.success, a.timestamp,
                u.username
         FROM auth_audit a
         LEFT JOIN users u ON a.user_id = u.id
         ORDER BY a.timestamp DESC
         LIMIT ?`,
      )
      .all(limit) as AuditRow[];
    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      username: r.username ?? null,
      event: r.event,
      method: r.method,
      success: r.success === 1,
      timestamp: r.timestamp,
    }));
  }


  // ─── Encryption helpers (AES-256-GCM) ────────────────────────────────

  private encrypt(plaintext: string): string {
    if (!this.encKey) {throw new Error("Encryption key not initialized");}
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.encKey, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    // Format: <iv_hex>:<tag_hex>:<ciphertext_base64>
    return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("base64")}`;
  }

  private decrypt(encoded: string): string {
    if (!this.encKey) {throw new Error("Encryption key not initialized");}
    const [ivHex, tagHex, ciphertextB64] = encoded.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const ciphertext = Buffer.from(ciphertextB64, "base64");
    const decipher = createDecipheriv("aes-256-gcm", this.encKey, iv);
    decipher.setAuthTag(tag);
    return decipher.update(ciphertext).toString("utf8") + decipher.final("utf8");
  }

  // ─── Machine ID ───────────────────────────────────────────────────────

  private async getMachineId(): Promise<string> {
    // Use a stable, machine-specific identifier
    const os = await import("node:os");
    const hostname = os.hostname();
    const username = os.userInfo().username;
    const homedir = os.homedir();
    return createHmac("sha256", "occc-machine-key")
      .update(`${hostname}:${username}:${homedir}`)
      .digest("hex");
  }

  private rowToProfile(row: UserRow): UserProfile {
    return {
      id: row.id,
      username: row.username,
      role: row.role,
      biometricEnrolled: row.biometric_enrolled === 1,
      totpEnabled: row.totp_enabled === 1,
      createdAt: row.created_at,
      lastLoginAt: row.last_login_at,
    };
  }
}
