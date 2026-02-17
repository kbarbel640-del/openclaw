import { loadConfig } from "../config/config.js";
import { resolveMainSessionKey } from "../config/sessions/main-session.js";
import type { AgentRole } from "../config/types.agents.js";
import type { OpenClawConfig } from "../config/types.js";
import { listAgentIds, resolveAgentRole } from "./agent-scope.js";

/**
 * Resolve the "team chat" session key where all agent-to-agent communication should be visible,
 * similar to a shared Slack channel.
 *
 * Today this is the configured main session (global scope -> "global", otherwise the default
 * agent's main session key).
 */
export function resolveTeamChatSessionKey(params?: { cfg?: OpenClawConfig }): string {
  const cfg = params?.cfg ?? loadConfig();
  return resolveMainSessionKey(cfg);
}

export type TeamChatMemberEntry = {
  agentId: string;
  role: AgentRole;
  /** All agents actively listen in the main team chat session. */
  listeningMode: "active" | "mention-only";
};

/** In-memory roster of agents that should be in the team chat. */
const teamChatMembers = new Map<string, TeamChatMemberEntry>();

/**
 * Ensure all configured agents are registered as members of the team chat session.
 *
 * Called at gateway startup. Every agent gets "active" listening so all can
 * participate directly in the main chat (like a shared Slack channel).
 */
export function ensureTeamChatAutoJoin(cfg?: OpenClawConfig): TeamChatMemberEntry[] {
  const config = cfg ?? loadConfig();
  const agentIds = listAgentIds(config);
  const entries: TeamChatMemberEntry[] = [];

  for (const agentId of agentIds) {
    const role = resolveAgentRole(config, agentId);
    const entry: TeamChatMemberEntry = { agentId, role, listeningMode: "active" };
    teamChatMembers.set(agentId, entry);
    entries.push(entry);
  }

  return entries;
}

/** Get the current team chat member list. */
export function getTeamChatMembers(): TeamChatMemberEntry[] {
  return [...teamChatMembers.values()];
}

/** Reset team chat members (for testing). */
export function resetTeamChatMembersForTests(): void {
  teamChatMembers.clear();
}
