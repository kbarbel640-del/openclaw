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
import type { AuthSession, UserProfile, UserRole } from "../../shared/ipc-types.js";
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

export class AuthEngine {
  /** Pending TOTP logins: nonce → state */
  private pendingLogins = new Map<string, PendingTotpLogin>();

  constructor(
    readonly store: AuthStore,
    private readonly sessions: SessionManager,
  ) {
    // Configure otplib
    authenticator.options = {
      window: 1, // Accept codes 30s before/after for clock drift
      digits: 6,
    };
  }

  // ─── First-Run Setup ─────────────────────────────────────────────────

  /** True if no users exist yet (first launch). */
  isFirstRun(): boolean {
    return !this.store.hasUsers();
  }

  /** Create the initial Super Admin account. */
  async createInitialUser(params: {
    username: string;
    password: string;
  }): Promise<{ profile: UserProfile; totpSetup: TotpSetupInfo }> {
    const profile = await this.store.createUser({
      username: params.username,
      role: "super-admin",
      password: params.password,
    });

    // Always set up TOTP for the Super Admin
    const totpSetup = await this.generateTotpSetup(params.username);
    return { profile, totpSetup };
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
    if (!secret) {return { ok: false, reason: "invalid-code" };}

    const valid = authenticator.verify({ token: code, secret });
    if (!valid) {
      this.store.auditLog({ event: "totp_failed", userId: pending.userId, method: "totp", success: false });
      return { ok: false, reason: "invalid-code" };
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
  async biometricLogin(username: string): Promise<LoginResult> {
    const user = this.store.getUserByUsername(username);
    if (!user || !user.biometric_enrolled) {
      return { ok: false, reason: "invalid-credentials" };
    }

    const result = await promptBiometric("to sign in to OpenClaw Command Center");
    if (!result.ok) {
      const reason = result.reason === "cancelled" ? "invalid-credentials" : "invalid-credentials";
      this.store.auditLog({ event: "biometric_login_failed", userId: user.id, method: "biometric", success: false });
      return { ok: false, reason };
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

  /** Generate a new TOTP secret and QR code for setup. */
  async generateTotpSetup(username: string): Promise<TotpSetupInfo> {
    const secret = authenticator.generateSecret(32);
    const otpAuthUrl = authenticator.keyuri(username, "OpenClaw Command Center", secret);

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

  /** Confirm TOTP setup by verifying a code, then save the secret. */
  async confirmTotpSetup(params: {
    userId: string;
    secret: string;
    code: string;
  }): Promise<boolean> {
    const valid = authenticator.verify({ token: params.code, secret: params.secret });
    if (!valid) {return false;}

    // Re-create user with TOTP secret (or use a dedicated update method)
    // For now: update via store method
    this.store.setTotpSecret(params.userId, params.secret);
    this.store.auditLog({ event: "totp_setup", userId: params.userId, method: "totp", success: true });
    return true;
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
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
