/**
 * Docker Installer — guides the user through installing Docker Desktop or CE.
 *
 * macOS/Windows: opens the Docker Desktop download page + verifies installation.
 * Linux:         offers to run the official Docker CE install script via sudo.
 *
 * This module never blindly executes — it always surfaces the action
 * to the user via the UI before doing anything.
 */

import { shell } from "electron";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { EngineDetector } from "../docker/engine-detector.js";

const execAsync = promisify(exec);

/** Download URLs for Docker Desktop by platform. */
const DOCKER_DESKTOP_URLS: Record<string, string> = {
  darwin: "https://www.docker.com/products/docker-desktop/",
  win32: "https://www.docker.com/products/docker-desktop/",
  linux: "https://www.docker.com/products/docker-desktop/",
};

/** Official Docker CE convenience install script for Linux. */
const DOCKER_CE_INSTALL_CMD =
  "curl -fsSL https://get.docker.com | sh && sudo usermod -aG docker $USER";

export type DockerInstallOption = "desktop" | "ce";

export interface DockerInstallProgress {
  status: "pending" | "installing" | "waiting" | "verifying" | "done" | "error";
  message: string;
  requiresRestart?: boolean;
}

export class DockerInstaller {
  private detector = new EngineDetector();

  /**
   * Get available installation options for the current platform.
   */
  getOptions(): { dockerDesktop: boolean; dockerCE: boolean } {
    return this.detector.getInstallOptions();
  }

  /**
   * Open Docker Desktop download page in the system browser.
   * Returns immediately — the user installs manually.
   */
  async openDockerDesktopDownload(): Promise<void> {
    const url = DOCKER_DESKTOP_URLS[process.platform] ?? DOCKER_DESKTOP_URLS.darwin;
    await shell.openExternal(url);
  }

  /**
   * For Linux only: build the Docker CE install command to show the user.
   * Does NOT execute it — returns the command for user review in the UI.
   */
  getDockerCEInstallCommand(): string {
    return DOCKER_CE_INSTALL_CMD;
  }

  /**
   * Poll until Docker becomes available or timeout expires.
   *
   * @param timeoutMs - Max wait time in ms (default 5 minutes)
   * @param onProgress - Called with status as polling progresses
   */
  async waitForDocker(
    timeoutMs = 5 * 60 * 1000,
    onProgress?: (msg: string) => void,
  ): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    let attempt = 0;

    while (Date.now() < deadline) {
      attempt++;
      onProgress?.(`Checking for Docker… (attempt ${attempt})`);

      const info = await this.detector.detect();
      if (info.running) {
        onProgress?.("Docker is running! ✓");
        return true;
      }

      // Wait 5 seconds between polls
      await sleep(5_000);
    }

    onProgress?.("Timed out waiting for Docker.");
    return false;
  }

  /**
   * Verify Docker is reachable after install.
   */
  async verify(): Promise<{ ok: boolean; version?: string; error?: string }> {
    try {
      const info = await this.detector.detect();
      if (info.running) {
        return { ok: true, version: info.version };
      }
      return { ok: false, error: "Docker daemon is not running. Try restarting Docker." };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
    }
  }

  /**
   * Start Docker Desktop programmatically (macOS / Windows only).
   */
  async startDockerDesktop(): Promise<boolean> {
    try {
      if (process.platform === "darwin") {
        await execAsync("open -a Docker");
        return true;
      }
      if (process.platform === "win32") {
        await execAsync('"C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe"');
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
