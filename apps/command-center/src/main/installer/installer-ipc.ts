/**
 * Installer IPC Handlers — registers all installer-related IPC channels.
 */

import { ipcMain } from "electron";
import { IPC_CHANNELS } from "../../shared/ipc-types.js";
import { SystemValidator } from "./system-validator.js";
import { DockerInstaller } from "./docker-installer.js";
import { VoiceGuide } from "./voice-guide.js";
import { GitHubBackupSetup } from "./github-setup.js";
import { InstallerEngine, type InstallerConfig } from "./installer-engine.js";
import type { DockerEngineClient } from "../docker/engine-client.js";
import type { ContainerManager } from "../docker/container-manager.js";

export function registerInstallerIpcHandlers(
  docker: DockerEngineClient,
  containers: ContainerManager,
): void {
  const validator = new SystemValidator();
  const dockerInstaller = new DockerInstaller();
  const voice = new VoiceGuide();
  const githubSetup = new GitHubBackupSetup();
  const engine = new InstallerEngine(docker, containers);

  // ─── System Validation ──────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.INSTALL_VALIDATE_SYSTEM, async () => {
    return validator.validate();
  });

  // ─── Docker ─────────────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.INSTALL_DOCKER_OPTIONS, () => {
    return dockerInstaller.getOptions();
  });

  ipcMain.handle(IPC_CHANNELS.INSTALL_OPEN_DOCKER_DOWNLOAD, async () => {
    await dockerInstaller.openDockerDesktopDownload();
  });

  ipcMain.handle(IPC_CHANNELS.INSTALL_DOCKER_CE_COMMAND, () => {
    return dockerInstaller.getDockerCEInstallCommand();
  });

  ipcMain.handle(IPC_CHANNELS.INSTALL_START_DOCKER_DESKTOP, async () => {
    return dockerInstaller.startDockerDesktop();
  });

  ipcMain.handle(IPC_CHANNELS.INSTALL_VERIFY_DOCKER, async () => {
    return dockerInstaller.verify();
  });

  // ─── Voice Guide ────────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.INSTALL_VOICE_SPEAK, async (_event, text: unknown) => {
    // Validate: must be a string, max 512 chars, no ASCII control characters
    if (typeof text !== "string") { return; }
    // Strip ASCII control characters (0x00–0x1F, DEL) and clamp length
    // eslint-disable-next-line no-control-regex
    const safe = text.replace(/[\x00-\x1f\x7f]/g, "").slice(0, 512);
    if (!safe) { return; }
    await voice.speak(safe);
  });

  ipcMain.handle(IPC_CHANNELS.INSTALL_VOICE_SET_ENABLED, (_event, enabled: unknown) => {
    voice.setEnabled(enabled === true);
    return enabled === true;
  });

  ipcMain.handle(IPC_CHANNELS.INSTALL_VOICE_STOP, () => {
    voice.stop();
  });

  // ─── GitHub Backup ──────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.INSTALL_GITHUB_VALIDATE_PAT, async (_event, pat: unknown) => {
    if (typeof pat !== "string") { return { valid: false }; }
    return githubSetup.validatePAT(pat);
  });

  ipcMain.handle(IPC_CHANNELS.INSTALL_GITHUB_CHECK_SCOPE, async (_event, pat: unknown) => {
    if (typeof pat !== "string") { return { hasScope: false }; }
    return githubSetup.checkRepoScope(pat);
  });

  ipcMain.handle(IPC_CHANNELS.INSTALL_GITHUB_CREATE_REPO, async (_event, pat: unknown) => {
    if (typeof pat !== "string") { throw new Error("Invalid PAT"); }
    return githubSetup.createBackupRepo(pat);
  });

  // ─── Install ────────────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.INSTALL_RUN, async (event, config: InstallerConfig) => {
    await engine.install(config, (progress) => {
      // Push progress to the renderer via the sender
      event.sender.send(IPC_CHANNELS.INSTALL_PROGRESS, progress);
    });
  });
}
