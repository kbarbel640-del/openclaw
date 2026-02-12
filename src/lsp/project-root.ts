/**
 * Project root detection by walking up from a file path to find config files.
 *
 * Used to determine the LSP workspace root for a given file. Each language
 * has its own set of config files that indicate the project root.
 */

import fs from "node:fs/promises";
import path from "node:path";

/**
 * Walk up from a file path searching for any of the given config files.
 * Stops at the filesystem root or an optional boundary path.
 *
 * @param filePath - The file path to start searching from
 * @param configFiles - Array of config file names to look for
 * @param boundary - Optional boundary path (won't search above this)
 * @returns The project root directory, or undefined if not found
 */
export async function findProjectRoot(
  filePath: string,
  configFiles: string[],
  boundary?: string,
): Promise<string | undefined> {
  const resolvedPath = path.resolve(filePath);
  const resolvedBoundary = boundary ? path.resolve(boundary) : undefined;
  let current = path.dirname(resolvedPath);

  // Safety: limit depth to avoid infinite loops on unusual filesystem setups
  const MAX_DEPTH = 50;
  let depth = 0;

  while (depth < MAX_DEPTH) {
    // Check if any config file exists in the current directory
    for (const configFile of configFiles) {
      const candidate = path.join(current, configFile);
      try {
        await fs.access(candidate);
        return current;
      } catch {
        // File doesn't exist, continue
      }
    }

    // Check boundary
    if (resolvedBoundary && current === resolvedBoundary) {
      break;
    }

    // Move up one directory
    const parent = path.dirname(current);
    if (parent === current) {
      // Reached filesystem root
      break;
    }
    current = parent;
    depth += 1;
  }

  return undefined;
}

/**
 * Build a unique key for an LSP instance based on the project root and server command.
 * This allows multiple LSP servers to coexist for different languages in the same project root.
 */
export function buildLspInstanceKey(projectRoot: string, serverCommand: string): string {
  return `${path.resolve(projectRoot)}::${serverCommand}`;
}
