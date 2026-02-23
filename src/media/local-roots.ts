import os from "node:os";
import path from "node:path";
import { resolveAgentWorkspaceDir } from "../agents/agent-scope.js";
import type { OpenClawConfig } from "../config/config.js";
import { resolveStateDir } from "../config/paths.js";

function buildMediaLocalRoots(stateDir: string): string[] {
  const resolvedStateDir = path.resolve(stateDir);
  return [
    os.tmpdir(),
    process.cwd(),
    path.join(resolvedStateDir, "media"),
    path.join(resolvedStateDir, "agents"),
    path.join(resolvedStateDir, "workspace"),
    path.join(resolvedStateDir, "sandboxes"),
  ];
}

export function getDefaultMediaLocalRoots(): readonly string[] {
  const roots = buildMediaLocalRoots(resolveStateDir());
  // Also allow the configured agent workspace directory (agents.defaults.workspace)
  // since agents may save screenshots and other media files there.
  try {
    const { loadConfig } = require("../config/config.js") as typeof import("../config/config.js");
    const cfg = loadConfig();
    const workspace = cfg.agents?.defaults?.workspace;
    if (workspace) {
      const resolved = path.resolve(workspace);
      if (!roots.includes(resolved)) {
        roots.push(resolved);
      }
    }
  } catch {
    // Config may not be available yet; skip.
  }
  return roots;
}

export function getAgentScopedMediaLocalRoots(
  cfg: OpenClawConfig,
  agentId?: string,
): readonly string[] {
  const roots = buildMediaLocalRoots(resolveStateDir());
  if (!agentId?.trim()) {
    return roots;
  }
  const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
  if (!workspaceDir) {
    return roots;
  }
  const normalizedWorkspaceDir = path.resolve(workspaceDir);
  if (!roots.includes(normalizedWorkspaceDir)) {
    roots.push(normalizedWorkspaceDir);
  }
  return roots;
}
