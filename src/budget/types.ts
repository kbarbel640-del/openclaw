/**
 * Budget governance types for enforcing resource limits on agent workflows.
 */

/**
 * Budget profile identifiers.
 * - cheap: Local model preferred, minimal tools, no subagents
 * - normal: Standard limits with bounded tool usage
 * - deep: Higher caps, must be explicitly armed
 */
export type BudgetProfileId = "cheap" | "normal" | "deep";

/**
 * Limits that can be enforced by the BudgetGovernor.
 */
export type BudgetLimits = {
  /** Max tool calls per workflow/request. */
  maxToolCalls: number;
  /** Max LLM API calls per workflow. */
  maxLlmCalls: number;
  /** Max tokens (input + output) per workflow. */
  maxTokens: number;
  /** Max estimated cost in USD per workflow. */
  maxCostUsd: number;
  /** Max wall-clock runtime in milliseconds. */
  maxRuntimeMs: number;
  /** Max retry attempts for failed operations. */
  maxRetryAttempts: number;
  /** Max web_search tool calls. */
  maxWebSearchCalls: number;
  /** Max web_fetch tool calls. */
  maxWebFetchCalls: number;
  /** Max subagent spawns. */
  maxSubagentSpawns: number;
  /** Whether browser tools are allowed. */
  browserEnabled: boolean;
  /** Preferred model tier (local, standard, premium). */
  preferredModelTier: "local" | "standard" | "premium";
};

/**
 * A budget profile with its limits and metadata.
 */
export type BudgetProfile = {
  id: BudgetProfileId;
  name: string;
  description: string;
  limits: BudgetLimits;
  /** Whether this profile requires explicit arming. */
  requiresArming: boolean;
};

/**
 * Current usage counters tracked by the governor.
 */
export type BudgetUsage = {
  toolCalls: number;
  llmCalls: number;
  tokensInput: number;
  tokensOutput: number;
  tokensCacheRead: number;
  tokensCacheWrite: number;
  estimatedCostUsd: number;
  runtimeMs: number;
  retryAttempts: number;
  webSearchCalls: number;
  webFetchCalls: number;
  subagentSpawns: number;
  /** Track error signatures for loop detection. */
  errorSignatures: Map<string, number>;
};

/**
 * Result of a budget check.
 */
export type BudgetCheckResult = {
  allowed: boolean;
  /** Which limit was exceeded (if any). */
  exceededLimit?: keyof BudgetLimits | "errorLoopDetected";
  /** Current value of the exceeded metric. */
  currentValue?: number;
  /** Limit value that was exceeded. */
  limitValue?: number;
  /** Human-readable message. */
  message?: string;
  /** Suggested action. */
  suggestion?: "stop" | "ask_escalate" | "continue";
};

/**
 * Budget status snapshot for reporting.
 */
export type BudgetStatus = {
  profileId: BudgetProfileId;
  profileName: string;
  usage: BudgetUsage;
  limits: BudgetLimits;
  percentages: {
    toolCalls: number;
    llmCalls: number;
    tokens: number;
    cost: number;
    runtime: number;
  };
  isArmed: boolean;
  startedAt: number;
  /** When deep mode expires (if armed with timeout). */
  deepExpiresAt?: number;
  /** Whether deep mode is one-run only. */
  deepOneRun?: boolean;
};

/**
 * Deep mode arming options for auto-revert.
 */
export type DeepArmOptions = {
  /** Duration in milliseconds before deep mode auto-reverts. Default 30 minutes. */
  expiresInMs?: number;
  /** Whether deep mode expires after one run (workflow completion). */
  oneRun?: boolean;
};

/** Default deep mode expiry: 30 minutes. */
export const DEEP_MODE_DEFAULT_EXPIRY_MS = 30 * 60 * 1000;

/**
 * Options for creating a BudgetGovernor instance.
 */
export type BudgetGovernorOptions = {
  /** Budget profile to use. */
  profileId?: BudgetProfileId;
  /** Override specific limits. */
  limitOverrides?: Partial<BudgetLimits>;
  /** Whether deep mode is armed (required for deep profile). */
  deepArmed?: boolean;
  /** Deep mode expiry options (only used when deepArmed=true). */
  deepArmOptions?: DeepArmOptions;
  /** Callback when a limit is exceeded. */
  onLimitExceeded?: (result: BudgetCheckResult) => void;
  /** Callback for usage updates. */
  onUsageUpdate?: (usage: BudgetUsage) => void;
  /** Callback when deep mode auto-reverts. */
  onDeepReverted?: () => void;
};

/**
 * Configuration for budget governance.
 */
export type BudgetConfig = {
  /** Default budget profile. */
  defaultProfile?: BudgetProfileId;
  /** Per-agent profile overrides. */
  agentProfiles?: Record<string, BudgetProfileId>;
  /** Custom profile limit overrides. */
  profileOverrides?: Partial<Record<BudgetProfileId, Partial<BudgetLimits>>>;
  /** Whether to auto-escalate on limit (vs. hard stop). */
  autoEscalate?: boolean;
  /** Model cost configuration for USD estimates. */
  modelCosts?: Record<string, { input: number; output: number }>;
};

/**
 * Event types emitted by the budget governor.
 */
export type BudgetEvent =
  | { type: "usage_update"; usage: BudgetUsage }
  | { type: "limit_warning"; result: BudgetCheckResult; percentUsed: number }
  | { type: "limit_exceeded"; result: BudgetCheckResult }
  | { type: "error_loop_detected"; signature: string; count: number }
  | { type: "workflow_complete"; usage: BudgetUsage; durationMs: number }
  | { type: "deep_reverted"; reason: "timeout" | "oneRun" };
