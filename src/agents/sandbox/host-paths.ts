import { existsSync, realpathSync } from "node:fs";
import path from "node:path";

type HostPathStyle = "posix" | "win32" | "other";

/**
 * Normalize an absolute host path while preserving the native root semantics.
 */
export function normalizeSandboxHostPath(raw: string): string {
  const trimmed = raw.trim();
  const style = detectHostPathStyle(trimmed);
  if (style === "posix") {
    return path.posix.normalize(trimmed).replace(/\/+$/, "") || "/";
  }
  if (style === "win32") {
    return normalizeWindowsHostPath(trimmed);
  }
  return trimmed;
}

/**
 * Resolve a path through the deepest existing ancestor so parent symlinks are honored
 * even when the final source leaf does not exist yet.
 */
export function resolveSandboxHostPathViaExistingAncestor(sourcePath: string): string {
  const style = detectHostPathStyle(sourcePath);
  if (style === "other") {
    return sourcePath;
  }

  const normalized = normalizeSandboxHostPath(sourcePath);
  let current = normalized;
  const missingSegments: string[] = [];
  const root = getPathRoot(current, style);

  while (current !== root && !existsSync(current)) {
    missingSegments.unshift(getPathBasename(current, style));
    const parent = getPathDirname(current, style);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  if (!existsSync(current)) {
    return normalized;
  }

  try {
    const resolvedAncestor = normalizeSandboxHostPath(realpathSync.native(current));
    if (missingSegments.length === 0) {
      return resolvedAncestor;
    }
    return normalizeSandboxHostPath(joinPathSegments(resolvedAncestor, missingSegments, style));
  } catch {
    return normalized;
  }
}

function detectHostPathStyle(value: string): HostPathStyle {
  if (value.startsWith("/")) {
    return "posix";
  }
  if (path.win32.isAbsolute(value)) {
    return "win32";
  }
  return "other";
}

function normalizeWindowsHostPath(raw: string): string {
  const normalized = path.win32.normalize(raw);
  const root = path.win32.parse(normalized).root;
  if (!root) {
    return normalized.replace(/[\\/]+$/, "");
  }
  if (normalized === root) {
    return root;
  }
  return normalized.replace(/[\\/]+$/, "");
}

function getPathRoot(value: string, style: Exclude<HostPathStyle, "other">): string {
  if (style === "posix") {
    return path.posix.parse(value).root || "/";
  }
  return path.win32.parse(value).root || value;
}

function getPathDirname(value: string, style: Exclude<HostPathStyle, "other">): string {
  if (style === "posix") {
    return path.posix.dirname(value);
  }
  return path.win32.dirname(value);
}

function getPathBasename(value: string, style: Exclude<HostPathStyle, "other">): string {
  if (style === "posix") {
    return path.posix.basename(value);
  }
  return path.win32.basename(value);
}

function joinPathSegments(
  base: string,
  segments: string[],
  style: Exclude<HostPathStyle, "other">,
): string {
  if (style === "posix") {
    return path.posix.join(base, ...segments);
  }
  return path.win32.join(base, ...segments);
}
