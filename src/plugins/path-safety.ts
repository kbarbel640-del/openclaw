import fs from "node:fs";
import path from "node:path";

function normalizeForPathComparison(inputPath: string): string {
  const resolved = path.resolve(inputPath);
  if (process.platform !== "win32") {
    return resolved;
  }
  // Windows realpath may mix verbatim-path prefixes (\\?\) and drive-letter casing.
  // Normalize both before running containment checks to avoid false negatives.
  const withoutVerbatim = resolved.startsWith("\\\\?\\") ? resolved.slice(4) : resolved;
  return withoutVerbatim.toLowerCase();
}

export function isPathInside(baseDir: string, targetPath: string): boolean {
  const normalizedBase = normalizeForPathComparison(baseDir);
  const normalizedTarget = normalizeForPathComparison(targetPath);
  const rel = path.relative(normalizedBase, normalizedTarget);
  if (!rel) {
    return true;
  }
  return !rel.startsWith("..") && !path.isAbsolute(rel);
}

export function safeRealpathSync(targetPath: string, cache?: Map<string, string>): string | null {
  const cached = cache?.get(targetPath);
  if (cached) {
    return cached;
  }
  try {
    const resolved = fs.realpathSync(targetPath);
    cache?.set(targetPath, resolved);
    return resolved;
  } catch {
    return null;
  }
}

export function safeStatSync(targetPath: string): fs.Stats | null {
  try {
    return fs.statSync(targetPath);
  } catch {
    return null;
  }
}

export function formatPosixMode(mode: number): string {
  return (mode & 0o777).toString(8).padStart(3, "0");
}
