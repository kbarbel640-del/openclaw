import fs from "node:fs";
import path from "node:path";

function canonicalizeWin32PathForCompare(p: string): string {
  // Accept mixed separators and Windows extended-length paths.
  let resolved = path.win32.resolve(p.replaceAll("/", "\\"));

  // Strip the extended-length prefix (\\?\) to make comparisons stable.
  // Note: \\?\UNC\server\share\... should compare as \\server\share\...
  if (resolved.startsWith("\\\\?\\UNC\\")) {
    resolved = `\\\\${resolved.slice("\\\\?\\UNC\\".length)}`;
  } else if (resolved.startsWith("\\\\?\\")) {
    resolved = resolved.slice("\\\\?\\".length);
  }

  // Windows paths are case-insensitive in typical environments.
  return resolved.toLowerCase();
}

export function isPathInside(basePath: string, candidatePath: string): boolean {
  // On Windows, path.relative/path.isAbsolute are case-sensitive string operations.
  // Canonicalize before comparing to avoid false negatives (drive letter casing,
  // extended-length prefix, mixed separators).
  if (process.platform === "win32") {
    const base = canonicalizeWin32PathForCompare(basePath);
    const candidate = canonicalizeWin32PathForCompare(candidatePath);
    const rel = path.win32.relative(base, candidate);
    return (
      rel === "" ||
      (!rel.startsWith(`..${path.win32.sep}`) && rel !== ".." && !path.win32.isAbsolute(rel))
    );
  }

  const base = path.resolve(basePath);
  const candidate = path.resolve(candidatePath);
  const rel = path.relative(base, candidate);
  return rel === "" || (!rel.startsWith(`..${path.sep}`) && rel !== ".." && !path.isAbsolute(rel));
}

function safeRealpathSync(filePath: string): string | null {
  try {
    return fs.realpathSync(filePath);
  } catch {
    return null;
  }
}

export function isPathInsideWithRealpath(
  basePath: string,
  candidatePath: string,
  opts?: { requireRealpath?: boolean },
): boolean {
  if (!isPathInside(basePath, candidatePath)) {
    return false;
  }
  const baseReal = safeRealpathSync(basePath);
  const candidateReal = safeRealpathSync(candidatePath);
  if (!baseReal || !candidateReal) {
    return opts?.requireRealpath !== true;
  }
  return isPathInside(baseReal, candidateReal);
}

export function extensionUsesSkippedScannerPath(entry: string): boolean {
  const segments = entry.split(/[\\/]+/).filter(Boolean);
  return segments.some(
    (segment) =>
      segment === "node_modules" ||
      (segment.startsWith(".") && segment !== "." && segment !== ".."),
  );
}
