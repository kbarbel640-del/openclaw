import fs from "node:fs";
import path from "node:path";

export function isPathInside(baseDir: string, targetPath: string): boolean {
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(targetPath);

  if (process.platform === "win32") {
    // Windows paths are case-insensitive and may have different normalizations
    // (e.g., short names vs long names, different drive letter casing)
    const relative = path.relative(resolvedBase.toLowerCase(), resolvedTarget.toLowerCase());
    return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
  }

  const relative = path.relative(resolvedBase, resolvedTarget);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
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
