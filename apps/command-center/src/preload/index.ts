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
  biometricAuth: () =>
    ipcRenderer.invoke(IPC_CHANNELS.AUTH_BIOMETRIC),
  verifyTotp: (code) =>
    ipcRenderer.invoke(IPC_CHANNELS.AUTH_VERIFY_TOTP, code),
  logout: (token?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGOUT, token),
  getSession: (token?) =>
    ipcRenderer.invoke(IPC_CHANNELS.AUTH_SESSION, token),
  elevate: (token?, totpCode?) =>
    ipcRenderer.invoke(IPC_CHANNELS.AUTH_ELEVATE, token, totpCode),

  // ─── Environment ──────────────────────────────────────────────────────
  getEnvironmentStatus: () =>
    ipcRenderer.invoke(IPC_CHANNELS.ENV_STATUS),
  createEnvironment: (config) =>
    ipcRenderer.invoke(IPC_CHANNELS.ENV_CREATE, config),
  startEnvironment: () =>
    ipcRenderer.invoke(IPC_CHANNELS.ENV_START),
  stopEnvironment: () =>
    ipcRenderer.invoke(IPC_CHANNELS.ENV_STOP),
  destroyEnvironment: () =>
    ipcRenderer.invoke(IPC_CHANNELS.ENV_DESTROY),

  // ─── Docker ───────────────────────────────────────────────────────────
  getDockerInfo: () =>
    ipcRenderer.invoke(IPC_CHANNELS.DOCKER_INFO),

  // ─── Config ───────────────────────────────────────────────────────────
  getConfigSections: () =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_SECTIONS),
  getConfig: (section) =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET, section),
  setConfig: (section, values) =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_SET, section, values),

  // ─── Skills ───────────────────────────────────────────────────────────
  listSkills: () =>
    ipcRenderer.invoke(IPC_CHANNELS.SKILLS_LIST),
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
    if (!channel.startsWith("occc:")) {
      return Promise.reject(new Error(`Forbidden channel: ${channel}`));
    }
    return ipcRenderer.invoke(channel, ...args);
  },
};

// Expose the typed bridge to the renderer as window.occc
contextBridge.exposeInMainWorld("occc", bridge);
