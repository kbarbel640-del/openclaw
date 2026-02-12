import type { GatewayBrowserClient } from "../gateway.ts";

export type UsageWindowEntry = {
  label: string;
  usedPercent: number;
  resetAt: number | null;
  resetRemainingMs: number | null;
};

export type ModelCostTier = "free" | "cheap" | "moderate" | "expensive";

export type ProviderModelEntry = {
  id: string;
  name: string;
  key: string;
  contextWindow?: number;
  reasoning?: boolean;
  input?: string[];
  costTier: ModelCostTier;
};

export type ProviderHealthEntry = {
  id: string;
  name: string;
  detected: boolean;
  authSource: string | null;
  authMode: string;
  tokenValidity: string;
  tokenExpiresAt: number | null;
  tokenRemainingMs: number | null;
  healthStatus: string;
  inCooldown: boolean;
  cooldownRemainingMs: number;
  cooldownEndsAt: number | null;
  errorCount: number;
  disabledReason?: string;
  lastUsed: string | null;
  usageWindows: UsageWindowEntry[];
  usagePlan?: string;
  usageError?: string;
  isLocal: boolean;
  models: ProviderModelEntry[];
  authModes?: string[];
  envVars?: string[];
  configured?: boolean;
  oauthAvailable?: boolean;
};

export type ProvidersHealthHost = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  tab: string;
  providersHealthLoading: boolean;
  providersHealthError: string | null;
  providersHealthEntries: ProviderHealthEntry[];
  providersHealthUpdatedAt: number | null;
  providersHealthShowAll: boolean;
  providersHealthExpanded: string | null;
  providersModelAllowlist: Set<string>;
  providersPrimaryModel: string | null;
  providersModelFallbacks: string[];
  providersCodingModelPrimary: string | null;
  providersModelAutoPickFromPool: boolean;
  providersConfigHash: string | null;
  providersModelsSaving: boolean;
  providersModelsDirty: boolean;
  providersModelsCostFilter: "all" | "high" | "medium" | "low" | "free";
};

type RawEntry = {
  id: string;
  name: string;
  detected: boolean;
  authSource?: string;
  authMode?: string;
  tokenValidity?: string;
  tokenExpiresAt?: number;
  tokenRemainingMs?: number;
  healthStatus: string;
  inCooldown?: boolean;
  cooldownRemainingMs?: number;
  cooldownEndsAt?: number;
  errorCount?: number;
  disabledReason?: string;
  lastUsed?: string;
  usageWindows?: Array<{ label: string; usedPercent: number; resetAt?: number }>;
  usagePlan?: string;
  usageError?: string;
  isLocal?: boolean;
  authModes?: string[];
  envVars?: string[];
  configured?: boolean;
  oauthAvailable?: boolean;
};

function mapEntry(raw: RawEntry, models: ProviderModelEntry[] = []): ProviderHealthEntry {
  const now = Date.now();
  return {
    id: raw.id,
    name: raw.name,
    detected: raw.detected,
    authSource: raw.authSource ?? null,
    authMode: raw.authMode ?? "unknown",
    tokenValidity: raw.tokenValidity ?? "unknown",
    tokenExpiresAt: raw.tokenExpiresAt ?? null,
    tokenRemainingMs: raw.tokenRemainingMs ?? null,
    healthStatus: raw.healthStatus,
    inCooldown: raw.inCooldown ?? false,
    cooldownRemainingMs: raw.cooldownRemainingMs ?? 0,
    cooldownEndsAt: raw.cooldownEndsAt ?? null,
    errorCount: raw.errorCount ?? 0,
    disabledReason: raw.disabledReason,
    lastUsed: raw.lastUsed ?? null,
    usageWindows: (raw.usageWindows ?? []).map((w) => ({
      label: w.label,
      usedPercent: w.usedPercent,
      resetAt: w.resetAt ?? null,
      resetRemainingMs: w.resetAt ? Math.max(0, w.resetAt - now) : null,
    })),
    usagePlan: raw.usagePlan,
    usageError: raw.usageError,
    isLocal: raw.isLocal ?? false,
    models,
    authModes: raw.authModes,
    envVars: raw.envVars,
    configured: raw.configured,
    oauthAvailable: raw.oauthAvailable,
  };
}

let requestGeneration = 0;

type RawModel = {
  id: string;
  name?: string;
  provider?: string;
  contextWindow?: number;
  reasoning?: boolean;
  input?: string[];
};

// Client-side cost tier lookup based on well-known model IDs.
// Mirrors MODEL_CAPABILITIES_REGISTRY from src/agents/model-capabilities.ts.
const COST_TIER_PATTERNS: Array<{ pattern: string; tier: ModelCostTier }> = [
  // Expensive (powerful models)
  { pattern: "claude-opus", tier: "expensive" },
  { pattern: "claude-3-opus", tier: "expensive" },
  { pattern: "o1-preview", tier: "expensive" },
  { pattern: "o1-2024", tier: "expensive" },
  { pattern: "gemini-exp", tier: "expensive" },
  // Moderate
  { pattern: "claude-sonnet", tier: "moderate" },
  { pattern: "claude-3-5-sonnet", tier: "moderate" },
  { pattern: "claude-3-sonnet", tier: "moderate" },
  { pattern: "gpt-4o-2024", tier: "moderate" },
  { pattern: "gpt-4-turbo", tier: "moderate" },
  { pattern: "gpt-4", tier: "moderate" },
  { pattern: "o1-mini", tier: "moderate" },
  { pattern: "o3-mini", tier: "moderate" },
  { pattern: "gemini-1.5-pro", tier: "moderate" },
  { pattern: "gemini-2.0-flash-thinking", tier: "moderate" },
  { pattern: "gemini-2.5-pro", tier: "moderate" },
  { pattern: "gemini-3-pro", tier: "moderate" },
  { pattern: "mistral-large", tier: "moderate" },
  { pattern: "mistral-medium", tier: "moderate" },
  { pattern: "codestral", tier: "moderate" },
  { pattern: "grok-2", tier: "moderate" },
  { pattern: "grok-beta", tier: "moderate" },
  { pattern: "command-r-plus", tier: "moderate" },
  { pattern: "deepseek-reasoner", tier: "moderate" },
  // Cheap (fast/small models)
  { pattern: "claude-3-5-haiku", tier: "cheap" },
  { pattern: "claude-3-haiku", tier: "cheap" },
  { pattern: "gpt-4o-mini", tier: "cheap" },
  { pattern: "gpt-3.5", tier: "cheap" },
  { pattern: "gemini-2.0-flash", tier: "cheap" },
  { pattern: "gemini-2.5-flash", tier: "cheap" },
  { pattern: "gemini-3-flash", tier: "cheap" },
  { pattern: "gemini-1.5-flash", tier: "cheap" },
  { pattern: "llama", tier: "cheap" },
  { pattern: "mixtral", tier: "cheap" },
  { pattern: "mistral-small", tier: "cheap" },
  { pattern: "deepseek-chat", tier: "cheap" },
  { pattern: "deepseek-coder", tier: "cheap" },
  { pattern: "command-r", tier: "cheap" },
  { pattern: "qwen", tier: "cheap" },
];

function resolveModelCostTier(modelId: string): ModelCostTier {
  const lower = modelId.toLowerCase();
  // OpenRouter free-tier models have ":free" suffix
  if (lower.endsWith(":free")) {
    return "free";
  }
  for (const { pattern, tier } of COST_TIER_PATTERNS) {
    if (lower.startsWith(pattern) || lower.includes(pattern)) {
      return tier;
    }
  }
  return "moderate";
}

// Lightweight loader for the primary model (used in header display).
// Loads only the model config, not full providers health.
export async function loadPrimaryModel(
  host: Pick<
    ProvidersHealthHost,
    | "client"
    | "connected"
    | "providersPrimaryModel"
    | "providersModelFallbacks"
    | "providersCodingModelPrimary"
    | "providersModelAutoPickFromPool"
  >,
): Promise<void> {
  if (!host.client || !host.connected) {
    return;
  }
  try {
    const configRes = await host.client.request("config.get", {});
    const config = (configRes as { config?: Record<string, unknown> } | null)?.config;
    const agentsDefaults = (config?.agents as { defaults?: Record<string, unknown> } | undefined)
      ?.defaults;
    const primaryRaw = agentsDefaults?.model;
    host.providersPrimaryModel =
      typeof primaryRaw === "string"
        ? primaryRaw
        : ((primaryRaw as { primary?: string } | undefined)?.primary ?? null);
    const modelConfig = primaryRaw as { fallbacks?: string[] } | undefined;
    host.providersModelFallbacks = Array.isArray(modelConfig?.fallbacks)
      ? modelConfig.fallbacks
      : [];

    const codingRaw = agentsDefaults?.codingModel as { primary?: string } | string | undefined;
    host.providersCodingModelPrimary =
      typeof codingRaw === "string"
        ? codingRaw
        : ((codingRaw as { primary?: string } | undefined)?.primary ?? null);

    const mbc = agentsDefaults?.modelByComplexity as { autoPickFromPool?: boolean } | undefined;
    host.providersModelAutoPickFromPool = Boolean(mbc?.autoPickFromPool === true);
  } catch {
    // Ignore errors - header will just not show model
  }
}

export async function loadProvidersHealth(host: ProvidersHealthHost): Promise<void> {
  if (!host.client || !host.connected) {
    return;
  }
  if (host.providersHealthLoading) {
    return;
  }
  host.providersHealthLoading = true;
  host.providersHealthError = null;
  const gen = ++requestGeneration;
  try {
    const [healthRes, modelsRes, configRes] = await Promise.all([
      host.client.request("providers.health", {
        all: host.providersHealthShowAll,
        includeUsage: true,
      }),
      host.client.request("models.list", {}).catch(() => ({ models: [] })),
      host.client.request("config.get", {}).catch(() => null),
    ]);
    if (gen !== requestGeneration) {
      return;
    }

    // Extract allowlist and primary model from config.
    // Skip overwriting when the user has unsaved model changes (dirty flag).
    const config = (configRes as { config?: Record<string, unknown> } | null)?.config;
    const agentsDefaults = (config?.agents as { defaults?: Record<string, unknown> } | undefined)
      ?.defaults;
    if (!host.providersModelsDirty) {
      const allowlistRecord = (agentsDefaults?.models ?? {}) as Record<string, unknown>;
      host.providersModelAllowlist = new Set(Object.keys(allowlistRecord));
      const primaryRaw = agentsDefaults?.model;
      host.providersPrimaryModel =
        typeof primaryRaw === "string"
          ? primaryRaw
          : ((primaryRaw as { primary?: string } | undefined)?.primary ?? null);
      // Extract fallbacks array from config
      const modelConfig = primaryRaw as { fallbacks?: string[] } | undefined;
      host.providersModelFallbacks = Array.isArray(modelConfig?.fallbacks)
        ? modelConfig.fallbacks
        : [];
    }
    host.providersConfigHash = (configRes as { hash?: string } | null)?.hash ?? null;

    // Group models by provider
    const modelsByProvider = new Map<string, ProviderModelEntry[]>();
    const rawModels = (modelsRes as { models?: RawModel[] }).models ?? [];
    for (const m of rawModels) {
      const provider = String(m.provider ?? "").toLowerCase();
      if (!provider) {
        continue;
      }
      const key = `${provider}/${m.id}`;
      const list = modelsByProvider.get(provider) ?? [];
      list.push({
        id: m.id,
        name: m.name ?? m.id,
        key,
        contextWindow: m.contextWindow,
        reasoning: m.reasoning,
        input: m.input,
        costTier: resolveModelCostTier(m.id),
      });
      modelsByProvider.set(provider, list);
    }

    const data = healthRes as { providers?: RawEntry[]; updatedAt?: number } | undefined;
    if (data && Array.isArray(data.providers)) {
      host.providersHealthEntries = data.providers.map((raw) =>
        mapEntry(raw, modelsByProvider.get(raw.id.toLowerCase()) ?? []),
      );
      host.providersHealthUpdatedAt = typeof data.updatedAt === "number" ? data.updatedAt : null;
    }
  } catch (err) {
    if (gen !== requestGeneration) {
      return;
    }
    host.providersHealthError = String(err);
  } finally {
    if (gen === requestGeneration) {
      host.providersHealthLoading = false;
    }
  }
}

// Cost tier priority for auto-selection (lower number = higher priority)
const COST_TIER_PRIORITY: Record<ModelCostTier, number> = {
  free: 0,
  cheap: 1,
  moderate: 2,
  expensive: 3,
};

export async function saveModelSelection(host: ProvidersHealthHost): Promise<void> {
  if (!host.client || !host.providersConfigHash) {
    return;
  }
  host.providersModelsSaving = true;
  try {
    const models: Record<string, object> = {};
    for (const key of host.providersModelAllowlist) {
      models[key] = {};
    }

    // If no primary model is selected, auto-select the cheapest model from allowlist
    let primaryModel = host.providersPrimaryModel;
    if (!primaryModel && host.providersModelAllowlist.size > 0) {
      // Build a list of models in allowlist with their cost tiers
      const allowlistModels: Array<{ key: string; costTier: ModelCostTier }> = [];
      for (const entry of host.providersHealthEntries) {
        if (!entry.detected) {
          continue;
        }
        for (const model of entry.models) {
          if (host.providersModelAllowlist.has(model.key)) {
            allowlistModels.push({ key: model.key, costTier: model.costTier });
          }
        }
      }
      // Sort by cost tier (cheapest first)
      allowlistModels.sort(
        (a, b) => COST_TIER_PRIORITY[a.costTier] - COST_TIER_PRIORITY[b.costTier],
      );
      if (allowlistModels.length > 0) {
        primaryModel = allowlistModels[0].key;
        host.providersPrimaryModel = primaryModel;
      }
    }

    // Build fallbacks from allowlist excluding primary model
    const fallbacks: string[] = [];
    if (primaryModel) {
      for (const key of host.providersModelAllowlist) {
        if (key !== primaryModel) {
          fallbacks.push(key);
        }
      }
    }

    const patch: Record<string, unknown> = {
      agents: {
        defaults: {
          models: Object.keys(models).length > 0 ? models : null,
          ...(primaryModel ? { model: { primary: primaryModel, fallbacks } } : {}),
        },
      },
    };

    await host.client.request("config.patch", {
      raw: JSON.stringify(patch),
      baseHash: host.providersConfigHash,
      note: "Model selection updated from Providers UI",
    });

    // Clear dirty flag before reloading so the fresh config is accepted
    host.providersModelsDirty = false;

    // Reload to get new hash and updated fallbacks
    await loadProvidersHealth(host);
  } catch (err) {
    host.providersHealthError = String(err);
  } finally {
    host.providersModelsSaving = false;
  }
}

export async function saveComposerTaskModelPreferences(
  host: ProvidersHealthHost,
  params: { thinkingModel?: string | null; codingModel?: string | null },
): Promise<void> {
  if (!host.client || !host.connected) {
    return;
  }

  const hasThinking = "thinkingModel" in params;
  const hasCoding = "codingModel" in params;
  if (!hasThinking && !hasCoding) {
    return;
  }

  const configRes = await host.client.request("config.get", {});
  const configSnapshot = configRes as { config?: Record<string, unknown>; hash?: string } | null;
  const baseHash = configSnapshot?.hash ?? null;
  if (!baseHash) {
    throw new Error("Config hash missing; reload and retry.");
  }

  const config = configSnapshot?.config ?? {};
  const agentsDefaults = (config.agents as { defaults?: Record<string, unknown> } | undefined)
    ?.defaults;
  const existingModels = (agentsDefaults?.models ?? {}) as Record<string, unknown>;
  const allowlist = new Set<string>(Object.keys(existingModels));

  const thinkingModel = params.thinkingModel?.trim();
  const codingModel = params.codingModel?.trim();
  if (thinkingModel) {
    allowlist.add(thinkingModel);
  }
  if (codingModel) {
    allowlist.add(codingModel);
  }

  const defaultsPatch: Record<string, unknown> = {};
  if (hasThinking && thinkingModel) {
    defaultsPatch.model = { primary: thinkingModel };
    host.providersPrimaryModel = thinkingModel;
  }
  if (hasCoding && codingModel) {
    defaultsPatch.codingModel = { primary: codingModel };
    host.providersCodingModelPrimary = codingModel;
  }

  if (allowlist.size > 0) {
    const models: Record<string, object> = {};
    for (const key of allowlist) {
      models[key] = {};
    }
    defaultsPatch.models = models;
    host.providersModelAllowlist = allowlist;
  }

  if (Object.keys(defaultsPatch).length === 0) {
    return;
  }

  await host.client.request("config.patch", {
    raw: JSON.stringify({
      agents: {
        defaults: defaultsPatch,
      },
    }),
    baseHash,
    note: "Composer model selectors updated defaults",
  });

  await loadPrimaryModel(host);
}

// --- Polling (30s RPC refresh) ---

let pollInterval: ReturnType<typeof setInterval> | null = null;

export function startProvidersPolling(host: ProvidersHealthHost): void {
  stopProvidersPolling();
  void loadProvidersHealth(host);
  pollInterval = setInterval(() => {
    if (host.tab !== "providers") {
      return;
    }
    void loadProvidersHealth(host);
  }, 30_000);
}

export function stopProvidersPolling(): void {
  if (pollInterval != null) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

// --- Countdown (1s client-side timer decrement) ---

let countdownInterval: ReturnType<typeof setInterval> | null = null;

export function startProvidersCountdown(host: ProvidersHealthHost): void {
  stopProvidersCountdown();
  countdownInterval = setInterval(() => {
    if (host.providersHealthEntries.length === 0) {
      return;
    }
    const now = Date.now();
    let changed = false;
    const next = host.providersHealthEntries.map((entry) => {
      let updated = false;
      let healthStatus = entry.healthStatus;

      // Recompute token remaining from absolute timestamp
      let tokenRemainingMs = entry.tokenRemainingMs;
      if (entry.tokenExpiresAt !== null) {
        const remaining = Math.max(0, entry.tokenExpiresAt - now);
        if (remaining !== tokenRemainingMs) {
          tokenRemainingMs = remaining;
          updated = true;
          if (remaining === 0 && healthStatus !== "expired") {
            healthStatus = "expired";
          }
        }
      }

      // Recompute cooldown remaining from absolute timestamp
      let cooldownRemainingMs = entry.cooldownRemainingMs;
      if (entry.cooldownEndsAt !== null) {
        const remaining = Math.max(0, entry.cooldownEndsAt - now);
        if (remaining !== cooldownRemainingMs) {
          cooldownRemainingMs = remaining;
          updated = true;
          if (remaining === 0 && healthStatus === "cooldown") {
            healthStatus = "healthy";
          }
        }
      }

      // Recompute usage window reset remaining from absolute timestamp
      const usageWindows = entry.usageWindows.map((w) => {
        if (w.resetAt !== null) {
          const remaining = Math.max(0, w.resetAt - now);
          if (remaining !== w.resetRemainingMs) {
            updated = true;
            return { ...w, resetRemainingMs: remaining };
          }
        }
        return w;
      });

      if (updated) {
        changed = true;
        return {
          ...entry,
          tokenRemainingMs,
          cooldownRemainingMs,
          healthStatus,
          usageWindows,
        };
      }
      return entry;
    });

    if (changed) {
      host.providersHealthEntries = next;
    }
  }, 1000);
}

export function stopProvidersCountdown(): void {
  if (countdownInterval != null) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}
