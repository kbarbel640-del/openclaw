/**
 * Routing Plan — Client-Side Orchestration for Agent Systems
 *
 * Cloud.ru agent-system orchestrators return a routing plan (JSON with
 * `fragments`) instead of dispatching to sub-agents themselves. This
 * module parses the routing plan and matches fragment agent names to
 * actual Cloud.ru agents for client-side dispatch.
 */

import type { Addressable } from "./resolve-agent.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RoutingFragment = {
  text: string;
  agent: string;
  confidence: number;
};

export type RoutingPlan = {
  fragments: RoutingFragment[];
  reasoning?: string;
  total_confidence?: number;
};

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Try to parse a response string as a routing plan.
 * Returns null if the text is not a valid routing plan.
 */
export function tryParseRoutingPlan(text: string): RoutingPlan | null {
  try {
    const parsed = JSON.parse(text.trim()) as Record<string, unknown>;
    if (!Array.isArray(parsed.fragments) || parsed.fragments.length === 0) {
      return null;
    }
    // Validate fragments have required fields
    for (const f of parsed.fragments) {
      if (
        typeof f !== "object" ||
        !f ||
        typeof f.text !== "string" ||
        typeof f.agent !== "string"
      ) {
        return null;
      }
    }
    return parsed as unknown as RoutingPlan;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Agent matching
// ---------------------------------------------------------------------------

/** Tokenize a name by splitting on `-`, `_`, and spaces, lowercased. */
function tokenize(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[-_\s]+/)
    .filter((t) => t.length > 0);
}

/** Common tokens that should not contribute to matching. */
const STOP_TOKENS = new Set(["agent", "system", "bot", "service"]);

/**
 * Match a routing plan fragment's agent name to an actual agent.
 *
 * Matching strategy (in priority order):
 * 1. Exact match on name (case-insensitive)
 * 2. Exact match on role (if member roles provided)
 * 3. Token-based scoring — highest overlap of meaningful tokens wins
 */
export function matchFragmentToAgent(
  fragmentAgent: string,
  agents: Addressable[],
  memberRoles?: Map<string, string>,
): Addressable | null {
  if (agents.length === 0) {
    return null;
  }

  const lower = fragmentAgent.toLowerCase();

  // 1. Exact name match
  const exact = agents.find((a) => a.name.toLowerCase() === lower);
  if (exact) {
    return exact;
  }

  // 2. Match via member roles (role → agentId → addressable)
  if (memberRoles) {
    for (const [agentId, role] of memberRoles) {
      if (role.toLowerCase() === lower) {
        const matched = agents.find((a) => a.id === agentId);
        if (matched) {
          return matched;
        }
      }
    }
  }

  // 3. Token-based scoring
  const fragTokens = tokenize(fragmentAgent).filter((t) => !STOP_TOKENS.has(t));
  if (fragTokens.length === 0) {
    return null;
  }

  let bestAgent: Addressable | null = null;
  let bestScore = 0;

  for (const agent of agents) {
    const agentTokens = tokenize(agent.name).filter((t) => !STOP_TOKENS.has(t));
    let score = 0;
    for (const ft of fragTokens) {
      for (const at of agentTokens) {
        if (ft === at || ft.includes(at) || at.includes(ft)) {
          score++;
          break;
        }
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestAgent = agent;
    }
  }

  return bestScore > 0 ? bestAgent : null;
}
