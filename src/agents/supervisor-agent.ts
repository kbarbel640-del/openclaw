import type { OpenClawConfig } from "../config/config.js";
import type { AgentConfig, SupervisorConfig } from "../config/types.agents.js";
import { shouldLogVerbose } from "../globals.js";
import { logDebug, logWarn } from "../logger.js";
import {
  classifyIntent,
  getBestMatch,
  getMatchesAboveThreshold,
  type IntentClassificationResult,
  type IntentMatch,
} from "../routing/intent-classifier.js";

/**
 * Options for routing a message through the supervisor.
 */
export type SupervisorRouteOptions = {
  /** Configuration containing agent definitions. */
  cfg: OpenClawConfig;
  /** Message to route. */
  message: string;
  /** Optional channel context for filtering. */
  channel?: string;
  /** Optional confidence threshold (0.0 - 1.0) for matches. */
  confidenceThreshold?: number;
};

/**
 * Result of supervisor routing.
 */
export type SupervisorRouteResult = {
  /** Selected agent ID to handle the message. */
  agentId: string;
  /** Confidence score for the routing decision. */
  confidence: number;
  /** Routing strategy used (from supervisor config). */
  strategy: "delegate" | "collaborate" | "sequential";
  /** All intent matches considered during routing. */
  matches: IntentMatch[];
  /** Whether a default agent was used. */
  isDefault: boolean;
};

/**
 * Options for finding the supervisor agent in configuration.
 */
export type FindSupervisorOptions = {
  /** Configuration containing agent definitions. */
  cfg: OpenClawConfig;
  /** Optional agent ID to check specifically. */
  agentId?: string;
};

/**
 * Finds the supervisor agent from configuration.
 *
 * @returns The supervisor agent config and parsed supervisor config, or null if not found.
 */
export function findSupervisorAgent(options: FindSupervisorOptions): {
  agent: AgentConfig;
  supervisorConfig: SupervisorConfig;
} | null {
  const { cfg, agentId } = options;
  const agents = cfg.agents?.list;
  if (!Array.isArray(agents)) {
    return null;
  }

  // If agentId provided, check that specific agent
  if (agentId) {
    const agent = agents.find((a) => a.id === agentId);
    if (!agent) {
      return null;
    }
    const supervisor = agent.orchestration?.supervisor;
    if (!supervisor) {
      return null;
    }
    const supervisorConfig: SupervisorConfig =
      typeof supervisor === "boolean" ? {} : supervisor;
    return { agent, supervisorConfig };
  }

  // Find first agent marked as supervisor
  for (const agent of agents) {
    const supervisor = agent.orchestration?.supervisor;
    if (supervisor === true || (supervisor && typeof supervisor === "object")) {
      const supervisorConfig: SupervisorConfig =
        typeof supervisor === "boolean" ? {} : supervisor;
      return { agent, supervisorConfig };
    }
  }

  return null;
}

/**
 * Routes a message through the supervisor agent to determine which specialized agent should handle it.
 *
 * This function implements the core orchestration logic:
 * 1. Classifies the message intent using the intent classifier
 * 2. Applies confidence thresholds to filter matches
 * 3. Selects the best agent based on supervisor strategy
 * 4. Falls back to default agent if no matches found
 *
 * @returns Routing result with selected agent and metadata, or null if routing fails.
 */
export function routeWithSupervisor(
  options: SupervisorRouteOptions,
): SupervisorRouteResult | null {
  const { cfg, message, channel, confidenceThreshold = 0.5 } = options;

  const shouldLog = shouldLogVerbose();
  if (shouldLog) {
    logDebug(`[supervisor-agent] routing message: "${message}"`);
  }

  // Find supervisor agent configuration
  const supervisor = findSupervisorAgent({ cfg });
  if (!supervisor) {
    if (shouldLog) {
      logDebug("[supervisor-agent] no supervisor agent configured");
    }
    return null;
  }

  const { supervisorConfig } = supervisor;
  const strategy = supervisorConfig.strategy ?? "delegate";

  if (shouldLog) {
    logDebug(`[supervisor-agent] using strategy: ${strategy}`);
  }

  // Classify intent
  const classification: IntentClassificationResult = classifyIntent({
    cfg,
    message,
    channel,
  });

  if (shouldLog) {
    logDebug(
      `[supervisor-agent] intent classification: ${classification.matches.length} matches`,
    );
  }

  // Filter matches by confidence threshold
  const validMatches = getMatchesAboveThreshold(classification, confidenceThreshold);

  if (shouldLog) {
    logDebug(
      `[supervisor-agent] matches above threshold (${confidenceThreshold}): ${validMatches.length}`,
    );
  }

  // Select agent based on strategy
  let selectedMatch: IntentMatch | null = null;
  let isDefault = false;

  switch (strategy) {
    case "delegate":
      // Select highest confidence match
      selectedMatch = getBestMatch(classification);
      if (selectedMatch && selectedMatch.matchReason === "default") {
        isDefault = true;
      }
      break;

    case "collaborate":
      // For collaborate strategy, select highest confidence match
      // (actual collaboration implementation would be in agent-handoff.ts)
      selectedMatch = getBestMatch(classification);
      if (selectedMatch && selectedMatch.matchReason === "default") {
        isDefault = true;
      }
      if (shouldLog && validMatches.length > 1) {
        logDebug(
          `[supervisor-agent] collaborate strategy: ${validMatches.length} agents could participate`,
        );
      }
      break;

    case "sequential":
      // For sequential strategy, select highest confidence match
      // (actual sequential execution would be in agent-handoff.ts)
      selectedMatch = getBestMatch(classification);
      if (selectedMatch && selectedMatch.matchReason === "default") {
        isDefault = true;
      }
      if (shouldLog && validMatches.length > 1) {
        logDebug(
          `[supervisor-agent] sequential strategy: ${validMatches.length} agents in potential sequence`,
        );
      }
      break;

    default:
      logWarn(`[supervisor-agent] unknown strategy: ${strategy}, falling back to delegate`);
      selectedMatch = getBestMatch(classification);
      if (selectedMatch && selectedMatch.matchReason === "default") {
        isDefault = true;
      }
  }

  // Handle no match case
  if (!selectedMatch) {
    // Try to use default agent from supervisor config
    if (supervisorConfig.defaultAgent) {
      if (shouldLog) {
        logDebug(
          `[supervisor-agent] no matches, using default agent: ${supervisorConfig.defaultAgent}`,
        );
      }
      return {
        agentId: supervisorConfig.defaultAgent,
        confidence: 0.3,
        strategy,
        matches: classification.matches,
        isDefault: true,
      };
    }

    if (shouldLog) {
      logDebug("[supervisor-agent] no matches and no default agent configured");
    }
    return null;
  }

  if (shouldLog) {
    logDebug(
      `[supervisor-agent] selected agent: ${selectedMatch.agentId} (confidence: ${selectedMatch.confidence}, reason: ${selectedMatch.matchReason})`,
    );
  }

  return {
    agentId: selectedMatch.agentId,
    confidence: selectedMatch.confidence,
    strategy,
    matches: classification.matches,
    isDefault,
  };
}

/**
 * Validates that an agent exists and is properly configured for orchestration.
 *
 * @returns true if agent exists and is valid, false otherwise.
 */
export function validateAgentForOrchestration(
  cfg: OpenClawConfig,
  agentId: string,
): boolean {
  const agents = cfg.agents?.list;
  if (!Array.isArray(agents)) {
    return false;
  }

  const agent = agents.find((a) => a.id === agentId);
  if (!agent) {
    return false;
  }

  // Agent exists - valid for orchestration
  return true;
}

/**
 * Checks if an agent can be delegated to based on handoff configuration.
 *
 * @returns true if handoff is allowed, false otherwise.
 */
export function canHandoffToAgent(
  cfg: OpenClawConfig,
  fromAgentId: string,
  toAgentId: string,
): boolean {
  const agents = cfg.agents?.list;
  if (!Array.isArray(agents)) {
    return false;
  }

  const fromAgent = agents.find((a) => a.id === fromAgentId);
  if (!fromAgent) {
    return false;
  }

  const handoffConfig = fromAgent.orchestration?.handoff;
  if (!handoffConfig) {
    // No handoff config means handoff is allowed by default
    return true;
  }

  const allowAgents = handoffConfig.allowAgents ?? [];
  if (allowAgents.includes("*")) {
    // Wildcard allows any agent
    return true;
  }

  return allowAgents.includes(toAgentId);
}
