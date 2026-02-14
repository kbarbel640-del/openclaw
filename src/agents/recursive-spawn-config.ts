import type { OpenClawConfig } from "../config/config.js";
import { resolveAgentConfig } from "./agent-scope.js";

const DEFAULT_MAX_DEPTH = 3;

export function resolveAllowRecursiveSpawn(cfg: OpenClawConfig, agentId: string): boolean {
  const agentConfig = resolveAgentConfig(cfg, agentId);
  const perAgent = agentConfig?.subagents?.allowRecursiveSpawn;
  if (typeof perAgent === "boolean") {
    return perAgent;
  }
  const global = cfg.agents?.defaults?.subagents?.allowRecursiveSpawn;
  if (typeof global === "boolean") {
    return global;
  }
  return false;
}

export function resolveMaxSpawnDepth(cfg: OpenClawConfig, agentId: string): number {
  const agentConfig = resolveAgentConfig(cfg, agentId);
  const perAgent = agentConfig?.subagents?.maxDepth;
  if (typeof perAgent === "number" && Number.isFinite(perAgent)) {
    return Math.max(1, Math.min(10, Math.floor(perAgent)));
  }
  const global = cfg.agents?.defaults?.subagents?.maxDepth;
  if (typeof global === "number" && Number.isFinite(global)) {
    return Math.max(1, Math.min(10, Math.floor(global)));
  }
  return DEFAULT_MAX_DEPTH;
}
