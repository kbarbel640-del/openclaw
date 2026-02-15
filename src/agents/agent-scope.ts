import os from "node:os";
import path from "node:path";
import type { OpenClawConfig } from "../config/config.js";
import type { AgentRole } from "../config/types.agents.js";
import { resolveStateDir } from "../config/paths.js";
import {
  DEFAULT_AGENT_ID,
  normalizeAgentId,
  parseAgentSessionKey,
} from "../routing/session-key.js";
import { resolveUserPath } from "../utils.js";
import { findAgentDefinition } from "./definitions/resolver.js";
import { DEFAULT_AGENT_WORKSPACE_DIR } from "./workspace.js";

export { resolveAgentIdFromSessionKey } from "../routing/session-key.js";

type AgentEntry = NonNullable<NonNullable<OpenClawConfig["agents"]>["list"]>[number];

type ResolvedAgentConfig = {
  name?: string;
  role?: AgentRole;
  workspace?: string;
  agentDir?: string;
  model?: AgentEntry["model"];
  modelByComplexity?: AgentEntry["modelByComplexity"];
  skills?: AgentEntry["skills"];
  capabilities?: string[];
  expertise?: string[];
  persona?: string;
  memorySearch?: AgentEntry["memorySearch"];
  humanDelay?: AgentEntry["humanDelay"];
  heartbeat?: AgentEntry["heartbeat"];
  identity?: AgentEntry["identity"];
  groupChat?: AgentEntry["groupChat"];
  subagents?: AgentEntry["subagents"];
  sandbox?: AgentEntry["sandbox"];
  tools?: AgentEntry["tools"];
};

let defaultAgentWarned = false;

function listAgents(cfg: OpenClawConfig): AgentEntry[] {
  const list = cfg.agents?.list;
  if (!Array.isArray(list)) {
    return [];
  }
  return list.filter((entry): entry is AgentEntry => Boolean(entry && typeof entry === "object"));
}

export function listAgentIds(cfg: OpenClawConfig): string[] {
  const agents = listAgents(cfg);
  if (agents.length === 0) {
    return [DEFAULT_AGENT_ID];
  }
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const entry of agents) {
    const id = normalizeAgentId(entry?.id);
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    ids.push(id);
  }
  return ids.length > 0 ? ids : [DEFAULT_AGENT_ID];
}

export function resolveDefaultAgentId(cfg: OpenClawConfig): string {
  const agents = listAgents(cfg);
  if (agents.length === 0) {
    return DEFAULT_AGENT_ID;
  }
  const defaults = agents.filter((agent) => agent?.default);
  if (defaults.length > 1 && !defaultAgentWarned) {
    defaultAgentWarned = true;
    console.warn("Multiple agents marked default=true; using the first entry as default.");
  }
  const chosen = (defaults[0] ?? agents[0])?.id?.trim();
  return normalizeAgentId(chosen || DEFAULT_AGENT_ID);
}

export function resolveSessionAgentIds(params: { sessionKey?: string; config?: OpenClawConfig }): {
  defaultAgentId: string;
  sessionAgentId: string;
} {
  const defaultAgentId = resolveDefaultAgentId(params.config ?? {});
  const sessionKey = params.sessionKey?.trim();
  const normalizedSessionKey = sessionKey ? sessionKey.toLowerCase() : undefined;
  const parsed = normalizedSessionKey ? parseAgentSessionKey(normalizedSessionKey) : null;
  const sessionAgentId = parsed?.agentId ? normalizeAgentId(parsed.agentId) : defaultAgentId;
  return { defaultAgentId, sessionAgentId };
}

export function resolveSessionAgentId(params: {
  sessionKey?: string;
  config?: OpenClawConfig;
}): string {
  return resolveSessionAgentIds(params).sessionAgentId;
}

function resolveAgentEntry(cfg: OpenClawConfig, agentId: string): AgentEntry | undefined {
  const id = normalizeAgentId(agentId);
  return listAgents(cfg).find((entry) => normalizeAgentId(entry.id) === id);
}

export function resolveAgentConfig(
  cfg: OpenClawConfig,
  agentId: string,
): ResolvedAgentConfig | undefined {
  const id = normalizeAgentId(agentId);
  const entry = resolveAgentEntry(cfg, id);
  if (!entry) {
    // Fallback: check markdown agent definitions
    const definition = findAgentDefinition(cfg, id, id);
    if (definition) {
      return {
        name: definition.name,
        role: definition.role,
        capabilities: definition.capabilities,
        expertise: definition.expertise,
        skills: definition.skills,
        persona: definition.systemPrompt,
      };
    }
    return undefined;
  }
  return {
    name: typeof entry.name === "string" ? entry.name : undefined,
    role: entry.role,
    workspace: typeof entry.workspace === "string" ? entry.workspace : undefined,
    agentDir: typeof entry.agentDir === "string" ? entry.agentDir : undefined,
    model:
      typeof entry.model === "string" || (entry.model && typeof entry.model === "object")
        ? entry.model
        : undefined,
    modelByComplexity:
      typeof entry.modelByComplexity === "object" && entry.modelByComplexity
        ? entry.modelByComplexity
        : undefined,
    skills: Array.isArray(entry.skills) ? entry.skills : undefined,
    capabilities: Array.isArray(entry.capabilities) ? entry.capabilities : undefined,
    expertise: Array.isArray(entry.expertise) ? entry.expertise : undefined,
    persona: typeof entry.persona === "string" ? entry.persona : undefined,
    memorySearch: entry.memorySearch,
    humanDelay: entry.humanDelay,
    heartbeat: entry.heartbeat,
    identity: entry.identity,
    groupChat: entry.groupChat,
    subagents: typeof entry.subagents === "object" && entry.subagents ? entry.subagents : undefined,
    sandbox: entry.sandbox,
    tools: entry.tools,
  };
}

export function resolveAgentSkillsFilter(
  cfg: OpenClawConfig,
  agentId: string,
): string[] | undefined {
  const raw = resolveAgentConfig(cfg, agentId)?.skills;
  if (!raw) {
    return undefined;
  }
  const normalized = raw.map((entry) => String(entry).trim()).filter(Boolean);
  return normalized.length > 0 ? normalized : [];
}

export function resolveAgentModelPrimary(cfg: OpenClawConfig, agentId: string): string | undefined {
  const raw = resolveAgentConfig(cfg, agentId)?.model;
  if (!raw) {
    return undefined;
  }
  if (typeof raw === "string") {
    return raw.trim() || undefined;
  }
  const primary = raw.primary?.trim();
  return primary || undefined;
}

export function resolveAgentModelFallbacksOverride(
  cfg: OpenClawConfig,
  agentId: string,
): string[] | undefined {
  const raw = resolveAgentConfig(cfg, agentId)?.model;
  if (!raw || typeof raw === "string") {
    return undefined;
  }
  // Important: treat an explicitly provided empty array as an override to disable global fallbacks.
  if (!Object.hasOwn(raw, "fallbacks")) {
    return undefined;
  }
  return Array.isArray(raw.fallbacks) ? raw.fallbacks : undefined;
}

export function resolveAgentWorkspaceDir(cfg: OpenClawConfig, agentId: string) {
  const id = normalizeAgentId(agentId);
  const configured = resolveAgentConfig(cfg, id)?.workspace?.trim();
  if (configured) {
    return resolveUserPath(configured);
  }
  // All agents share the default workspace unless explicitly configured.
  // Isolated per-agent workspaces caused agents to lose context of the
  // main project (missing deps, wrong paths, build loops).
  const fallback = cfg.agents?.defaults?.workspace?.trim();
  if (fallback) {
    return resolveUserPath(fallback);
  }
  return DEFAULT_AGENT_WORKSPACE_DIR;
}

export const AGENT_ROLE_RANK: Record<AgentRole, number> = {
  orchestrator: 3,
  lead: 2,
  specialist: 1,
  worker: 0,
};

export const DEFAULT_AGENT_ROLE: AgentRole = "specialist";

export function resolveAgentRole(cfg: OpenClawConfig, agentId: string): AgentRole {
  const agentConfig = resolveAgentConfig(cfg, agentId);
  if (agentConfig?.role) {
    return agentConfig.role;
  }
  if (cfg.agents?.defaults?.role) {
    return cfg.agents.defaults.role;
  }

  // Check markdown agent definitions as fallback
  const id = normalizeAgentId(agentId);
  const definition = findAgentDefinition(cfg, id, id);
  if (definition?.role) {
    return definition.role;
  }

  // The main/default agent acts as the orchestrator by default.
  if (agentId === DEFAULT_AGENT_ID) {
    return "orchestrator";
  }
  return DEFAULT_AGENT_ROLE;
}

export function canSpawnRole(requesterRole: AgentRole, targetRole: AgentRole): boolean {
  return AGENT_ROLE_RANK[requesterRole] >= AGENT_ROLE_RANK[targetRole];
}

export type DelegationDirectionResult = "downward" | "upward";

/**
 * Determine delegation direction between two roles.
 * Higher rank → downward (direct delegation).
 * Lower rank → upward (request, requires review).
 * Same rank → downward (peer = direct).
 */
export function canDelegate(from: AgentRole, to: AgentRole): DelegationDirectionResult {
  const fromRank = AGENT_ROLE_RANK[from];
  const toRank = AGENT_ROLE_RANK[to];
  if (fromRank >= toRank) {
    return "downward";
  }
  return "upward";
}

export function resolveAgentDir(cfg: OpenClawConfig, agentId: string) {
  const id = normalizeAgentId(agentId);
  // Use resolveAgentEntry directly instead of resolveAgentConfig to avoid
  // infinite recursion: resolveAgentConfig → findAgentDefinition →
  // resolveAgentDefinitions → resolveAgentDir → resolveAgentConfig → ...
  const entry = resolveAgentEntry(cfg, id);
  const configured = typeof entry?.agentDir === "string" ? entry.agentDir.trim() : undefined;
  if (configured) {
    return resolveUserPath(configured);
  }
  const root = resolveStateDir(process.env, os.homedir);
  return path.join(root, "agents", id, "agent");
}
