import type { NormalizedUsage } from "../agents/usage.js";

export type CostBreakdown = {
  total?: number;
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
};

export type ParsedUsageEntry = {
  usage: NormalizedUsage;
  costTotal?: number;
  costBreakdown?: CostBreakdown;
  provider?: string;
  model?: string;
  timestamp?: Date;
};

export type ParsedTranscriptEntry = {
  message: Record<string, unknown>;
  role?: "user" | "assistant";
  timestamp?: Date;
  durationMs?: number;
  usage?: NormalizedUsage;
  costTotal?: number;
  costBreakdown?: CostBreakdown;
  provider?: string;
  model?: string;
  stopReason?: string;
  toolNames: string[];
  toolResultCounts: { total: number; errors: number };
};

export type CostUsageTotals = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  totalCost: number;
  // Cost breakdown by token type (from actual API data when available)
  inputCost: number;
  outputCost: number;
  cacheReadCost: number;
  cacheWriteCost: number;
  missingCostEntries: number;
};

export type CostUsageDailyEntry = CostUsageTotals & {
  date: string;
};

export type CostUsageSummary = {
  updatedAt: number;
  days: number;
  daily: CostUsageDailyEntry[];
  totals: CostUsageTotals;
};

export type SessionDailyUsage = {
  date: string; // YYYY-MM-DD
  tokens: number;
  cost: number;
};

export type SessionDailyMessageCounts = {
  date: string; // YYYY-MM-DD
  total: number;
  user: number;
  assistant: number;
  toolCalls: number;
  toolResults: number;
  errors: number;
};

export type SessionLatencyStats = {
  count: number;
  avgMs: number;
  p95Ms: number;
  minMs: number;
  maxMs: number;
};

export type SessionDailyLatency = SessionLatencyStats & {
  date: string; // YYYY-MM-DD
};

export type SessionDailyModelUsage = {
  date: string; // YYYY-MM-DD
  provider?: string;
  model?: string;
  tokens: number;
  cost: number;
  count: number;
};

export type SessionMessageCounts = {
  total: number;
  user: number;
  assistant: number;
  toolCalls: number;
  toolResults: number;
  errors: number;
};

export type SessionToolUsage = {
  totalCalls: number;
  uniqueTools: number;
  tools: Array<{ name: string; count: number }>;
};

export type SessionModelUsage = {
  provider?: string;
  model?: string;
  count: number;
  totals: CostUsageTotals;
};

export type SessionCostSummary = CostUsageTotals & {
  sessionId?: string;
  sessionFile?: string;
  firstActivity?: number;
  lastActivity?: number;
  durationMs?: number;
  activityDates?: string[]; // YYYY-MM-DD dates when session had activity
  dailyBreakdown?: SessionDailyUsage[]; // Per-day token/cost breakdown
  dailyMessageCounts?: SessionDailyMessageCounts[];
  dailyLatency?: SessionDailyLatency[];
  dailyModelUsage?: SessionDailyModelUsage[];
  messageCounts?: SessionMessageCounts;
  toolUsage?: SessionToolUsage;
  modelUsage?: SessionModelUsage[];
  latency?: SessionLatencyStats;
};

export type DiscoveredSession = {
  sessionId: string;
  sessionFile: string;
  mtime: number;
  firstUserMessage?: string;
};

export type SessionUsageTimePoint = {
  timestamp: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  cost: number;
  cumulativeTokens: number;
  cumulativeCost: number;
};

export type SessionUsageTimeSeries = {
  sessionId?: string;
  points: SessionUsageTimePoint[];
};

export type SessionLogEntry = {
  timestamp: number;
  role: "user" | "assistant" | "tool" | "toolResult";
  content: string;
  tokens?: number;
  cost?: number;
};

export type ToolHotspot = {
  toolName: string;
  callCount: number;
  /** Tokens attributed to this tool (input + cacheRead + cacheWrite) */
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  /** Percentage of session total cost */
  costPercentage: number;
};

export type CacheEfficiency = {
  /** cacheRead / (cacheRead + cacheWrite) */
  hitRate: number;
  totalCacheRead: number;
  totalCacheWrite: number;
  cacheReadCost: number;
  cacheWriteCost: number;
  /** What cache reads would cost at full input token price */
  estimatedSavings: number;
};

export type CostlyCall = {
  timestamp: number;
  model: string;
  type: "tool_call" | "reply";
  /** Tools attributed to this call */
  toolsContext: string[];
  inputTokens: number;
  outputTokens: number;
  cacheWrite: number;
  totalCost: number;
};

export type OptimizationHint = {
  severity: "info" | "warning";
  message: string;
};

export type SessionHotspotAnalysis = {
  /** Top token consumers sorted by totalCost desc */
  toolHotspots: ToolHotspot[];
  cacheEfficiency: CacheEfficiency;
  /** Top N calls by cost */
  costliestCalls: CostlyCall[];
  optimizationHints: OptimizationHint[];
  hourlyBreakdown: Array<{
    /** ISO hour prefix e.g. "2026-02-23T14" (UTC) */
    hour: string;
    calls: number;
    tokens: number;
    cost: number;
  }>;
};
