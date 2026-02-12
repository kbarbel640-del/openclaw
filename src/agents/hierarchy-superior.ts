import type { OpenClawConfig } from "../config/config.js";
import type { AgentRole } from "../config/types.agents.js";
import {
  AGENT_ROLE_RANK,
  listAgentIds,
  resolveAgentIdFromSessionKey,
  resolveAgentRole,
} from "./agent-scope.js";
import { listAllSubagentRuns } from "./subagent-registry.js";

export const AGENT_ROLE_CHAIN: AgentRole[] = ["worker", "specialist", "lead", "orchestrator"];

export function resolveImmediateSuperiorAgentId(
  cfg: OpenClawConfig,
  agentId: string,
): string | undefined {
  const knownAgentIds = new Set(listAgentIds(cfg));
  const currentRank = AGENT_ROLE_RANK[resolveAgentRole(cfg, agentId)];
  const candidates = listAllSubagentRuns()
    .map((run) => ({
      requesterAgentId: resolveAgentIdFromSessionKey(run.requesterSessionKey),
      childAgentId: resolveAgentIdFromSessionKey(run.childSessionKey),
      anchorAt: run.startedAt ?? run.createdAt ?? 0,
    }))
    .filter((run) => run.childAgentId === agentId)
    .toSorted((a, b) => b.anchorAt - a.anchorAt);

  for (const candidate of candidates) {
    const superiorId = candidate.requesterAgentId;
    if (!superiorId || superiorId === agentId || !knownAgentIds.has(superiorId)) {
      continue;
    }
    const superiorRank = AGENT_ROLE_RANK[resolveAgentRole(cfg, superiorId)];
    if (superiorRank > currentRank) {
      return superiorId;
    }
  }

  return undefined;
}

export function resolveNextSuperiorByRole(
  cfg: OpenClawConfig,
  agentId: string,
): { superiorId: string; superiorRole: AgentRole } | null {
  const currentRole = resolveAgentRole(cfg, agentId);
  const currentIdx = AGENT_ROLE_CHAIN.indexOf(currentRole);
  if (currentIdx < 0 || currentIdx >= AGENT_ROLE_CHAIN.length - 1) {
    return null;
  }

  const superiorRole = AGENT_ROLE_CHAIN[currentIdx + 1];
  const superiorId = listAgentIds(cfg).find((id) => resolveAgentRole(cfg, id) === superiorRole);
  if (!superiorId) {
    return null;
  }

  return { superiorId, superiorRole };
}

export function resolvePreferredSuperior(
  cfg: OpenClawConfig,
  agentId: string,
): { superiorId: string; superiorRole: AgentRole; source: "immediate" | "role-fallback" } | null {
  const immediate = resolveImmediateSuperiorAgentId(cfg, agentId);
  if (immediate) {
    return {
      superiorId: immediate,
      superiorRole: resolveAgentRole(cfg, immediate),
      source: "immediate",
    };
  }

  const fallback = resolveNextSuperiorByRole(cfg, agentId);
  if (!fallback) {
    return null;
  }
  return { ...fallback, source: "role-fallback" };
}
