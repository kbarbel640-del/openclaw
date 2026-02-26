/**
 * Docker path conversion utilities.
 *
 * When running OpenClaw inside a Docker container with volume mounts,
 * paths in systemPromptReport need to be converted from container paths
 * to host-accessible paths for external tools.
 *
 * @module infra/docker-paths
 */

import type { OpenClawSchema } from "../config/zod-schema.js";

/**
 * Resolve the host state directory from config or environment.
 *
 * Priority:
 * 1. config.docker.hostStateDir
 * 2. OPENCLAW_HOST_STATE_DIR environment variable
 *
 * @param config - OpenClaw configuration object
 * @returns The host state directory path, or undefined if not configured
 */
export function resolveHostStateDir(config?: {
  docker?: { hostStateDir?: string };
}): string | undefined {
  // Check config first
  const configValue = config?.docker?.hostStateDir?.trim();
  if (configValue) {
    return configValue;
  }

  // Fall back to environment variable
  const envValue = process.env.OPENCLAW_HOST_STATE_DIR?.trim();
  if (envValue) {
    return envValue;
  }

  return undefined;
}

/**
 * Get the container state directory.
 *
 * @returns The container state directory path
 */
export function getContainerStateDir(): string {
  return process.env.OPENCLAW_STATE_DIR?.trim() || "/root/.openclaw";
}

/**
 * Convert a container path to a host path.
 *
 * If hostStateDir is not set, returns the original path unchanged.
 * If the path doesn't start with the container state dir, returns unchanged.
 *
 * Handles Windows path separators: if hostStateDir contains backslashes,
 * forward slashes in the result are converted to backslashes.
 *
 * @param containerPath - The path inside the container
 * @param hostStateDir - The host state directory (from resolveHostStateDir)
 * @returns The host-accessible path
 */
export function toHostPath(
  containerPath: string | undefined,
  hostStateDir: string | undefined,
): string | undefined {
  // Return undefined if no path
  if (!containerPath) {
    return undefined;
  }

  // Return original if no host mapping configured
  if (!hostStateDir) {
    return containerPath;
  }

  const containerBase = getContainerStateDir();

  // Check if path starts with container state dir
  if (!containerPath.startsWith(containerBase)) {
    return containerPath;
  }

  // Replace container path prefix with host path
  let hostPath = containerPath.replace(containerBase, hostStateDir);

  // Normalize path separators for Windows hosts
  // If hostStateDir uses backslashes, convert forward slashes to backslashes
  if (hostStateDir.includes("\\")) {
    hostPath = hostPath.replace(/\//g, "\\");
  }

  return hostPath;
}

/**
 * Batch convert paths in an object.
 *
 * Useful for converting multiple paths in systemPromptReport.
 *
 * @param paths - Array of paths to convert
 * @param hostStateDir - The host state directory
 * @returns Array of converted paths
 */
export function toHostPaths(
  paths: (string | undefined)[],
  hostStateDir: string | undefined,
): (string | undefined)[] {
  return paths.map((p) => toHostPath(p, hostStateDir));
}
