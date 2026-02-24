/**
 * Auth Engine — orchestrates login, TOTP setup, biometric, and TOTP verification.
 *
 * This is the single entry point for all auth operations. It wires together:
 *   - AuthStore (persistence)
 *   - SessionManager (in-memory sessions)
 *   - Biometric (OS-native prompt)
 *   - otplib (TOTP generation/verification)
 */

import { authenticator } from "otplib";
import { randomBytes } from "node:crypto";
import type {
  AuditLogEntry,
  AuthSession,
  CreateUserParams,
  MutationResult,
  UserProfile,
  UserRole,
} from "../../shared/ipc-types.js";
import type { AuthStore } from "./auth-store.js";
import type { SessionManager } from "./session-manager.js";
import { isBiometricAvailable, promptBiometric } from "./biometric.js";

export type LoginResult =
  | { ok: true; session: AuthSession; token: string; requiresTotp: boolean }
  | { ok: false; reason: "invalid-credentials" | "account-locked" | "unknown" };

export type TotpVerifyResult =
  | { ok: true; session: AuthSession; token: string }
  | { ok: false; reason: "invalid-code" | "expired" };

export type ElevateResult =
  | { ok: true }
  | { ok: false; reason: "biometric-failed" | "biometric-cancelled" | "totp-required" | "invalid-code" };

export interface TotpSetupInfo {
  secret: string;
  otpAuthUrl: string;
  qrDataUrl: string; // base64 QR code PNG
}

/** Per-user pending TOTP state during login (before 2FA verified). */
interface PendingTotpLogin {
  userId: string;
  role: UserRole;
  expiresAt: number;
}

// ─── Login Rate Limiting ────────────────────────────────────────────────

/** Max consecutive failed login attempts before lockout. */
const MAX_FAILED_ATTEMPTS = 5;

/** Lockout duration after too many failed attempts (15 minutes). */
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

/** Number of recovery codes to generate per user. */
const RECOVERY_CODE_COUNT = 8;

/** Pending TOTP setup: userId → { secret, expiresAt } */
interface PendingTotpSetup {
  secret: string;
  expiresAt: number;
}

/** Cleanup interval for expired pending logins and TOTP setups (60 s). */
const CLEANUP_INTERVAL_MS = 60_000;

export class AuthEngine {
  /** Pending TOTP logins: nonce → state */
  private pendingLogins = new Map<string, PendingTotpLogin>();

  /** Pending TOTP setups: userId → { secret, expiresAt } — never trust renderer copy */
  private pendingTotpSetups = new Map<string, PendingTotpSetup>();

  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(
    private readonly store: AuthStore,
    private readonly sessions: SessionManager,
  ) {
    // Configure otplib
    authenticator.options = {
      window: 1, // Accept codes 30s before/after for clock drift
      digits: 6,
    };

    // Periodically prune expired pending TOTP logins and lockout entries
    this.cleanupInterval = setInterval(() => this.pruneExpired(), CLEANUP_INTERVAL_MS);
  }

  /** Stop the cleanup timer (call on shutdown). */
  destroy(): void {
    clearInterval(this.cleanupInterval);
  }

  /** Remove expired pending logins and stale lockout entries. */
  private pruneExpired(): void {
    const now = Date.now();
    for (const [nonce, pending] of this.pendingLogins) {
      if (now > pending.expiresAt) {
        this.pendingLogins.delete(nonce);
      }
    }
    for (const [userId, setup] of this.pendingTotpSetups) {
      if (now > setup.expiresAt) {
        this.pendingTotpSetups.delete(userId);
      }
    }
  }

  // ─── First-Run Setup ─────────────────────────────────────────────────

  /** True if no users exist yet (first launch). */
  isFirstRun(): boolean {
    return !this.store.hasUsers();
  }

  /** Create the initial Super Admin account with TOTP + recovery codes. */
  async createInitialUser(params: {
    username: string;
    password: string;
  }): Promise<{ profile: UserProfile; totpSetup: TotpSetupInfo; recoveryCodes: string[] }> {
    const profile = await this.store.createUser({
      username: params.username,
      role: "super-admin",
      password: params.password,
    });

    // Always set up TOTP for the Super Admin
    const totpSetup = await this.generateTotpSetup(params.username, profile.id);

    // Generate recovery codes
    const recoveryCodes = this.generateRecoveryCodesList();
    await this.store.setRecoveryCodes(profile.id, recoveryCodes);

    return { profile, totpSetup, recoveryCodes };
  }

  // ─── Login ──────────────────────────────────────────────────────────

  /**
   * Authenticate with username + password.
   *
   * If TOTP is enabled, returns `requiresTotp: true` with a nonce.
   * The caller must then call `verifyTotp()` to complete login.
   */
  async login(username: string, password: string): Promise<LoginResult & { nonce?: string }> {
    const user = this.store.getUserByUsername(username);
    if (!user) {
      // Constant-time delay to prevent user enumeration
      await sleep(200);
      return { ok: false, reason: "invalid-credentials" };
    }

    // DB-backed lockout: count recent failures persisted across restarts
    const failures = this.store.countRecentLoginFailures(user.id, LOCKOUT_DURATION_MS);
    if (failures >= MAX_FAILED_ATTEMPTS) {
      this.store.auditLog({ event: "login_locked", userId: user.id, method: "password", success: false });
      return { ok: false, reason: "account-locked" };
    }

    const valid = await this.store.verifyPassword(user.id, password);
    if (!valid) {
      this.store.auditLog({ event: "login_failed", userId: user.id, method: "password", success: false });
      return { ok: false, reason: "invalid-credentials" };
    }

    // If TOTP is enabled, return a pending-login nonce
    if (user.totp_enabled) {
      const nonce = randomBytes(16).toString("hex");
      this.pendingLogins.set(nonce, {
        userId: user.id,
        role: user.role,
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 min to enter TOTP
      });
      return { ok: true, session: {} as AuthSession, token: "", requiresTotp: true, nonce };
    }

    // No TOTP — create session directly
    const { session, token } = this.sessions.createSession(user.id, user.role);
    this.store.updateLastLogin(user.id);
    this.store.auditLog({ event: "login_success", userId: user.id, method: "password", success: true });
    return { ok: true, session, token, requiresTotp: false };
  }

  /** Complete login after TOTP verification. */
  async verifyTotp(nonce: string, code: string): Promise<TotpVerifyResult> {
    const pending = this.pendingLogins.get(nonce);
    if (!pending || Date.now() > pending.expiresAt) {
      this.pendingLogins.delete(nonce);
      return { ok: false, reason: "expired" };
    }

    const secret = this.store.getTotpSecret(pending.userId);
    if (!secret) { return { ok: false, reason: "invalid-code" }; }

    const valid = authenticator.verify({ token: code, secret });
    if (!valid) {
      // Try recovery code as fallback
      const recoveryUsed = await this.store.useRecoveryCode(pending.userId, code);
      if (!recoveryUsed) {
        this.store.auditLog({ event: "totp_failed", userId: pending.userId, method: "totp", success: false });
        return { ok: false, reason: "invalid-code" };
      }
      this.store.auditLog({ event: "recovery_code_used", userId: pending.userId, method: "recovery", success: true });
    }

    this.pendingLogins.delete(nonce);
    const { session, token } = this.sessions.createSession(pending.userId, pending.role);
    this.store.updateLastLogin(pending.userId);
    this.store.auditLog({ event: "login_success", userId: pending.userId, method: "totp", success: true });
    return { ok: true, session, token };
  }

  // ─── Biometric Login ─────────────────────────────────────────────────

  /**
   * Authenticate via biometric (Touch ID / Windows Hello).
   * Only available if the current user has biometric enrolled.
   */
  async biometricLogin(username: string): Promise<LoginResult & { nonce?: string }> {
    const user = this.store.getUserByUsername(username);
    if (!user || !user.biometric_enrolled) {
      return { ok: false, reason: "invalid-credentials" };
    }

    // Apply the same DB-backed lockout as password login
    const failures = this.store.countRecentLoginFailures(user.id, LOCKOUT_DURATION_MS);
    if (failures >= MAX_FAILED_ATTEMPTS) {
      this.store.auditLog({ event: "login_locked", userId: user.id, method: "biometric", success: false });
      return { ok: false, reason: "account-locked" };
    }

    const result = await promptBiometric("to sign in to OpenClaw Command Center");
    if (!result.ok) {
      // Record as login_failed so it counts toward the lockout
      this.store.auditLog({ event: "login_failed", userId: user.id, method: "biometric", success: false });
      return { ok: false, reason: "invalid-credentials" };
    }

    // Biometric passed — but TOTP is still required if enrolled (2FA must not be bypassed)
    if (user.totp_enabled) {
      const nonce = randomBytes(16).toString("hex");
      this.pendingLogins.set(nonce, {
        userId: user.id,
        role: user.role,
        expiresAt: Date.now() + 5 * 60 * 1000,
      });
      return { ok: true, session: {} as AuthSession, token: "", requiresTotp: true, nonce };
    }

    const { session, token } = this.sessions.createSession(user.id, user.role);
    this.store.updateLastLogin(user.id);
    this.store.auditLog({ event: "login_success", userId: user.id, method: "biometric", success: true });
    return { ok: true, session, token, requiresTotp: false };
  }

  // ─── Elevation (Re-Auth for Sensitive Ops) ────────────────────────────

  /**
   * Re-authenticate to elevate a session for sensitive operations.
   * Tries biometric first; falls back to TOTP code if provided.
   */
  async elevate(sessionToken: string, totpCode?: string): Promise<ElevateResult> {
    const session = this.sessions.resolve(sessionToken);
    if (!session) {return { ok: false, reason: "totp-required" };}

    const user = this.store.getUserById(session.userId);
    if (!user) {return { ok: false, reason: "totp-required" };}

    // Try biometric first if available and enrolled
    const biometricAvailable = await isBiometricAvailable();
    if (biometricAvailable && user.biometric_enrolled) {
      const result = await promptBiometric("to confirm this action");
      if (result.ok) {
        this.sessions.elevateSession(sessionToken);
        this.store.auditLog({ event: "elevation_success", userId: user.id, method: "biometric", success: true });
        return { ok: true };
      }
      if (result.reason === "cancelled") {
        return { ok: false, reason: "biometric-cancelled" };
      }
      // Biometric failed — fall through to TOTP
    }

    // TOTP elevation
    if (user.totp_enabled && totpCode) {
      const secret = this.store.getTotpSecret(user.id);
      if (secret && authenticator.verify({ token: totpCode, secret })) {
        this.sessions.elevateSession(sessionToken);
        this.store.auditLog({ event: "elevation_success", userId: user.id, method: "totp", success: true });
        return { ok: true };
      }
      this.store.auditLog({ event: "elevation_failed", userId: user.id, method: "totp", success: false });
      return { ok: false, reason: "invalid-code" };
    }

    return { ok: false, reason: "totp-required" };
  }

  // ─── TOTP Setup ──────────────────────────────────────────────────────

  /** Generate and store a TOTP secret server-side. Returns setup info for QR display. */
  async generateTotpSetup(username: string, userId: string): Promise<TotpSetupInfo> {
    const secret = authenticator.generateSecret(32);
    const otpAuthUrl = authenticator.keyuri(username, "OpenClaw Command Center", secret);

    // Hold the secret server-side so confirmTotpSetup never trusts the renderer's copy
    this.pendingTotpSetups.set(userId, {
      secret,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 min to complete enrollment
    });

    // Generate QR code as data URL
    let qrDataUrl = "";
    try {
      const qrcode = await import("qrcode");
      qrDataUrl = await qrcode.toDataURL(otpAuthUrl, { width: 200 });
    } catch {
      // qrcode not available — UI will show manual entry
    }

    return { secret, otpAuthUrl, qrDataUrl };
  }

  /** Confirm TOTP setup using the server-stored pending secret (renderer secret is ignored). */
  async confirmTotpSetup(params: {
    userId: string;
    code: string;
  }): Promise<boolean> {
    const pending = this.pendingTotpSetups.get(params.userId);
    if (!pending || Date.now() > pending.expiresAt) {
      this.pendingTotpSetups.delete(params.userId);
      return false;
    }

    const valid = authenticator.verify({ token: params.code, secret: pending.secret });
    if (!valid) { return false; }

    // Consume the pending secret and persist it
    this.pendingTotpSetups.delete(params.userId);
    this.store.setTotpSecret(params.userId, pending.secret);
    this.store.auditLog({ event: "totp_setup", userId: params.userId, method: "totp", success: true });
    return true;
  }

  // ─── Biometric Enrollment ─────────────────────────────────────────────

  /** Enroll biometric for a user (prompt + store flag). */
  async enrollBiometric(userId: string): Promise<boolean> {
    const result = await promptBiometric("to enroll biometric for OpenClaw Command Center");
    if (!result.ok) { return false; }
    this.store.setBiometricEnrolled(userId, true);
    this.store.auditLog({ event: "biometric_enrolled", userId, method: "biometric", success: true });
    return true;
  }

  // ─── User Management Facade ───────────────────────────────────────────

  /** List all users. */
  listUsers(): UserProfile[] {
    return this.store.listUsers();
  }

  /** Create a user (admin-initiated). */
  async createUser(params: CreateUserParams): Promise<UserProfile> {
    return this.store.createUser(params);
  }

  /** Update a user's role. */
  updateUserRole(userId: string, newRole: UserRole): MutationResult {
    return this.store.updateUserRole(userId, newRole);
  }

  /** Admin-initiated password reset. Invalidates target's sessions. */
  async resetPassword(userId: string, newPassword: string): Promise<MutationResult> {
    const result = await this.store.resetPassword(userId, newPassword);
    if (result.ok) {
      this.sessions.invalidateAllForUser(userId);
    }
    return result;
  }

  /** Delete a user. Invalidates target's sessions. */
  deleteUser(userId: string): MutationResult {
    const result = this.store.deleteUser(userId);
    if (result.ok) {
      this.sessions.invalidateAllForUser(userId);
    }
    return result;
  }

  /** Self-service password change (verifies current password first). */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<MutationResult & { newToken?: string }> {
    const valid = await this.store.verifyPassword(userId, currentPassword);
    if (!valid) {
      return { ok: false, reason: "Current password is incorrect" };
    }
    const result = await this.store.resetPassword(userId, newPassword);
    if (result.ok) {
      this.store.auditLog({ event: "password_changed", userId, method: "self-service", success: true });
      // Invalidate all existing sessions so old tokens can no longer be used
      this.sessions.invalidateAllForUser(userId);
      // Re-issue a fresh session so the caller stays logged in
      const user = this.store.getUserById(userId);
      if (user) {
        const { token: newToken } = this.sessions.createSession(userId, user.role);
        return { ok: true, newToken };
      }
    }
    return result;
  }

  /** Get audit log entries. */
  getAuditLog(limit?: number): AuditLogEntry[] {
    return this.store.getAuditLog(limit ?? 100);
  }

  // ─── Session ─────────────────────────────────────────────────────────

  getSession(token: string): AuthSession | null {
    return this.sessions.resolve(token);
  }

  logout(token: string): void {
    const session = this.sessions.resolve(token);
    if (session) {
      this.store.auditLog({ event: "logout", userId: session.userId, success: true });
    }
    this.sessions.invalidate(token);
  }

  async biometricAvailable(): Promise<boolean> {
    return isBiometricAvailable();
  }

  // ─── Recovery Code Helpers ────────────────────────────────────────────

  /** Generate a list of human-readable recovery codes (XXXX-XXXX format). */
  private generateRecoveryCodesList(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
      const raw = randomBytes(4).toString("hex").toUpperCase();
      codes.push(`${raw.slice(0, 4)}-${raw.slice(4, 8)}`);
    }
    return codes;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
