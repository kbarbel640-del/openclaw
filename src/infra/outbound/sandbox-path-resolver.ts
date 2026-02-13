import path from "node:path";
import type { SandboxWorkspaceInfo } from "../../agents/sandbox/types.js";
import type { OpenClawConfig } from "../../config/config.js";
import { ensureSandboxWorkspaceForSession } from "../../agents/sandbox/context.js";

/**
 * Generic sandbox path resolver
 *
 * Converts container paths (/workspace/file.txt) to host paths
 * (/opt/openclaw/sandboxes/agent-xxx/file.txt)
 *
 * @param filePath - Original file path (container path or host path)
 * @param sandboxWorkspace - Sandbox workspace info (null means non-sandbox environment)
 * @returns Resolved host path
 */
export function resolveSandboxFilePath(
  filePath: string,
  sandboxWorkspace: SandboxWorkspaceInfo | null,
): string {
  // Non-sandbox environment, return directly
  if (!sandboxWorkspace) {
    return filePath;
  }

  // If path starts with container workdir, convert to host path
  if (filePath.startsWith(sandboxWorkspace.containerWorkdir)) {
    const relativePath = filePath.slice(sandboxWorkspace.containerWorkdir.length);
    return path.join(sandboxWorkspace.workspaceDir, relativePath);
  }

  // Otherwise return original path (may already be host path)
  return filePath;
}

/**
 * Sandbox context cache
 * Key: sessionKey
 * Value: SandboxWorkspaceInfo | null
 */
const sandboxContextCache = new Map<string, SandboxWorkspaceInfo | null>();

/**
 * Cache TTL (5 minutes)
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Get sandbox context for session (with caching)
 *
 * @param params - Configuration and session key
 * @returns Sandbox workspace info (null means non-sandbox environment)
 */
export async function getSandboxContextForSession(params: {
  cfg: OpenClawConfig;
  sessionKey?: string;
}): Promise<SandboxWorkspaceInfo | null> {
  if (!params.sessionKey) {
    return null;
  }

  // Try to get from cache
  const cached = sandboxContextCache.get(params.sessionKey);
  if (cached !== undefined) {
    return cached;
  }

  // Get sandbox context
  const context = await ensureSandboxWorkspaceForSession({
    config: params.cfg,
    sessionKey: params.sessionKey,
  });

  // Cache result
  sandboxContextCache.set(params.sessionKey, context);

  // Set expiration cleanup
  setTimeout(() => {
    sandboxContextCache.delete(params.sessionKey!);
  }, CACHE_TTL_MS);

  return context;
}

/**
 * Batch convert file paths in parameters
 *
 * @param params - Original parameters object
 * @param sandboxWorkspace - Sandbox workspace info
 * @param fileKeys - List of parameter names to convert
 * @returns Converted parameters object
 */
export function resolveFilePathsInParams(
  params: Record<string, unknown>,
  sandboxWorkspace: SandboxWorkspaceInfo | null,
  fileKeys: string[] = ["filePath", "path", "media"],
): Record<string, unknown> {
  if (!sandboxWorkspace) {
    return params;
  }

  const resolved = { ...params };

  for (const key of fileKeys) {
    const value = resolved[key];
    if (typeof value === "string" && value.startsWith("/")) {
      resolved[key] = resolveSandboxFilePath(value, sandboxWorkspace);
    }
  }

  return resolved;
}

/**
 * Clear sandbox context cache (for testing or manual cleanup)
 */
export function clearSandboxContextCache(): void {
  sandboxContextCache.clear();
}
