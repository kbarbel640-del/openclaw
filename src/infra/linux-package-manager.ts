import os from "node:os";
import { hasBinary } from "../agents/skills/config.js";

export type LinuxPackageManager = "apt-get" | "apk" | "dnf" | "yum" | "pacman";

/**
 * Detect the available Linux package manager on this system.
 * Returns `undefined` on non-Linux platforms or when no supported
 * package manager is found.
 */
export function detectLinuxPackageManager(opts?: {
  platform?: string;
  checkBinary?: (bin: string) => boolean;
}): LinuxPackageManager | undefined {
  const platform = opts?.platform ?? os.platform();
  const checkBin = opts?.checkBinary ?? hasBinary;

  if (platform !== "linux") {
    return undefined;
  }

  // Ordered by popularity in Docker images.
  const managers: LinuxPackageManager[] = ["apt-get", "apk", "dnf", "yum", "pacman"];
  for (const mgr of managers) {
    if (checkBin(mgr)) {
      return mgr;
    }
  }
  return undefined;
}

/**
 * Build the install command for a given Linux package manager.
 * Returns `null` when the manager is not supported.
 */
export function buildLinuxInstallCommand(
  manager: LinuxPackageManager,
  packageName: string,
): string[] | null {
  switch (manager) {
    case "apt-get":
      return ["apt-get", "install", "-y", packageName];
    case "apk":
      return ["apk", "add", "--no-cache", packageName];
    case "dnf":
      return ["dnf", "install", "-y", packageName];
    case "yum":
      return ["yum", "install", "-y", packageName];
    case "pacman":
      return ["pacman", "-S", "--noconfirm", packageName];
    default:
      return null;
  }
}

/**
 * Determine the Linux package name for a brew formula.
 *
 * Rules:
 * 1. If the install spec provides an explicit `apt` or `apk` field, use it.
 * 2. If the formula is a simple name (no `/`), assume the same package name
 *    works on Linux — this is true for common tools like `ffmpeg`, `jq`, etc.
 * 3. Tap formulas (containing `/`) have no automatic Linux equivalent.
 *    Return `undefined` so the caller can show a helpful message.
 */
export function resolveLinuxPackageName(
  manager: LinuxPackageManager,
  formula: string,
  spec?: { apt?: string; apk?: string },
): string | undefined {
  // Explicit overrides take priority.
  if (manager === "apk" && spec?.apk?.trim()) {
    return spec.apk.trim();
  }
  // apt-get, dnf, yum, and pacman share similar package names in most cases.
  if (spec?.apt?.trim()) {
    return spec.apt.trim();
  }

  // Tap formulas (e.g. "steipete/tap/summarize") have no automatic mapping.
  if (formula.includes("/")) {
    return undefined;
  }

  // Simple formulas generally share the name across brew and apt/apk.
  return formula;
}
