/**
 * Browser-safe path display utilities.
 *
 * These functions provide path shortening without Node.js dependencies.
 * For full functionality (actual home directory resolution), use src/utils.ts.
 */

/**
 * Shorten home directory in a string for display.
 * Browser-safe version: shortens common patterns but doesn't resolve actual home.
 */
export function shortenHomeInString(input: string, homeDir?: string): string {
  if (!input) {
    return input;
  }
  // If caller provides home dir, use it
  if (homeDir) {
    return input.split(homeDir).join("~");
  }
  // Browser fallback: try common patterns
  // Match /home/<user>/ or /Users/<user>/ patterns
  return input.replace(/\/home\/([^/]+)\//g, "~/").replace(/\/Users\/([^/]+)\//g, "~/");
}

/**
 * Shorten a path for display.
 * Browser-safe version with pattern matching.
 */
export function shortenHomePath(input: string, homeDir?: string): string {
  if (!input) {
    return input;
  }
  if (homeDir) {
    if (input === homeDir) {
      return "~";
    }
    if (input.startsWith(`${homeDir}/`) || input.startsWith(`${homeDir}\\`)) {
      return `~${input.slice(homeDir.length)}`;
    }
    return input;
  }
  // Browser fallback: pattern matching
  const homeMatch = input.match(/^(\/home\/[^/]+|\/Users\/[^/]+)/);
  if (homeMatch) {
    const matched = homeMatch[1];
    if (input === matched) {
      return "~";
    }
    return `~${input.slice(matched.length)}`;
  }
  return input;
}
