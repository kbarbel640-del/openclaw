/**
 * Installer IPC Handlers — registers all installer-related IPC channels.
 */

import { ipcMain } from "electron";
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

  ipcMain.handle("occc:install:validate-system", async () => {
    return validator.validate();
  });

  // ─── Docker ─────────────────────────────────────────────────────────

  ipcMain.handle("occc:install:docker-options", () => {
    return dockerInstaller.getOptions();
  });

  ipcMain.handle("occc:install:open-docker-download", async () => {
    await dockerInstaller.openDockerDesktopDownload();
  });

  ipcMain.handle("occc:install:docker-ce-command", () => {
    return dockerInstaller.getDockerCEInstallCommand();
  });

  ipcMain.handle("occc:install:start-docker-desktop", async () => {
    return dockerInstaller.startDockerDesktop();
  });

  ipcMain.handle("occc:install:verify-docker", async () => {
    return dockerInstaller.verify();
  });

  // ─── Voice Guide ────────────────────────────────────────────────────

  ipcMain.handle("occc:install:voice-speak", async (_event, text: string) => {
    await voice.speak(text);
  });

  ipcMain.handle("occc:install:voice-set-enabled", (_event, enabled: boolean) => {
    voice.setEnabled(enabled);
    return enabled;
  });

  ipcMain.handle("occc:install:voice-stop", () => {
    voice.stop();
  });

  // ─── GitHub Backup ──────────────────────────────────────────────────

  ipcMain.handle("occc:install:github-validate-pat", async (_event, pat: string) => {
    return githubSetup.validatePAT(pat);
  });

  ipcMain.handle("occc:install:github-check-scope", async (_event, pat: string) => {
    return githubSetup.checkRepoScope(pat);
  });

  ipcMain.handle("occc:install:github-create-repo", async (_event, pat: string) => {
    return githubSetup.createBackupRepo(pat);
  });

  // ─── Install ────────────────────────────────────────────────────────

  ipcMain.handle("occc:install:run", async (event, config: InstallerConfig) => {
    await engine.install(config, (progress) => {
      // Push progress to the renderer via the sender
      event.sender.send("occc:install:progress", progress);
    });
  });
}
