/**
 * Docker Engine Detector — determines which container runtime is available.
 *
 * Detection order:
 *   1. Docker Desktop (has Docker Desktop UI process + Docker CLI)
 *   2. Docker CE / Engine (daemon-only, no Desktop UI)
 *   3. Podman (as a fallback)
 *   4. None
 *
 * This never surfaces "Docker" or "container" to the user — the UI calls
 * it "OpenClaw Environment Engine" if it needs to refer to it at all.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import type { DockerInfo, DockerVariant } from "../../shared/ipc-types.js";

const execFileAsync = promisify(execFile);

/** Paths where Docker Desktop installs on each platform. */
const DOCKER_DESKTOP_INDICATORS: Record<string, string[]> = {
  darwin: [
    "/Applications/Docker.app",
    `${process.env.HOME}/Applications/Docker.app`,
  ],
  win32: [
    "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe",
    `${process.env.LOCALAPPDATA}\\Docker\\Docker Desktop.exe`,
  ],
  linux: [
    "/opt/docker-desktop/bin/docker-desktop",
  ],
};

export class EngineDetector {
  /**
   * Detect the installed container engine and its status.
   */
  async detect(): Promise<DockerInfo> {
    // Try Docker first
    const dockerResult = await this.probeDocker();
    if (dockerResult) return dockerResult;

    // Try Podman as fallback
    const podmanResult = await this.probePodman();
    if (podmanResult) return podmanResult;

    return {
      variant: "none",
      version: "",
      apiVersion: "",
      running: false,
    };
  }

  /**
   * Check if Docker Desktop or Docker CE can be installed on this platform.
   */
  getInstallOptions(): { dockerDesktop: boolean; dockerCE: boolean } {
    const platform = process.platform;
    return {
      dockerDesktop: platform === "darwin" || platform === "win32" || platform === "linux",
      dockerCE: platform === "linux",
    };
  }

  private async probeDocker(): Promise<DockerInfo | null> {
    try {
      const { stdout } = await execFileAsync("docker", ["version", "--format", "json"], {
        timeout: 10_000,
      });

      const info = JSON.parse(stdout);
      const clientVersion = info.Client?.Version ?? "";
      const apiVersion = info.Client?.ApiVersion ?? "";
      const serverRunning = !!info.Server?.Version;

      // Determine if Docker Desktop or CE
      const variant = this.isDockerDesktop() ? "docker-desktop" : "docker-ce";

      return {
        variant,
        version: clientVersion,
        apiVersion,
        running: serverRunning,
      };
    } catch {
      // docker command failed — not installed or not in PATH
      return null;
    }
  }

  private async probePodman(): Promise<DockerInfo | null> {
    try {
      const { stdout } = await execFileAsync("podman", ["version", "--format", "json"], {
        timeout: 10_000,
      });
      const info = JSON.parse(stdout);
      return {
        variant: "podman",
        version: info.Client?.Version ?? info.Version ?? "",
        apiVersion: info.Client?.APIVersion ?? "",
        running: true, // If podman version succeeds, it's usable
      };
    } catch {
      return null;
    }
  }

  /**
   * Heuristic: check if Docker Desktop is installed by looking for
   * platform-specific indicators (app bundles, executables).
   */
  private isDockerDesktop(): boolean {
    const indicators = DOCKER_DESKTOP_INDICATORS[process.platform] ?? [];
    return indicators.some((p) => existsSync(p));
  }
}
