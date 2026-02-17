/**
 * Types for LLM provider detection and usage monitoring.
 */

/**
 * Authentication source for a provider.
 */
export type AuthSource = "env" | "auth-profile" | "aws-sdk" | "config" | "oauth" | "default" | null;

/**
 * Authentication mode for a provider.
 */
export type AuthMode = "api-key" | "oauth" | "token" | "aws-sdk" | "mixed" | "unknown" | "none";

/**
 * Token validity status.
 */
export type TokenValidity = "valid" | "expiring" | "expired" | "unknown";

/**
 * Status of a detected LLM provider.
 */
export type ProviderStatus = {
  /** Unique provider identifier (e.g., "openai", "anthropic") */
  id: string;
  /** Display name (e.g., "OpenAI", "Anthropic") */
  name: string;
  /** Whether the provider was detected as configured */
  detected: boolean;
  /** How the provider was authenticated */
  authSource: AuthSource;
  /** Details about the authentication (e.g., env var name, profile id) */
  authDetail?: string;
  /** Custom base URL if configured */
  baseUrl?: string;
  /** Authentication mode */
  authMode?: AuthMode;
  /** Error message if detection failed */
  error?: string;
  /** Token validity status */
  tokenValidity?: TokenValidity;
  /** Token expiration timestamp (ISO 8601) */
  tokenExpiresAt?: string;
  /** Time until token expires (human readable) */
  tokenExpiresIn?: string;
  /** Last time the provider was used */
  lastUsed?: string;
  /** Whether the profile is in cooldown (rate limited) */
  inCooldown?: boolean;
  /** Cooldown ends at (ISO 8601) */
  cooldownEndsAt?: string;
};

/**
 * Time period for usage aggregation.
 */
export type UsagePeriod = "today" | "week" | "month" | "all";

/**
 * Aggregated usage statistics for a provider/model.
 */
export type ProviderUsage = {
  /** Provider identifier */
  providerId: string;
  /** Model identifier */
  modelId: string;
  /** Time period for this aggregation */
  period: UsagePeriod;
  /** Total number of requests */
  requests: number;
  /** Total input tokens */
  inputTokens: number;
  /** Total output tokens */
  outputTokens: number;
  /** Total cache read tokens */
  cacheReadTokens?: number;
  /** Total cache write tokens */
  cacheWriteTokens?: number;
  /** Estimated cost in USD */
  estimatedCost: number;
  /** Last usage timestamp (ISO 8601) */
  lastUsed?: string;
};

/**
 * Single usage entry for tracking.
 */
export type UsageEntry = {
  /** Timestamp (ISO 8601) */
  timestamp: string;
  /** Provider identifier */
  providerId: string;
  /** Model identifier */
  modelId: string;
  /** Input tokens used */
  inputTokens: number;
  /** Output tokens used */
  outputTokens: number;
  /** Cache read tokens */
  cacheReadTokens?: number;
  /** Cache write tokens */
  cacheWriteTokens?: number;
  /** Cost in USD */
  cost?: number;
  /** Duration in milliseconds */
  durationMs?: number;
  /** Agent identifier */
  agentId?: string;
  /** Session identifier */
  sessionId?: string;
};

/**
 * Usage store for persisting usage data.
 */
export type UsageStore = {
  /** Store format version */
  version: number;
  /** Usage entries */
  entries: UsageEntry[];
};

/**
 * Totals for usage aggregation.
 */
export type UsageTotals = {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  estimatedCost: number;
};

/**
 * Provider definition for the registry.
 */
export type ProviderDefinition = {
  /** Unique provider identifier */
  id: string;
  /** Display name */
  name: string;
  /** Primary environment variable for API key */
  envVars: string[];
  /** Alternative environment variables */
  altEnvVars?: string[];
  /** Authentication modes supported */
  authModes: AuthMode[];
  /** Whether the provider requires explicit configuration */
  requiresConfig?: boolean;
  /** Default base URL */
  defaultBaseUrl?: string;
  /** Whether this is a local provider (e.g., Ollama) */
  isLocal?: boolean;
  /** Whether this provider requires explicit authentication */
  requiresAuth?: boolean;
  /** Suggested model IDs available for this provider */
  models?: string[];
};

/**
 * Provider cost rates per 1M tokens.
 */
export type ProviderCostRates = {
  providerId: string;
  modelId: string;
  inputPer1M: number;
  outputPer1M: number;
  cacheReadPer1M?: number;
  cacheWritePer1M?: number;
};
