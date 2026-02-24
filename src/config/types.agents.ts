import type { ChatType } from "../channels/chat-type.js";
import type { AgentDefaultsConfig } from "./types.agent-defaults.js";
import type { AgentModelConfig, AgentSandboxConfig } from "./types.agents-shared.js";
import type { HumanDelayConfig, IdentityConfig } from "./types.base.js";
import type { GroupChatConfig } from "./types.messages.js";
import type { AgentToolsConfig, MemorySearchConfig } from "./types.tools.js";

/**
 * Intent classification configuration for routing decisions.
 */
export type IntentClassificationConfig = {
  /** Enable intent-based routing for this agent. */
  enabled?: boolean;
  /** Keywords or patterns that trigger this agent. */
  keywords?: string[];
  /** Intent categories this agent handles (e.g., "coding", "research", "scheduling"). */
  categories?: string[];
};

/**
 * Agent handoff configuration controlling delegation between agents.
 */
export type AgentHandoffConfig = {
  /** Agent IDs this agent can hand off to. Use "*" to allow any agent. */
  allowAgents?: string[];
  /** Agent IDs this agent can receive handoffs from. Use "*" to allow any. */
  allowFrom?: string[];
  /** Whether to transfer full conversation context during handoff. */
  transferContext?: boolean;
};

/**
 * Shared context/memory configuration for multi-agent collaboration.
 */
export type SharedContextConfig = {
  /** Enable shared context for this agent. */
  enabled?: boolean;
  /** Agent IDs that can access this agent's shared context. Use "*" to allow any. */
  allowAgents?: string[];
  /** Context scope: "session" (per-session) or "global" (across all sessions). */
  scope?: "session" | "global";
};

/**
 * Supervisor agent configuration for orchestration and routing.
 */
export type SupervisorConfig = {
  /** Default agent to route to when intent is unclear. */
  defaultAgent?: string;
  /** Strategy for handling multi-intent requests. */
  strategy?: "delegate" | "collaborate" | "sequential";
};

/**
 * Agent orchestration configuration combining all multi-agent features.
 */
export type AgentOrchestrationConfig = {
  /** Mark this agent as a supervisor capable of routing and delegation. */
  supervisor?: boolean | SupervisorConfig;
  /** Intent classification rules for routing. */
  intents?: IntentClassificationConfig;
  /** Agent handoff permissions and settings. */
  handoff?: AgentHandoffConfig;
  /** Shared context/memory configuration. */
  sharedContext?: SharedContextConfig;
};

export type AgentConfig = {
  id: string;
  default?: boolean;
  name?: string;
  workspace?: string;
  agentDir?: string;
  model?: AgentModelConfig;
  /** Optional allowlist of skills for this agent (omit = all skills; empty = none). */
  skills?: string[];
  memorySearch?: MemorySearchConfig;
  /** Human-like delay between block replies for this agent. */
  humanDelay?: HumanDelayConfig;
  /** Optional per-agent heartbeat overrides. */
  heartbeat?: AgentDefaultsConfig["heartbeat"];
  identity?: IdentityConfig;
  groupChat?: GroupChatConfig;
  subagents?: {
    /** Allow spawning sub-agents under other agent ids. Use "*" to allow any. */
    allowAgents?: string[];
    /** Per-agent default model for spawned sub-agents (string or {primary,fallbacks}). */
    model?: AgentModelConfig;
  };
  /** Optional per-agent sandbox overrides. */
  sandbox?: AgentSandboxConfig;
  /** Optional per-agent stream params (e.g. cacheRetention, temperature). */
  params?: Record<string, unknown>;
  tools?: AgentToolsConfig;
  /** Multi-agent orchestration configuration. */
  orchestration?: AgentOrchestrationConfig;
};

export type AgentsConfig = {
  defaults?: AgentDefaultsConfig;
  list?: AgentConfig[];
};

export type AgentBinding = {
  agentId: string;
  comment?: string;
  match: {
    channel: string;
    accountId?: string;
    peer?: { kind: ChatType; id: string };
    guildId?: string;
    teamId?: string;
    /** Discord role IDs used for role-based routing. */
    roles?: string[];
  };
};
