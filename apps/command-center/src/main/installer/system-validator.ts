/**
 * System Validator — comprehensive pre-installation system checks.
 *
 * Checks: OS version, Docker engine, available RAM, free disk space,
 * port availability, and Node.js version.
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import { createServer } from "node:net";
import type { SystemCheck, SystemValidation } from "../../shared/ipc-types.js";
import { DEFAULT_GATEWAY_PORT, DEFAULT_BRIDGE_PORT } from "../../shared/constants.js";
import { EngineDetector } from "../docker/engine-detector.js";

const execAsync = promisify(exec);

const MIN_RAM_GB = 4;
const REC_RAM_GB = 8;
const MIN_DISK_GB = 10;

export class SystemValidator {
  private detector = new EngineDetector();

  async validate(): Promise<SystemValidation> {
    const checks = await Promise.all([
      this.checkOS(),
      this.checkNode(),
      this.checkDocker(),
      this.checkRAM(),
      this.checkDisk(),
      this.checkPort(DEFAULT_GATEWAY_PORT, "Gateway port"),
      this.checkPort(DEFAULT_BRIDGE_PORT, "Bridge port"),
    ]);

    const allPassed = checks.every((c) => c.result === "pass");
    const canProceed = checks.every((c) => c.result !== "fail");

    return { checks, allPassed, canProceed };
  }

  // ─── Individual Checks ──────────────────────────────────────────────

  private async checkOS(): Promise<SystemCheck> {
    const platform = process.platform;
    const release = os.release();

    const supported: Record<string, { min: number; label: string }> = {
      darwin: { min: 22, label: "macOS 13+" },   // Ventura = Darwin 22
      win32: { min: 10, label: "Windows 10+" },
      linux: { min: 0, label: "Linux" },
    };

    const entry = supported[platform];
    if (!entry) {
      return {
        name: "Operating System",
        description: "Supported OS required",
        result: "fail",
        message: `${platform} is not supported. Use macOS, Windows, or Linux.`,
        autoFixAvailable: false,
      };
    }

    const majorVersion = parseInt(release.split(".")[0] ?? "0", 10);
    const pass = majorVersion >= entry.min;
    const osLabel = platform === "darwin"
      ? `macOS (Darwin ${release})`
      : platform === "win32"
      ? `Windows (${release})`
      : `Linux (${release})`;

    return {
      name: "Operating System",
      description: `${entry.label} required`,
      result: pass ? "pass" : "warn",
      message: pass ? `${osLabel} ✓` : `${osLabel} — consider upgrading`,
      autoFixAvailable: false,
    };
  }

  private async checkNode(): Promise<SystemCheck> {
    const version = process.versions.node;
    const [major] = version.split(".").map(Number);
    const pass = major >= 22;
    return {
      name: "Node.js Runtime",
      description: "Node.js 22.12.0 or later required",
      result: pass ? "pass" : "fail",
      message: pass ? `Node.js v${version} ✓` : `Node.js v${version} — upgrade to v22.12.0+`,
      autoFixAvailable: false,
    };
  }

  private async checkDocker(): Promise<SystemCheck> {
    const info = await this.detector.detect();
    const options = this.detector.getInstallOptions();

    if (!info.running) {
      const canFix = options.dockerDesktop || options.dockerCE;
      return {
        name: "Container Engine",
        description: "Docker Desktop or Docker CE required",
        result: "fail",
        message: info.variant === "none"
          ? "No container engine found. Install Docker Desktop or Docker CE."
          : `Docker found but not running (${info.variant}).`,
        autoFixAvailable: canFix,
      };
    }

    const label = info.variant === "docker-desktop"
      ? "Docker Desktop"
      : info.variant === "docker-ce"
      ? "Docker CE"
      : info.variant;

    return {
      name: "Container Engine",
      description: "Docker Desktop or Docker CE",
      result: "pass",
      message: `${label} v${info.version} ✓`,
      autoFixAvailable: false,
    };
  }

  private async checkRAM(): Promise<SystemCheck> {
    const totalGB = os.totalmem() / 1024 / 1024 / 1024;
    const freeGB = os.freemem() / 1024 / 1024 / 1024;
    const totalRounded = Math.round(totalGB * 10) / 10;
    const freeRounded = Math.round(freeGB * 10) / 10;

    let result: "pass" | "warn" | "fail";
    let message: string;

    if (freeGB >= MIN_RAM_GB) {
      result = freeGB >= REC_RAM_GB ? "pass" : "warn";
      message = result === "pass"
        ? `${freeRounded} GB free (${totalRounded} GB total) ✓`
        : `${freeRounded} GB free — ${REC_RAM_GB} GB recommended for best performance`;
    } else {
      result = "warn";
      message = `Only ${freeRounded} GB free. Close other apps for better performance.`;
    }

    return {
      name: "Available Memory",
      description: `${MIN_RAM_GB} GB free RAM recommended`,
      result,
      message,
      autoFixAvailable: false,
    };
  }

  private async checkDisk(): Promise<SystemCheck> {
    let freeGB = 0;
    try {
      if (process.platform === "win32") {
        const { stdout } = await execAsync(
          'powershell -command "Get-PSDrive C | Select-Object Free | ConvertTo-Json"',
        );
        const data = JSON.parse(stdout);
        freeGB = (data.Free ?? 0) / 1024 / 1024 / 1024;
      } else {
        const { stdout } = await execAsync("df -k $HOME");
        const lines = stdout.trim().split("\n");
        const parts = lines[lines.length - 1]?.split(/\s+/) ?? [];
        const availKB = parseInt(parts[3] ?? "0", 10);
        freeGB = availKB / 1024 / 1024;
      }
    } catch {
      // If disk check fails, show a warning but allow proceeding
      return {
        name: "Disk Space",
        description: `${MIN_DISK_GB} GB free space required`,
        result: "warn",
        message: "Could not determine free disk space.",
        autoFixAvailable: false,
      };
    }

    const freeRounded = Math.round(freeGB * 10) / 10;
    const pass = freeGB >= MIN_DISK_GB;

    return {
      name: "Disk Space",
      description: `${MIN_DISK_GB} GB free space required`,
      result: pass ? "pass" : "warn",
      message: pass
        ? `${freeRounded} GB free ✓`
        : `Only ${freeRounded} GB free — clear space for reliable operation`,
      autoFixAvailable: false,
    };
  }

  private async checkPort(port: number, label: string): Promise<SystemCheck> {
    const available = await this.isPortAvailable(port);
    return {
      name: `${label} (${port})`,
      description: `Port ${port} must be available`,
      result: available ? "pass" : "warn",
      message: available
        ? `Port ${port} is available ✓`
        : `Port ${port} is in use. Another service may conflict.`,
      autoFixAvailable: false,
    };
  }

  private isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = createServer();
      server.once("error", () => resolve(false));
      server.once("listening", () => {
        server.close(() => resolve(true));
      });
      server.listen(port, "127.0.0.1");
    });
  }
}
