import type {
  SandboxBrowserSettings,
  SandboxDockerSettings,
  SandboxPruneSettings,
} from "./types.sandbox.js";

export type AgentModelRoutingConfig = {
  /** Name of the routing strategy (e.g., "passthrough", "dynamic-tiered"). */
  strategy: string;
  /** Strategy-specific options (opaque to the core — passed through to the strategy). */
  options?: Record<string, unknown>;
  bypass?: {
    /** Skip routing when user has an explicit /model override (default: true). */
    onExplicitModel?: boolean;
    /** Skip routing for heartbeat runs (default: true). */
    onHeartbeat?: boolean;
  };
};

export type AgentModelConfig =
  | string
  | {
      /** Primary model (provider/model). */
      primary?: string;
      /** Per-agent model fallbacks (provider/model). */
      fallbacks?: string[];
      /** Dynamic model routing: select a strategy to route messages to different models. */
      routing?: AgentModelRoutingConfig;
    };

export type AgentSandboxConfig = {
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
  /** Docker-specific sandbox settings. */
  docker?: SandboxDockerSettings;
  /** Optional sandboxed browser settings. */
  browser?: SandboxBrowserSettings;
  /** Auto-prune sandbox settings. */
  prune?: SandboxPruneSettings;
};
