import type { OpenClawConfig } from "../config/config.js";
import type { AgentConfig, AgentHandoffConfig } from "../config/types.agents.js";
import { shouldLogVerbose } from "../globals.js";
import { logDebug, logWarn } from "../logger.js";

/**
 * Context data to transfer during handoff.
 */
export type HandoffContext = {
  /** Conversation history messages. */
  messages?: unknown[];
  /** Session metadata. */
  metadata?: Record<string, unknown>;
  /** Shared state/variables. */
  state?: Record<string, unknown>;
  /** Original message that triggered the handoff. */
  originalMessage?: string;
  /** Reason for the handoff. */
  handoffReason?: string;
};

/**
 * Options for initiating an agent handoff.
 */
export type HandoffOptions = {
  /** Configuration containing agent definitions. */
  cfg: OpenClawConfig;
  /** Agent ID initiating the handoff. */
  fromAgentId: string;
  /** Agent ID receiving the handoff. */
  toAgentId: string;
  /** Context to transfer (optional, depends on handoff config). */
  context?: HandoffContext;
  /** Force handoff even if permissions would deny it. */
  force?: boolean;
};

/**
 * Result of a handoff operation.
 */
export type HandoffResult = {
  /** Whether the handoff was successful. */
  success: boolean;
  /** Target agent ID. */
  toAgentId: string;
  /** Source agent ID. */
  fromAgentId: string;
  /** Whether context was transferred. */
  contextTransferred: boolean;
  /** Error message if handoff failed. */
  error?: string;
  /** Handoff timestamp. */
  timestamp: number;
};

/**
 * Validates handoff permissions between two agents.
 *
 * Checks:
 * 1. Both agents exist in configuration
 * 2. Source agent allows handoff to target (allowAgents)
 * 3. Target agent allows handoff from source (allowFrom)
 *
 * @returns true if handoff is permitted, false otherwise.
 */
export function validateHandoffPermissions(
  cfg: OpenClawConfig,
  fromAgentId: string,
  toAgentId: string,
): { allowed: boolean; reason?: string } {
  const agents = cfg.agents?.list;
  if (!Array.isArray(agents)) {
    return { allowed: false, reason: "No agents configured" };
  }

  const fromAgent = agents.find((a) => a.id === fromAgentId);
  if (!fromAgent) {
    return { allowed: false, reason: `Source agent not found: ${fromAgentId}` };
  }

  const toAgent = agents.find((a) => a.id === toAgentId);
  if (!toAgent) {
    return { allowed: false, reason: `Target agent not found: ${toAgentId}` };
  }

  const fromHandoffConfig = fromAgent.orchestration?.handoff;
  const toHandoffConfig = toAgent.orchestration?.handoff;

  // Check source agent's allowAgents list
  if (fromHandoffConfig) {
    const allowAgents = fromHandoffConfig.allowAgents ?? [];
    if (allowAgents.length > 0) {
      const allowed = allowAgents.includes("*") || allowAgents.includes(toAgentId);
      if (!allowed) {
        return {
          allowed: false,
          reason: `Source agent ${fromAgentId} does not allow handoff to ${toAgentId}`,
        };
      }
    }
  }

  // Check target agent's allowFrom list
  if (toHandoffConfig) {
    const allowFrom = toHandoffConfig.allowFrom ?? [];
    if (allowFrom.length > 0) {
      const allowed = allowFrom.includes("*") || allowFrom.includes(fromAgentId);
      if (!allowed) {
        return {
          allowed: false,
          reason: `Target agent ${toAgentId} does not accept handoff from ${fromAgentId}`,
        };
      }
    }
  }

  return { allowed: true };
}

/**
 * Determines whether context should be transferred during handoff.
 *
 * Context transfer happens when:
 * - Source agent's handoff.transferContext is true, OR
 * - Source agent has no explicit transferContext config (default: false)
 *
 * @returns true if context should be transferred.
 */
export function shouldTransferContext(
  fromAgent: AgentConfig,
  toAgent: AgentConfig,
): boolean {
  const fromHandoffConfig = fromAgent.orchestration?.handoff;

  // Default to false if not specified
  return fromHandoffConfig?.transferContext ?? false;
}

/**
 * Prepares context for transfer during handoff.
 *
 * Filters and sanitizes context data based on configuration.
 *
 * @returns Sanitized context ready for transfer.
 */
export function prepareHandoffContext(
  context: HandoffContext | undefined,
  transferEnabled: boolean,
): HandoffContext | undefined {
  if (!transferEnabled || !context) {
    return undefined;
  }

  // Create a sanitized copy of the context
  const sanitized: HandoffContext = {};

  if (context.originalMessage) {
    sanitized.originalMessage = context.originalMessage;
  }

  if (context.handoffReason) {
    sanitized.handoffReason = context.handoffReason;
  }

  if (context.messages) {
    sanitized.messages = context.messages;
  }

  if (context.metadata) {
    sanitized.metadata = { ...context.metadata };
  }

  if (context.state) {
    sanitized.state = { ...context.state };
  }

  return sanitized;
}

/**
 * Executes an agent-to-agent handoff.
 *
 * This function:
 * 1. Validates handoff permissions
 * 2. Determines if context should be transferred
 * 3. Prepares and transfers context if enabled
 * 4. Returns handoff result
 *
 * @returns HandoffResult indicating success or failure.
 */
export function executeHandoff(options: HandoffOptions): HandoffResult {
  const { cfg, fromAgentId, toAgentId, context, force = false } = options;

  const shouldLog = shouldLogVerbose();
  if (shouldLog) {
    logDebug(`[agent-handoff] executing handoff: ${fromAgentId} -> ${toAgentId}`);
  }

  const timestamp = Date.now();

  // Validate permissions unless forced
  if (!force) {
    const validation = validateHandoffPermissions(cfg, fromAgentId, toAgentId);
    if (!validation.allowed) {
      if (shouldLog) {
        logDebug(`[agent-handoff] handoff denied: ${validation.reason}`);
      }
      return {
        success: false,
        toAgentId,
        fromAgentId,
        contextTransferred: false,
        error: validation.reason,
        timestamp,
      };
    }
  }

  const agents = cfg.agents?.list;
  if (!Array.isArray(agents)) {
    return {
      success: false,
      toAgentId,
      fromAgentId,
      contextTransferred: false,
      error: "No agents configured",
      timestamp,
    };
  }

  const fromAgent = agents.find((a) => a.id === fromAgentId);
  const toAgent = agents.find((a) => a.id === toAgentId);

  if (!fromAgent || !toAgent) {
    return {
      success: false,
      toAgentId,
      fromAgentId,
      contextTransferred: false,
      error: "Agent not found",
      timestamp,
    };
  }

  // Determine if context should be transferred
  const transferContext = shouldTransferContext(fromAgent, toAgent);
  const preparedContext = prepareHandoffContext(context, transferContext);

  if (shouldLog) {
    logDebug(
      `[agent-handoff] context transfer: ${transferContext ? "enabled" : "disabled"}`,
    );
    if (preparedContext) {
      logDebug(
        `[agent-handoff] transferring context: ${Object.keys(preparedContext).join(", ")}`,
      );
    }
  }

  // Handoff successful
  return {
    success: true,
    toAgentId,
    fromAgentId,
    contextTransferred: transferContext && preparedContext !== undefined,
    timestamp,
  };
}

/**
 * Gets handoff configuration for an agent.
 *
 * @returns Agent's handoff config, or undefined if not configured.
 */
export function getHandoffConfig(
  cfg: OpenClawConfig,
  agentId: string,
): AgentHandoffConfig | undefined {
  const agents = cfg.agents?.list;
  if (!Array.isArray(agents)) {
    return undefined;
  }

  const agent = agents.find((a) => a.id === agentId);
  return agent?.orchestration?.handoff;
}

/**
 * Checks if an agent can initiate handoffs.
 *
 * @returns true if agent has handoff configuration.
 */
export function canInitiateHandoff(cfg: OpenClawConfig, agentId: string): boolean {
  const handoffConfig = getHandoffConfig(cfg, agentId);
  return handoffConfig !== undefined;
}

/**
 * Gets list of agents that can be handed off to from a given agent.
 *
 * @returns Array of agent IDs that can receive handoffs.
 */
export function getHandoffTargets(cfg: OpenClawConfig, fromAgentId: string): string[] {
  const handoffConfig = getHandoffConfig(cfg, fromAgentId);
  if (!handoffConfig) {
    return [];
  }

  const allowAgents = handoffConfig.allowAgents ?? [];

  // If wildcard is present, return all agents except self
  if (allowAgents.includes("*")) {
    const agents = cfg.agents?.list ?? [];
    return agents.filter((a) => a.id !== fromAgentId).map((a) => a.id);
  }

  return allowAgents;
}

/**
 * Gets list of agents that can hand off to a given agent.
 *
 * @returns Array of agent IDs that can initiate handoffs to this agent.
 */
export function getHandoffSources(cfg: OpenClawConfig, toAgentId: string): string[] {
  const handoffConfig = getHandoffConfig(cfg, toAgentId);
  if (!handoffConfig) {
    return [];
  }

  const allowFrom = handoffConfig.allowFrom ?? [];

  // If wildcard is present, return all agents except self
  if (allowFrom.includes("*")) {
    const agents = cfg.agents?.list ?? [];
    return agents.filter((a) => a.id !== toAgentId).map((a) => a.id);
  }

  return allowFrom;
}
