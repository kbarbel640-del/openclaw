/**
 * Configuration types for Brain MCP 4-tier memory integration.
 *
 * Each agent can have their own:
 * - memory.md path (Tier 0)
 * - Brain MCP workspace ID (Tiers 1-3)
 * - Tier escalation settings
 */

export type BrainTieredConfig = {
  /**
   * Brain MCP workspace UUID for this agent.
   * Each agent should have their own workspace for isolation.
   */
  workspaceId: string;

  /**
   * Shared triumph workspace UUID for cross-agent knowledge.
   * Searched when agent's private workspace doesn't have sufficient results.
   * Optional — if omitted, only the agent's private workspace is searched.
   */
  triumphWorkspaceId?: string;

  /**
   * Path to the agent's memory.md file (Tier 0).
   * Can be relative to workspace or absolute.
   * Default: "./memory.md"
   */
  memoryMdPath?: string;

  /**
   * Path to daily notes directory for Tier 0 search.
   * Default: "./memory/"
   */
  dailyNotesPath?: string;

  /**
   * Path to mcporter binary.
   * Default: "mcporter"
   */
  mcporterPath?: string;

  /**
   * Tier escalation configuration.
   */
  tiers?: BrainTierConfig;
};

export type BrainTierConfig = {
  /**
   * Minimum score from Tier 0 to skip Brain MCP tiers.
   * If best Tier 0 result >= this score, don't escalate.
   * Default: 0.8
   */
  escalationThreshold?: number;

  /**
   * Minimum number of Tier 0 results to consider sufficient.
   * Default: 3
   */
  minTier0Results?: number;

  /**
   * Maximum tier to escalate to (1, 2, or 3).
   * Default: 3
   */
  maxTier?: 1 | 2 | 3;

  /**
   * Timeout for Brain MCP requests in milliseconds.
   * Default: 5000
   */
  timeoutMs?: number;

  /**
   * Enable/disable specific tiers.
   */
  enabled?: {
    tier1?: boolean; // quick_search
    tier2?: boolean; // unified_search semantic
    tier3?: boolean; // unified_search full
  };
};

export type ResolvedBrainTieredConfig = {
  workspaceId: string;
  triumphWorkspaceId?: string;
  memoryMdPath: string;
  dailyNotesPath: string;
  mcporterPath: string;
  tiers: ResolvedBrainTierConfig;
};

export type ResolvedBrainTierConfig = {
  escalationThreshold: number;
  minTier0Results: number;
  maxTier: 1 | 2 | 3;
  timeoutMs: number;
  enabled: {
    tier1: boolean;
    tier2: boolean;
    tier3: boolean;
  };
};

/**
 * Default configuration values.
 */
export const BRAIN_TIERED_DEFAULTS: ResolvedBrainTieredConfig = {
  workspaceId: "", // Must be provided
  memoryMdPath: "./memory.md",
  dailyNotesPath: "./memory/",
  mcporterPath: "mcporter",
  tiers: {
    escalationThreshold: 0.8,
    minTier0Results: 3,
    maxTier: 3,
    timeoutMs: 5000,
    enabled: {
      tier1: true,
      tier2: true,
      tier3: true,
    },
  },
};

/**
 * Resolve user config with defaults.
 */
export function resolveBrainTieredConfig(
  config: BrainTieredConfig,
  workspaceDir: string,
): ResolvedBrainTieredConfig {
  const defaults = BRAIN_TIERED_DEFAULTS;

  if (!config.workspaceId) {
    throw new Error("brainTiered.workspaceId is required");
  }

  const memoryMdPath = resolvePathRelativeToWorkspace(
    config.memoryMdPath ?? defaults.memoryMdPath,
    workspaceDir,
  );

  const dailyNotesPath = resolvePathRelativeToWorkspace(
    config.dailyNotesPath ?? defaults.dailyNotesPath,
    workspaceDir,
  );

  return {
    workspaceId: config.workspaceId,
    triumphWorkspaceId: config.triumphWorkspaceId,
    memoryMdPath,
    dailyNotesPath,
    mcporterPath: config.mcporterPath ?? defaults.mcporterPath,
    tiers: {
      escalationThreshold: config.tiers?.escalationThreshold ?? defaults.tiers.escalationThreshold,
      minTier0Results: config.tiers?.minTier0Results ?? defaults.tiers.minTier0Results,
      maxTier: config.tiers?.maxTier ?? defaults.tiers.maxTier,
      timeoutMs: config.tiers?.timeoutMs ?? defaults.tiers.timeoutMs,
      enabled: {
        tier1: config.tiers?.enabled?.tier1 ?? defaults.tiers.enabled.tier1,
        tier2: config.tiers?.enabled?.tier2 ?? defaults.tiers.enabled.tier2,
        tier3: config.tiers?.enabled?.tier3 ?? defaults.tiers.enabled.tier3,
      },
    },
  };
}

function resolvePathRelativeToWorkspace(rawPath: string, workspaceDir: string): string {
  if (rawPath.startsWith("/") || rawPath.startsWith("~")) {
    return rawPath;
  }
  // Relative path - resolve from workspace
  return `${workspaceDir}/${rawPath}`.replace(/\/+/g, "/");
}
