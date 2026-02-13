import path from "node:path";

function normalizeRelative(value: string): string {
  const unix = value.replaceAll("\\", "/");
  return path.posix.normalize(unix).replace(/^\.\//, "");
}

function isPathInside(root: string, target: string): boolean {
  const rel = path.relative(root, target);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function normalizeMasked(maskedPaths?: string[]): string[] {
  return (maskedPaths ?? [])
    .map((entry) => normalizeRelative(entry.trim()))
    .filter((entry) => entry.length > 0);
}

function isMaskedPath(relPath: string, maskedPaths?: string[]): boolean {
  const normalized = normalizeRelative(relPath);
  return normalizeMasked(maskedPaths).some(
    (mask) => normalized === mask || normalized.startsWith(`${mask}/`),
  );
}

export function translateSandboxPath(params: {
  sandboxPath: string;
  sandboxAgentRoot?: string;
  sandboxRoots?: string[];
  workspaceRoot: string;
}): string {
  const sandboxPath = params.sandboxPath.trim();
  if (!sandboxPath) {
    return params.workspaceRoot;
  }

  const normalizedWorkspaceRoot = path.resolve(params.workspaceRoot);
  const resolved = path.resolve(sandboxPath);
  const candidateRoots = (
    params.sandboxRoots?.length ? params.sandboxRoots : [params.sandboxAgentRoot ?? "/workspace"]
  )
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => path.resolve(entry));

  for (const normalizedSandboxRoot of candidateRoots) {
    if (!isPathInside(normalizedSandboxRoot, resolved)) {
      continue;
    }

    const rel = path.relative(normalizedSandboxRoot, resolved);
    const translated = path.resolve(normalizedWorkspaceRoot, rel);
    if (!isPathInside(normalizedWorkspaceRoot, translated)) {
      throw new Error(`translated path escaped workspace: ${sandboxPath}`);
    }
    return translated;
  }

  throw new Error(`sandbox path outside allowed roots: ${sandboxPath}`);
}

export function validateCwd(params: {
  sandboxCwd: string;
  sandboxAgentRoot?: string;
  sandboxRoots?: string[];
  workspaceRoot: string;
  maskedPaths?: string[];
}): { hostCwd: string; relPath: string } {
  const hostCwd = translateSandboxPath({
    sandboxPath: params.sandboxCwd,
    sandboxAgentRoot: params.sandboxAgentRoot,
    sandboxRoots: params.sandboxRoots,
    workspaceRoot: params.workspaceRoot,
  });
  const relPath = normalizeRelative(path.relative(path.resolve(params.workspaceRoot), hostCwd));
  if (isMaskedPath(relPath, params.maskedPaths)) {
    throw new Error(`cwd falls under masked path: ${relPath}`);
  }
  return { hostCwd, relPath };
}

export function looksLikePathArg(arg: string): boolean {
  const trimmed = arg.trim();
  if (!trimmed) {
    return false;
  }
  if (trimmed === "~" || trimmed.startsWith("~/")) {
    return true;
  }
  return trimmed.includes("/") || trimmed.startsWith(".");
}

/** Extract path-like candidates from a single CLI argument, including values after = in flags. */
function extractPathCandidates(arg: string): string[] {
  const trimmed = arg.trim();
  const candidates: string[] = [];
  // For --flag=value, check the value portion independently
  if (trimmed.startsWith("-") && trimmed.includes("=")) {
    const eqIndex = trimmed.indexOf("=");
    const value = trimmed.slice(eqIndex + 1);
    if (value && looksLikePathArg(value)) {
      candidates.push(value);
    }
  }
  // Also check the entire arg as before
  if (looksLikePathArg(trimmed)) {
    candidates.push(trimmed);
  }
  return candidates;
}

export function validatePathLikeArgs(params: {
  args: string[];
  hostCwd: string;
  workspaceRoot: string;
  maskedPaths?: string[];
}) {
  const root = path.resolve(params.workspaceRoot);
  const masked = normalizeMasked(params.maskedPaths);

  for (const arg of params.args) {
    const candidates = extractPathCandidates(arg);
    for (const candidate of candidates) {
      // Reject ~/ arguments: path.resolve does NOT expand ~ but spawned CLIs
      // (bash, python, etc.) will expand it to the host user's home directory,
      // bypassing workspace containment.
      if (candidate.trim().startsWith("~/") || candidate.trim() === "~") {
        throw new Error(`tilde paths are not allowed: ${arg}`);
      }
      const resolved = path.resolve(params.hostCwd, candidate);
      if (!isPathInside(root, resolved)) {
        throw new Error(`path arg escapes workspace: ${arg}`);
      }
      const rel = normalizeRelative(path.relative(root, resolved));
      if (isMaskedPath(rel, masked)) {
        throw new Error(`path arg targets masked directory: ${arg}`);
      }
    }
  }
}

export const __testing = {
  normalizeRelative,
  isMaskedPath,
  isPathInside,
};
