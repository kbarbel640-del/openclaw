import type { AgentDefaultsConfig, ModelByComplexityConfig } from "./types.agent-defaults.js";
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

export type AgentRole = "orchestrator" | "lead" | "specialist" | "worker";

export type AgentConfig = {
  id: string;
  default?: boolean;
  name?: string;
  /** Emoji icon for the agent (displayed in UI and CLI). */
  icon?: string;
  /** Hierarchy role: orchestrator > lead > specialist > worker. Default: "specialist". */
  role?: AgentRole;
  /**
   * Optional persona override.
   *
   * When set, OpenClaw will try to load a persona markdown file from the agent workspace
   * (default: `personas/<persona>.md`) and inject it in place of `SOUL.md` for prompt context.
   *
   * This does not change tool availability or skill eligibility.
   */
  persona?: string;
  workspace?: string;
  agentDir?: string;
  model?: AgentModelConfig;
  /** Optional per-agent complexity-based model routing overrides. */
  modelByComplexity?: ModelByComplexityConfig;
  /** Optional allowlist of skills for this agent (omit = all skills; empty = none). */
  skills?: string[];
  /** Capability tags for smart agent routing (e.g., "api-design", "security", "react", "database"). */
  capabilities?: string[];
  /** Domain expertise descriptions for detailed capability matching. */
  expertise?: string[];
  /** Whether to auto-route based on workload. Default: "auto". */
  availability?: "auto" | "manual";
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
    peer?: { kind: "dm" | "group" | "channel"; id: string };
    guildId?: string;
    teamId?: string;
  };
};
