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
    // TOTP is still required even after a successful biometric prompt
    if (result.requiresTotp) {
      return { requiresTotp: true, nonce: (result as Record<string, unknown>).nonce };
    }
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

  ipcMain.handle(IPC_CHANNELS.AUTH_IS_FIRST_RUN, async () => {
    return engine.isFirstRun();
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_CREATE_INITIAL_USER, async (
    _event,
    username: string,
    password: string,
  ) => {
    if (!engine.isFirstRun()) {
      throw new Error("Initial user already created");
    }
    return engine.createInitialUser({ username, password });
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_CONFIRM_TOTP, async (
    _event,
    token: string,
    code: string,
  ) => {
    const session = engine.getSession(token);
    if (!session) {throw new Error("Unauthorized");}
    // secret is looked up server-side from pendingTotpSetups — renderer copy is ignored
    return engine.confirmTotpSetup({ userId: session.userId, code });
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_BIOMETRIC_AVAILABLE, async () => {
    return engine.biometricAvailable();
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_ENROLL_BIOMETRIC, async (_event, token: string) => {
    const session = engine.getSession(token);
    if (!session) {throw new Error("Unauthorized");}
    if (!session.elevated) {throw new Error("Elevation required to enroll biometric");}
    const result = await engine.enrollBiometric(session.userId);
    sessions.dropElevation(token);
    return result;
  });

  // ─── User Management (admin+ only) ───────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.AUTH_LIST_USERS, async (_event, token: string) => {
    const session = engine.getSession(token);
    if (!session || !hasPermission(session.role, "users:list")) {
      throw new Error("Unauthorized");
    }
    return engine.listUsers();
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_CREATE_USER, async (
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
    const created = await engine.createUser({
      username: params.username,
      role: params.role as import("../../shared/ipc-types.js").UserRole,
      password: params.password,
    });
    sessions.dropElevation(token);
    return created;
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_UPDATE_ROLE, async (
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
    const result = engine.updateUserRole(userId, newRole as import("../../shared/ipc-types.js").UserRole);
    sessions.dropElevation(token);
    return result;
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_RESET_PASSWORD, async (
    _event,
    token: string,
    userId: string,
    newPassword: string,
  ) => {
    const session = engine.getSession(token);
    if (!session || !hasPermission(session.role, "users:reset-password")) {
      throw new Error("Unauthorized");
    }
    if (!session.elevated) {
      throw new Error("Elevation required to reset passwords");
    }
    const result = await engine.resetPassword(userId, newPassword);
    sessions.dropElevation(token);
    return result;
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_DELETE_USER, async (
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
    const result = engine.deleteUser(userId);
    sessions.dropElevation(token);
    return result;
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_AUDIT_LOG, async (
    _event,
    token: string,
    limit?: number,
  ) => {
    const session = engine.getSession(token);
    if (!session || !hasPermission(session.role, "users:list")) {
      throw new Error("Unauthorized");
    }
    return engine.getAuditLog(limit);
  });

  // ─── Self-service ───────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.AUTH_CHANGE_PASSWORD, async (
    _event,
    token: string,
    currentPassword: string,
    newPassword: string,
  ) => {
    const session = engine.getSession(token);
    if (!session) {
      throw new Error("Unauthorized");
    }
    return engine.changePassword(session.userId, currentPassword, newPassword);
  });
}
