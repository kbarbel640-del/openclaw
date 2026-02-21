import fs from "node:fs";
import path from "node:path";
import { SafeOpenError, openFileWithinRoot } from "../infra/fs-safe.js";
import { resolvePreferredOpenClawTmpDir } from "../infra/tmp-openclaw-dir.js";

export const DEFAULT_BROWSER_TMP_DIR = resolvePreferredOpenClawTmpDir();
export const DEFAULT_TRACE_DIR = DEFAULT_BROWSER_TMP_DIR;
export const DEFAULT_DOWNLOAD_DIR = path.join(DEFAULT_BROWSER_TMP_DIR, "downloads");
export const DEFAULT_UPLOAD_DIR = path.join(DEFAULT_BROWSER_TMP_DIR, "uploads");

export function resolvePathWithinRoot(params: {
  rootDir: string;
  requestedPath: string;
  scopeLabel: string;
  defaultFileName?: string;
}): { ok: true; path: string } | { ok: false; error: string } {
  const root = path.resolve(params.rootDir);
  // Resolve symlinks in root to handle systems where /tmp is a symlink
  // (e.g. macOS: /tmp -> /private/tmp)
  let rootReal = root;
  try {
    rootReal = fs.realpathSync(root);
  } catch {
    // keep unresolved if dir doesn't exist yet
  }

  const raw = params.requestedPath.trim();
  if (!raw) {
    if (!params.defaultFileName) {
      return { ok: false, error: "path is required" };
    }
    return { ok: true, path: path.join(rootReal, params.defaultFileName) };
  }
  const resolved = path.resolve(rootReal, raw);

  // Also resolve symlinks in the target path
  let resolvedReal = resolved;
  try {
    resolvedReal = fs.realpathSync(resolved);
  } catch {
    // File might not exist yet; resolve relative to real root
    const relFromRoot = path.relative(root, path.resolve(root, raw));
    resolvedReal = path.resolve(rootReal, relFromRoot);
  }

  const rel = path.relative(rootReal, resolvedReal);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
    return { ok: false, error: `Invalid path: must stay within ${params.scopeLabel}` };
  }
  return { ok: true, path: resolvedReal };
}

export function resolvePathsWithinRoot(params: {
  rootDir: string;
  requestedPaths: string[];
  scopeLabel: string;
}): { ok: true; paths: string[] } | { ok: false; error: string } {
  const resolvedPaths: string[] = [];
  for (const raw of params.requestedPaths) {
    const pathResult = resolvePathWithinRoot({
      rootDir: params.rootDir,
      requestedPath: raw,
      scopeLabel: params.scopeLabel,
    });
    if (!pathResult.ok) {
      return { ok: false, error: pathResult.error };
    }
    resolvedPaths.push(pathResult.path);
  }
  return { ok: true, paths: resolvedPaths };
}

export async function resolveExistingPathsWithinRoot(params: {
  rootDir: string;
  requestedPaths: string[];
  scopeLabel: string;
}): Promise<{ ok: true; paths: string[] } | { ok: false; error: string }> {
  const resolvedPaths: string[] = [];
  for (const raw of params.requestedPaths) {
    const pathResult = resolvePathWithinRoot({
      rootDir: params.rootDir,
      requestedPath: raw,
      scopeLabel: params.scopeLabel,
    });
    if (!pathResult.ok) {
      return { ok: false, error: pathResult.error };
    }

    let rootDir = path.resolve(params.rootDir);
    try {
      rootDir = fs.realpathSync(rootDir);
    } catch {
      // keep unresolved if dir doesn't exist yet
    }
    const relativePath = path.relative(rootDir, pathResult.path);
    let opened: Awaited<ReturnType<typeof openFileWithinRoot>> | undefined;
    try {
      opened = await openFileWithinRoot({
        rootDir,
        relativePath,
      });
      resolvedPaths.push(opened.realPath);
    } catch (err) {
      if (err instanceof SafeOpenError && err.code === "not-found") {
        // Preserve historical behavior for paths that do not exist yet.
        resolvedPaths.push(pathResult.path);
        continue;
      }
      return {
        ok: false,
        error: `Invalid path: must stay within ${params.scopeLabel} and be a regular non-symlink file`,
      };
    } finally {
      await opened?.handle.close().catch(() => {});
    }
  }
  return { ok: true, paths: resolvedPaths };
}
