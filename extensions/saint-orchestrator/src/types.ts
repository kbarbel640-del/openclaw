import type { AnyAgentTool } from "openclaw/plugin-sdk";

export type ToolPolicy = { allow?: string[]; deny?: string[] };

export type SystemPromptIncludes = {
  bootstrap?: string[];
  inject?: string[];
};

export type TierFileAccess = {
  read?: string[];
  write?: string[];
  deny_write?: string[];
};

export type TierConfig = {
  description?: string;
  tools?: string[];
  deny_tools?: string[];
  exec_blocklist?: string[];
  memory_scope?: string[];
  skills?: "*" | string[];
  max_budget_usd?: number | null;
  system_prompt_includes?: SystemPromptIncludes;
  file_access?: TierFileAccess;
  sessions_scope?: "all" | "own";
  model?: string;
};

export type ExternalTierConfig = TierConfig | { ceiling?: TierConfig; effective?: TierConfig };

export type TierFile = {
  fixed?: {
    owner?: TierConfig;
    external?: ExternalTierConfig;
  };
  custom?: Record<string, TierConfig>;
};

export type Contact = {
  slug: string;
  name?: string;
  tier?: string;
  identifiers?: Record<string, string>;
};

export type ContactsFile = {
  contacts?: Contact[];
};

export type ResolvedTier = {
  tierName: string;
  tier: TierConfig;
  contactSlug: string;
  contactName?: string;
  source: "contact" | "external" | "subagent" | "cron" | "fallback";
};

export type TierSet = {
  owner: TierConfig;
  externalCeiling: TierConfig;
  externalEffective: TierConfig;
  custom: Record<string, TierConfig>;
};

export type SaintState = {
  contacts: Contact[];
  tiers: TierSet;
};

export type SessionTierState = {
  workspaceDir: string;
  peerId?: string;
  senderE164?: string;
  tier: ResolvedTier;
  updatedAtMs: number;
};

export type UsageLogEntry = {
  ts: string;
  user: string;
  tier: string;
  tool: string;
  params?: Record<string, unknown>;
  durationMs?: number;
  error?: string;
  estimatedCostUsd?: number;
};

export type SaintToolContext = {
  workspaceDir?: string;
  agentWorkspaceDir?: string;
  sessionKey?: string;
  messageChannel?: string;
  peerId?: string;
  senderE164?: string;
};

export type ToolExecutionResult = Awaited<ReturnType<NonNullable<AnyAgentTool["execute"]>>>;

export type ValidationResult = {
  ok: boolean;
  errors: string[];
};
