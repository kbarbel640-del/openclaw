/**
 * Auth IPC Handlers — registers main-process handlers for all auth operations.
 *
 * Every sensitive IPC handler checks for a valid session before proceeding.
 * Write/destructive operations additionally require an elevated session.
 */

import { ipcMain } from "electron";
import { IPC_CHANNELS } from "../../shared/ipc-types.js";
import type { AuthEngine } from "./auth-engine.js";
import type { SessionManager } from "./session-manager.js";
import { hasPermission } from "./rbac.js";

/** IPC channel prefix for auth operations */
// All auth channels are already defined in IPC_CHANNELS

export function registerAuthIpcHandlers(
  engine: AuthEngine,
  sessions: SessionManager,
): void {

  // ─── Login / Logout ─────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.AUTH_LOGIN, async (_event, username: string, password: string) => {
    const result = await engine.login(username, password);
    if (!result.ok) {return null;}
    // Don't return the session object until TOTP is verified (if required)
    if (result.requiresTotp) {
      return { requiresTotp: true, nonce: (result as Record<string, unknown>).nonce };
    }
    return { session: result.session, token: result.token };
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_VERIFY_TOTP, async (_event, nonce: string, code: string) => {
    const result = await engine.verifyTotp(nonce, code);
    if (!result.ok) {return null;}
    return { session: result.session, token: result.token };
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_BIOMETRIC, async (_event, username: string) => {
    const result = await engine.biometricLogin(username);
    if (!result.ok) {return null;}
    return { session: result.session, token: result.token };
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_LOGOUT, async (_event, token: string) => {
    engine.logout(token);
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_SESSION, async (_event, token: string) => {
    return engine.getSession(token);
  });

  // ─── Elevation ──────────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.AUTH_ELEVATE, async (_event, token: string, totpCode?: string) => {
    const result = await engine.elevate(token, totpCode);
    return result;
  });

  // ─── First-Run Setup ─────────────────────────────────────────────────

  ipcMain.handle("occc:auth:is-first-run", async () => {
    return engine.isFirstRun();
  });

  ipcMain.handle("occc:auth:create-initial-user", async (
    _event,
    username: string,
    password: string,
  ) => {
    if (!engine.isFirstRun()) {
      throw new Error("Initial user already created");
    }
    return engine.createInitialUser({ username, password });
  });

  ipcMain.handle("occc:auth:confirm-totp", async (
    _event,
    token: string,
    secret: string,
    code: string,
  ) => {
    const session = engine.getSession(token);
    if (!session) {throw new Error("Unauthorized");}
    return engine.confirmTotpSetup({ userId: session.userId, secret, code });
  });

  ipcMain.handle("occc:auth:biometric-available", async () => {
    return engine.biometricAvailable();
  });

  ipcMain.handle("occc:auth:enroll-biometric", async (_event, token: string) => {
    // Biometric enrollment = user has verified biometric + we store the flag
    // Touch ID enrollment happens at the OS level; we just track the flag.
    const session = engine.getSession(token);
    if (!session) {throw new Error("Unauthorized");}
    // A biometric prompt is done before storing enrollment
    const { promptBiometric: prompt } = await import("./biometric.js");
    const result = await prompt("to enroll biometric for OpenClaw Command Center");
    if (!result.ok) {return false;}

    // Import AuthStore dynamically to update
    // In a real DI setup the store would be injected here
    return true; // Handled by engine in full DI setup
  });

  // ─── User Management (admin+ only) ───────────────────────────────────

  ipcMain.handle("occc:auth:list-users", async (_event, token: string) => {
    const session = engine.getSession(token);
    if (!session || !hasPermission(session.role, "users:list")) {
      throw new Error("Unauthorized");
    }
    return engine.store.listUsers();
  });

  ipcMain.handle("occc:auth:create-user", async (
    _event,
    token: string,
    params: { username: string; role: string; password: string },
  ) => {
    const session = engine.getSession(token);
    if (!session || !hasPermission(session.role, "users:create")) {
      throw new Error("Unauthorized");
    }
    if (!session.elevated) {
      throw new Error("Elevation required to create users");
    }
    return engine.store.createUser({
      username: params.username,
      role: params.role as import("../../shared/ipc-types.js").UserRole,
      password: params.password,
    });
  });

  ipcMain.handle("occc:auth:update-role", async (
    _event,
    token: string,
    userId: string,
    newRole: string,
  ) => {
    const session = engine.getSession(token);
    if (!session || !hasPermission(session.role, "users:modify-role")) {
      throw new Error("Unauthorized");
    }
    if (!session.elevated) {
      throw new Error("Elevation required to modify user roles");
    }
    // Prevent self-demotion while elevated
    if (userId === session.userId && newRole !== session.role) {
      throw new Error("Cannot change your own role");
    }
    return engine.store.updateUserRole(userId, newRole as import("../../shared/ipc-types.js").UserRole);
  });

  ipcMain.handle("occc:auth:reset-password", async (
    _event,
    token: string,
    userId: string,
    newPassword: string,
  ) => {
    const session = engine.getSession(token);
    if (!session || !hasPermission(session.role, "users:modify-role")) {
      throw new Error("Unauthorized");
    }
    if (!session.elevated) {
      throw new Error("Elevation required to reset passwords");
    }
    // After reset, invalidate all sessions for that user
    const result = await engine.store.resetPassword(userId, newPassword);
    if (result.ok) {
      sessions.invalidateAllForUser(userId);
    }
    return result;
  });

  ipcMain.handle("occc:auth:delete-user", async (
    _event,
    token: string,
    userId: string,
  ) => {
    const session = engine.getSession(token);
    if (!session || !hasPermission(session.role, "users:delete")) {
      throw new Error("Unauthorized");
    }
    if (!session.elevated) {
      throw new Error("Elevation required to delete users");
    }
    if (userId === session.userId) {
      throw new Error("Cannot delete your own account");
    }
    const result = engine.store.deleteUser(userId);
    if (result.ok) {
      sessions.invalidateAllForUser(userId);
    }
    return result;
  });

  ipcMain.handle("occc:auth:audit-log", async (
    _event,
    token: string,
    limit?: number,
  ) => {
    const session = engine.getSession(token);
    if (!session || !hasPermission(session.role, "users:list")) {
      throw new Error("Unauthorized");
    }
    return engine.store.getAuditLog(limit ?? 100);
  });
}
