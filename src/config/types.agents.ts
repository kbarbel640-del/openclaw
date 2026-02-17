import type { ChatType } from "../channels/chat-type.js";
import type { AgentDefaultsConfig } from "./types.agent-defaults.js";
import type { HumanDelayConfig, IdentityConfig } from "./types.base.js";
import type { GroupChatConfig } from "./types.messages.js";
import type {
  SandboxBrowserSettings,
  SandboxDockerSettings,
  SandboxPruneSettings,
} from "./types.sandbox.js";
import type { AgentToolsConfig, MemorySearchConfig } from "./types.tools.js";

export type AgentModelConfig =
  | string
  | {
      /** Primary model (provider/model). */
      primary?: string;
      /** Per-agent model fallbacks (provider/model). */
      fallbacks?: string[];
    };

export type AgentCapabilityCard = {
  /** Optional stable identifier for this capability card. */
  id?: string;
  /** Short label for this capability. */
  title: string;
  /** Optional explanation of what this card covers. */
  description?: string;
  /** Keywords used for task-routing matching. */
  keywords?: string[];
};

export type AgentCapabilityCostTier = "free" | "cheap" | "medium" | "expensive";

export type AgentCapabilitiesConfig = {
  /** Capability tags used for delegation routing. */
  tags?: string[];
  /** Relative cost profile used for cost-aware delegation ranking. */
  costTier?: AgentCapabilityCostTier;
  /** Typical completion latency for common tasks (for example "90s" or "2m"). */
  typicalLatency?: string;
  /** Additional routing notes and constraints. */
  notes?: string;
};

export type AgentConfig = {
  id: string;
  default?: boolean;
  name?: string;
  /** Human-readable description of this agent's capabilities (used in fleet tables). */
  description?: string;
  /** Structured capability metadata for routing and fleet table display. */
  capabilities?: AgentCapabilitiesConfig;
  /** Optional capability cards to help route tasks to the best-fit agents. */
  capabilityCards?: AgentCapabilityCard[];
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
    model?: string | { primary?: string; fallbacks?: string[] };
    /** Per-agent default run timeout in seconds for spawned sub-agents (0 disables timeout). */
    runTimeoutSeconds?: number;
    /** Allow subagents to recursively spawn their own subagents. Default: false. */
    allowRecursiveSpawn?: boolean;
    /** Maximum nesting depth for recursive subagent spawning. Default: 3, range: 1-10. */
    maxDepth?: number;
    /** Max children this agent can have active simultaneously (overrides default). */
    maxChildrenPerAgent?: number;
  };
  sandbox?: {
    mode?: "off" | "non-main" | "all";
    /** Agent workspace access inside the sandbox. */
    workspaceAccess?: "none" | "ro" | "rw";
    /**
     * Session tools visibility for sandboxed sessions.
     * - "spawned": only allow session tools to target sessions spawned from this session (default)
     * - "all": allow session tools to target any session
     */
    sessionToolsVisibility?: "spawned" | "all";
    /** Container/workspace scope for sandbox isolation. */
    scope?: "session" | "agent" | "shared";
    /** Legacy alias for scope ("session" when true, "shared" when false). */
    perSession?: boolean;
    workspaceRoot?: string;
    /** Docker-specific sandbox overrides for this agent. */
    docker?: SandboxDockerSettings;
    /** Optional sandboxed browser overrides for this agent. */
    browser?: SandboxBrowserSettings;
    /** Auto-prune overrides for this agent. */
    prune?: SandboxPruneSettings;
  };
  tools?: AgentToolsConfig;
};

export type AgentsConfig = {
  defaults?: AgentDefaultsConfig;
  list?: AgentConfig[];
};

export type AgentBinding = {
  agentId: string;
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
