/**
 * Preload Script — Typed IPC bridge between main process and renderer.
 *
 * This is the ONLY entry point for renderer↔main communication.
 * Uses contextBridge to expose a minimal, typed API as `window.occc`.
 *
 * Security:
 *   - Exposes ONLY the methods defined in OcccBridge
 *   - All IPC calls go through named channels
 *   - No direct access to Node.js APIs from renderer
 */

import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS, type OcccBridge } from "../shared/ipc-types.js";

const bridge: OcccBridge = {
  // ─── Auth ─────────────────────────────────────────────────────────────
  login: (username, password) =>
    ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGIN, username, password),
  biometricAuth: (username) =>
    ipcRenderer.invoke(IPC_CHANNELS.AUTH_BIOMETRIC, username),
  verifyTotp: (code) =>
    ipcRenderer.invoke(IPC_CHANNELS.AUTH_VERIFY_TOTP, code),
  logout: (token?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGOUT, token),
  getSession: (token?) =>
    ipcRenderer.invoke(IPC_CHANNELS.AUTH_SESSION, token),
  elevate: (token?, totpCode?) =>
    ipcRenderer.invoke(IPC_CHANNELS.AUTH_ELEVATE, token, totpCode),

  // ─── Auth — First Run ──────────────────────────────────────────────────
  isFirstRun: () =>
    ipcRenderer.invoke(IPC_CHANNELS.AUTH_IS_FIRST_RUN),
  createInitialUser: (username, password) =>
    ipcRenderer.invoke(IPC_CHANNELS.AUTH_CREATE_INITIAL_USER, username, password),
  confirmTotp: (token, secret, code) =>
    ipcRenderer.invoke(IPC_CHANNELS.AUTH_CONFIRM_TOTP, token, secret, code),
  isBiometricAvailable: () =>
    ipcRenderer.invoke(IPC_CHANNELS.AUTH_BIOMETRIC_AVAILABLE),
  enrollBiometric: (token) =>
    ipcRenderer.invoke(IPC_CHANNELS.AUTH_ENROLL_BIOMETRIC, token),

  // ─── Auth — User Management ───────────────────────────────────────────
  listUsers: (token) =>
    ipcRenderer.invoke(IPC_CHANNELS.AUTH_LIST_USERS, token),
  createUser: (token, params) =>
    ipcRenderer.invoke(IPC_CHANNELS.AUTH_CREATE_USER, token, params),
  updateUserRole: (token, userId, role) =>
    ipcRenderer.invoke(IPC_CHANNELS.AUTH_UPDATE_ROLE, token, userId, role),
  resetUserPassword: (token, userId, newPassword) =>
    ipcRenderer.invoke(IPC_CHANNELS.AUTH_RESET_PASSWORD, token, userId, newPassword),
  deleteUser: (token, userId) =>
    ipcRenderer.invoke(IPC_CHANNELS.AUTH_DELETE_USER, token, userId),
  getAuditLog: (token, limit?) =>
    ipcRenderer.invoke(IPC_CHANNELS.AUTH_AUDIT_LOG, token, limit),

  // ─── Auth — Self-service ──────────────────────────────────────────────
  changePassword: (token, currentPassword, newPassword) =>
    ipcRenderer.invoke(IPC_CHANNELS.AUTH_CHANGE_PASSWORD, token, currentPassword, newPassword),

  // ─── Environment ──────────────────────────────────────────────────────
  getEnvironmentStatus: (token) =>
    ipcRenderer.invoke(IPC_CHANNELS.ENV_STATUS, token),
  createEnvironment: (token, config) =>
    ipcRenderer.invoke(IPC_CHANNELS.ENV_CREATE, token, config),
  startEnvironment: (token) =>
    ipcRenderer.invoke(IPC_CHANNELS.ENV_START, token),
  stopEnvironment: (token) =>
    ipcRenderer.invoke(IPC_CHANNELS.ENV_STOP, token),
  destroyEnvironment: (token) =>
    ipcRenderer.invoke(IPC_CHANNELS.ENV_DESTROY, token),
  getEnvironmentLogs: (token, containerId) =>
    ipcRenderer.invoke(IPC_CHANNELS.ENV_LOGS, token, containerId),

  // ─── Docker ───────────────────────────────────────────────────────────
  getDockerInfo: () =>
    ipcRenderer.invoke(IPC_CHANNELS.DOCKER_INFO),

  // ─── Config ───────────────────────────────────────────────────────────
  getConfigSections: (token) =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_SECTIONS, token),
  getConfig: (token, section) =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET, token, section),
  setConfig: (token, section, values) =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_SET, token, section, values),

  // ─── Skills ───────────────────────────────────────────────────────────
  listSkills: (token) =>
    ipcRenderer.invoke(IPC_CHANNELS.SKILLS_LIST, token),
  installSkill: (name) =>
    ipcRenderer.invoke(IPC_CHANNELS.SKILLS_INSTALL, name),
  scanSkill: (path) =>
    ipcRenderer.invoke(IPC_CHANNELS.SKILLS_SCAN, path),

  // ─── System ───────────────────────────────────────────────────────────
  validateSystem: () =>
    ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_VALIDATE),
  getPlatform: () =>
    ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_PLATFORM),

  // ─── Backup ───────────────────────────────────────────────────────────
  createBackup: () =>
    ipcRenderer.invoke(IPC_CHANNELS.BACKUP_CREATE),
  getBackupHistory: () =>
    ipcRenderer.invoke(IPC_CHANNELS.BACKUP_HISTORY),

  // ─── Events (main → renderer) ─────────────────────────────────────────
  on: (channel, callback) => {
    // Only allow our namespaced channels
    if (!channel.startsWith("occc:")) { return; }
    ipcRenderer.on(channel, (_event, ...args) => callback(...args));
  },
  off: (channel, callback) => {
    if (!channel.startsWith("occc:")) { return; }
    ipcRenderer.removeListener(channel, callback);
  },
  invoke: (channel, ...args) => {
    // Dev-only escape hatch for scaffold channels not yet in the typed bridge.
    // Production builds reject all invoke() calls so no untrusted channel
    // access survives a release.
    if (process.env.NODE_ENV === "production") {
      return Promise.reject(new Error("invoke() is not available in production"));
    }
    if (!channel.startsWith("occc:")) {
      return Promise.reject(new Error(`Forbidden channel: ${channel}`));
    }
    return ipcRenderer.invoke(channel, ...args);
  },
};

// Expose the typed bridge to the renderer as window.occc
// Note: the bridge object is cast here because `invoke` is dev-only and the
// TS type includes it for renderer type-checking, but the preload gates it.
contextBridge.exposeInMainWorld("occc", bridge);
