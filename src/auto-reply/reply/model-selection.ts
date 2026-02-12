import type { OpenClawConfig } from "../../config/config.js";
import type { ThinkLevel } from "./directives.js";
import { clearSessionAuthProfileOverride } from "../../agents/auth-profiles/session-override.js";
import { lookupContextTokens } from "../../agents/context.js";
import { DEFAULT_CONTEXT_TOKENS } from "../../agents/defaults.js";
import { extractVersionScore } from "../../agents/model-auto-select.js";
import { getModelCapabilitiesFromCatalog } from "../../agents/model-capabilities.js";
import { loadModelCatalog } from "../../agents/model-catalog.js";
import {
  buildAllowedModelSet,
  buildModelAliasIndex,
  type ModelAliasIndex,
  modelKey,
  normalizeProviderId,
  resolveModelRefFromString,
  resolveThinkingDefault,
} from "../../agents/model-selection.js";
import { classifyComplexity, classifyTask } from "../../agents/task-classifier.js";
import { type SessionEntry, updateSessionStore } from "../../config/sessions.js";
import { applyModelOverrideToSessionEntry } from "../../sessions/model-overrides.js";
import { resolveThreadParentSessionKey } from "../../sessions/session-key-utils.js";

export type ModelDirectiveSelection = {
  provider: string;
  model: string;
  isDefault: boolean;
  alias?: string;
};

type ModelCatalog = Awaited<ReturnType<typeof loadModelCatalog>>;

type ModelSelectionState = {
  provider: string;
  model: string;
  allowedModelKeys: Set<string>;
  allowedModelCatalog: ModelCatalog;
  resetModelOverride: boolean;
  resolveDefaultThinkingLevel: () => Promise<ThinkLevel>;
  needsModelCatalog: boolean;
};

const FUZZY_VARIANT_TOKENS = [
  "lightning",
  "preview",
  "mini",
  "fast",
  "turbo",
  "lite",
  "beta",
  "small",
  "nano",
];

function boundedLevenshteinDistance(a: string, b: string, maxDistance: number): number | null {
  if (a === b) {
    return 0;
  }
  if (!a || !b) {
    return null;
  }
  const aLen = a.length;
  const bLen = b.length;
  if (Math.abs(aLen - bLen) > maxDistance) {
    return null;
  }

  // Standard DP with early exit. O(maxDistance * minLen) in common cases.
  const prev = Array.from({ length: bLen + 1 }, (_, idx) => idx);
  const curr = Array.from({ length: bLen + 1 }, () => 0);

  for (let i = 1; i <= aLen; i++) {
    curr[0] = i;
    let rowMin = curr[0];

    const aChar = a.charCodeAt(i - 1);
    for (let j = 1; j <= bLen; j++) {
      const cost = aChar === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) {
        rowMin = curr[j];
      }
    }

    if (rowMin > maxDistance) {
      return null;
    }

    for (let j = 0; j <= bLen; j++) {
      prev[j] = curr[j] ?? 0;
    }
  }

  const dist = prev[bLen] ?? null;
  if (dist == null || dist > maxDistance) {
    return null;
  }
  return dist;
}

type StoredModelOverride = {
  provider?: string;
  model: string;
  source: "session" | "parent";
};

function resolveModelOverrideFromEntry(entry?: SessionEntry): {
  provider?: string;
  model: string;
} | null {
  const model = entry?.modelOverride?.trim();
  if (!model) {
    return null;
  }
  const provider = entry?.providerOverride?.trim() || undefined;
  return { provider, model };
}

function resolveParentSessionKeyCandidate(params: {
  sessionKey?: string;
  parentSessionKey?: string;
}): string | null {
  const explicit = params.parentSessionKey?.trim();
  if (explicit && explicit !== params.sessionKey) {
    return explicit;
  }
  const derived = resolveThreadParentSessionKey(params.sessionKey);
  if (derived && derived !== params.sessionKey) {
    return derived;
  }
  return null;
}

function resolveStoredModelOverride(params: {
  sessionEntry?: SessionEntry;
  sessionStore?: Record<string, SessionEntry>;
  sessionKey?: string;
  parentSessionKey?: string;
}): StoredModelOverride | null {
  const direct = resolveModelOverrideFromEntry(params.sessionEntry);
  if (direct) {
    return { ...direct, source: "session" };
  }
  const parentKey = resolveParentSessionKeyCandidate({
    sessionKey: params.sessionKey,
    parentSessionKey: params.parentSessionKey,
  });
  if (!parentKey || !params.sessionStore) {
    return null;
  }
  const parentEntry = params.sessionStore[parentKey];
  const parentOverride = resolveModelOverrideFromEntry(parentEntry);
  if (!parentOverride) {
    return null;
  }
  return { ...parentOverride, source: "parent" };
}

function scoreFuzzyMatch(params: {
  provider: string;
  model: string;
  fragment: string;
  aliasIndex: ModelAliasIndex;
  defaultProvider: string;
  defaultModel: string;
}): {
  score: number;
  isDefault: boolean;
  variantCount: number;
  variantMatchCount: number;
  modelLength: number;
  key: string;
} {
  const provider = normalizeProviderId(params.provider);
  const model = params.model;
  const fragment = params.fragment.trim().toLowerCase();
  const providerLower = provider.toLowerCase();
  const modelLower = model.toLowerCase();
  const haystack = `${providerLower}/${modelLower}`;
  const key = modelKey(provider, model);

  const scoreFragment = (
    value: string,
    weights: { exact: number; starts: number; includes: number },
  ) => {
    if (!fragment) {
      return 0;
    }
    let score = 0;
    if (value === fragment) {
      score = Math.max(score, weights.exact);
    }
    if (value.startsWith(fragment)) {
      score = Math.max(score, weights.starts);
    }
    if (value.includes(fragment)) {
      score = Math.max(score, weights.includes);
    }
    return score;
  };

  let score = 0;
  score += scoreFragment(haystack, { exact: 220, starts: 140, includes: 110 });
  score += scoreFragment(providerLower, {
    exact: 180,
    starts: 120,
    includes: 90,
  });
  score += scoreFragment(modelLower, {
    exact: 160,
    starts: 110,
    includes: 80,
  });

  // Best-effort typo tolerance for common near-misses like "claud" vs "claude".
  // Bounded to keep this cheap across large model sets.
  const distModel = boundedLevenshteinDistance(fragment, modelLower, 3);
  if (distModel != null) {
    score += (3 - distModel) * 70;
  }

  const aliases = params.aliasIndex.byKey.get(key) ?? [];
  for (const alias of aliases) {
    score += scoreFragment(alias.toLowerCase(), {
      exact: 140,
      starts: 90,
      includes: 60,
    });
  }

  if (modelLower.startsWith(providerLower)) {
    score += 30;
  }

  const fragmentVariants = FUZZY_VARIANT_TOKENS.filter((token) => fragment.includes(token));
  const modelVariants = FUZZY_VARIANT_TOKENS.filter((token) => modelLower.includes(token));
  const variantMatchCount = fragmentVariants.filter((token) => modelLower.includes(token)).length;
  const variantCount = modelVariants.length;
  if (fragmentVariants.length === 0 && variantCount > 0) {
    score -= variantCount * 30;
  } else if (fragmentVariants.length > 0) {
    if (variantMatchCount > 0) {
      score += variantMatchCount * 40;
    }
    if (variantMatchCount === 0) {
      score -= 20;
    }
  }

  const defaultProvider = normalizeProviderId(params.defaultProvider);
  const isDefault = provider === defaultProvider && model === params.defaultModel;
  if (isDefault) {
    score += 20;
  }

  return {
    score,
    isDefault,
    variantCount,
    variantMatchCount,
    modelLength: modelLower.length,
    key,
  };
}

export async function createModelSelectionState(params: {
  cfg: OpenClawConfig;
  agentCfg: NonNullable<NonNullable<OpenClawConfig["agents"]>["defaults"]> | undefined;
  sessionEntry?: SessionEntry;
  sessionStore?: Record<string, SessionEntry>;
  sessionKey?: string;
  parentSessionKey?: string;
  storePath?: string;
  defaultProvider: string;
  defaultModel: string;
  provider: string;
  model: string;
  hasModelDirective: boolean;
  prompt?: string;
}): Promise<ModelSelectionState> {
  const {
    cfg,
    agentCfg,
    sessionEntry,
    sessionStore,
    sessionKey,
    parentSessionKey,
    storePath,
    defaultProvider,
    defaultModel,
  } = params;

  let provider = params.provider;
  let model = params.model;

  const hasAllowlist = agentCfg?.models && Object.keys(agentCfg.models).length > 0;
  const hasTaskOverride = Boolean(
    params.sessionEntry &&
    (params.sessionEntry.thinkingModelOverride?.trim() ||
      params.sessionEntry.codingModelOverride?.trim()),
  );
  const initialStoredOverride = resolveStoredModelOverride({
    sessionEntry,
    sessionStore,
    sessionKey,
    parentSessionKey,
  });
  const hasStoredOverride = Boolean(initialStoredOverride);
  const needsModelCatalog =
    params.hasModelDirective || hasAllowlist || hasStoredOverride || hasTaskOverride;

  let allowedModelKeys = new Set<string>();
  let allowedModelCatalog: ModelCatalog = [];
  let modelCatalog: ModelCatalog | null = null;
  let resetModelOverride = false;

  if (needsModelCatalog) {
    modelCatalog = await loadModelCatalog({ config: cfg });
    const allowed = buildAllowedModelSet({
      cfg,
      catalog: modelCatalog,
      defaultProvider,
      defaultModel,
    });
    allowedModelCatalog = allowed.allowedCatalog;
    allowedModelKeys = allowed.allowedKeys;
  }

  if (sessionEntry && sessionStore && sessionKey && hasStoredOverride) {
    const overrideProvider = sessionEntry.providerOverride?.trim() || defaultProvider;
    const overrideModel = sessionEntry.modelOverride?.trim();
    if (overrideModel) {
      const key = modelKey(overrideProvider, overrideModel);
      if (allowedModelKeys.size > 0 && !allowedModelKeys.has(key)) {
        const { updated } = applyModelOverrideToSessionEntry({
          entry: sessionEntry,
          selection: { provider: defaultProvider, model: defaultModel, isDefault: true },
        });
        if (updated) {
          sessionStore[sessionKey] = sessionEntry;
          if (storePath) {
            await updateSessionStore(storePath, (store) => {
              store[sessionKey] = sessionEntry;
            });
          }
        }
        resetModelOverride = updated;
      }
    }
  }

  const storedOverride = resolveStoredModelOverride({
    sessionEntry,
    sessionStore,
    sessionKey,
    parentSessionKey,
  });
  if (storedOverride?.model) {
    const candidateProvider = storedOverride.provider || defaultProvider;
    const key = modelKey(candidateProvider, storedOverride.model);
    if (allowedModelKeys.size === 0 || allowedModelKeys.has(key)) {
      provider = candidateProvider;
      model = storedOverride.model;
    }
  }

  // Task/complexity routing:
  // - If an explicit session model override is set (storedOverride), keep it.
  // - If a per-task session override is set (thinkingModelOverride/codingModelOverride), apply it.
  // - Otherwise, apply configured specialized defaults (coding/tool) when present.
  // - If no specialized default exists, auto-pick from the allowlist catalog based on
  //   detected task type and complexity (when possible).
  if (!storedOverride) {
    const prompt = params.prompt?.trim() ?? "";
    const taskType = prompt ? classifyTask(prompt) : "general";
    const complexity = prompt ? classifyComplexity(prompt) : "trivial";

    const aliasIndex = buildModelAliasIndex({ cfg, defaultProvider });
    const resolveConfiguredKey = (
      raw: string,
    ): { provider: string; model: string; key: string } | null => {
      const trimmed = raw.trim();
      if (!trimmed) {
        return null;
      }
      const resolved = resolveModelRefFromString({
        raw: trimmed,
        defaultProvider,
        aliasIndex,
      });
      if (!resolved) {
        return null;
      }
      const key = modelKey(resolved.ref.provider, resolved.ref.model);
      return { provider: resolved.ref.provider, model: resolved.ref.model, key };
    };

    const applySessionTaskOverride = (raw: string): boolean => {
      const parsed = resolveConfiguredKey(raw);
      if (!parsed) {
        return false;
      }
      if (allowedModelKeys.size === 0 || allowedModelKeys.has(parsed.key)) {
        provider = normalizeProviderId(parsed.provider);
        model = parsed.model;
        return true;
      }
      return false;
    };

    // 0) Session-level per-task overrides (do NOT persist modelOverride).
    const rawThinking = sessionEntry?.thinkingModelOverride?.trim() ?? "";
    const rawCodingOverride = sessionEntry?.codingModelOverride?.trim() ?? "";
    const usedTaskOverride =
      (taskType === "reasoning" || taskType === "general") && rawThinking
        ? applySessionTaskOverride(rawThinking)
        : (taskType === "coding" || taskType === "tools") && rawCodingOverride
          ? applySessionTaskOverride(rawCodingOverride)
          : false;

    if (!usedTaskOverride) {
      const rawCoding = cfg.agents?.defaults?.codingModel?.primary?.trim() ?? "";
      const rawTool = cfg.agents?.defaults?.toolModel?.primary?.trim() ?? "";
      const autoPickReasoning = Boolean(
        cfg.agents?.defaults?.modelByComplexity &&
        typeof cfg.agents.defaults.modelByComplexity === "object" &&
        cfg.agents.defaults.modelByComplexity.autoPickFromPool === true,
      );

      const tryApplyConfiguredOverride = (raw: string): boolean => {
        const parsed = resolveConfiguredKey(raw);
        if (!parsed) {
          return false;
        }
        if (allowedModelKeys.size === 0 || allowedModelKeys.has(parsed.key)) {
          provider = normalizeProviderId(parsed.provider);
          model = parsed.model;
          return true;
        }
        return false;
      };

      // 1) Configured specialized defaults
      if (taskType === "coding" && rawCoding) {
        tryApplyConfiguredOverride(rawCoding);
      } else if (taskType === "tools" && rawTool) {
        tryApplyConfiguredOverride(rawTool);
      } else if (taskType === "tools" && !rawTool && rawCoding) {
        // Fallback: tools without a dedicated toolModel use codingModel
        tryApplyConfiguredOverride(rawCoding);
      }

      // 2) Auto-pick from pool (best-effort)
      const canAutoPickFromPool =
        allowedModelCatalog.length > 0 && (taskType !== "general" || prompt);

      const shouldAutoPick =
        // Vision auto-pick to ensure we get a model with image support.
        taskType === "vision" ||
        // Coding/tools auto-pick whenever there is no configured specialized default.
        (taskType === "coding" && !rawCoding) ||
        (taskType === "tools" && !rawTool && !rawCoding) ||
        // Reasoning/general auto-pick only when explicitly enabled.
        ((taskType === "reasoning" || taskType === "general") && autoPickReasoning);

      if (canAutoPickFromPool && shouldAutoPick) {
        const required =
          taskType === "vision"
            ? "vision"
            : taskType === "coding" || taskType === "tools"
              ? "coding"
              : "reasoning";
        const perfOrder: Record<string, number> = { fast: 0, balanced: 1, powerful: 2 };
        const costOrder: Record<string, number> = { free: 0, cheap: 1, moderate: 2, expensive: 3 };

        const preferredPerf = (
          complexity === "trivial"
            ? ["fast", "balanced", "powerful"]
            : complexity === "complex"
              ? ["powerful", "balanced", "fast"]
              : ["balanced", "powerful", "fast"]
        ) as Array<"fast" | "balanced" | "powerful">;

        const ranked = allowedModelCatalog
          .map((entry) => {
            const caps = getModelCapabilitiesFromCatalog(entry);
            const ok =
              required === "vision"
                ? caps.vision
                : required === "coding"
                  ? caps.coding
                  : caps.reasoning;
            if (!ok) {
              return null;
            }
            const prefIdx = preferredPerf.indexOf(caps.performanceTier);
            return {
              entry,
              pref: prefIdx === -1 ? 99 : prefIdx,
              perf: perfOrder[caps.performanceTier] ?? 0,
              cost: costOrder[caps.costTier] ?? 99,
              version: extractVersionScore(entry.id),
            };
          })
          .filter(Boolean)
          .toSorted((a, b) => {
            if (!a || !b) {
              return 0;
            }
            if (a.pref !== b.pref) {
              return a.pref - b.pref;
            }
            if (b.perf !== a.perf) {
              return b.perf - a.perf;
            }
            if (a.cost !== b.cost) {
              return a.cost - b.cost;
            }
            return b.version - a.version;
          });

        const best = ranked[0]?.entry;
        if (best) {
          provider = normalizeProviderId(best.provider);
          model = best.id;
        }
      }
    }
  }

  if (sessionEntry && sessionStore && sessionKey && sessionEntry.authProfileOverride) {
    const { ensureAuthProfileStore } = await import("../../agents/auth-profiles.js");
    const store = ensureAuthProfileStore(undefined, {
      allowKeychainPrompt: false,
    });
    const profile = store.profiles[sessionEntry.authProfileOverride];
    const providerKey = normalizeProviderId(provider);
    if (!profile || normalizeProviderId(profile.provider) !== providerKey) {
      await clearSessionAuthProfileOverride({
        sessionEntry,
        sessionStore,
        sessionKey,
        storePath,
      });
    }
  }

  let defaultThinkingLevel: ThinkLevel | undefined;
  const resolveDefaultThinkingLevel = async () => {
    if (defaultThinkingLevel) {
      return defaultThinkingLevel;
    }
    let catalogForThinking = modelCatalog ?? allowedModelCatalog;
    if (!catalogForThinking || catalogForThinking.length === 0) {
      modelCatalog = await loadModelCatalog({ config: cfg });
      catalogForThinking = modelCatalog;
    }
    const resolved = resolveThinkingDefault({
      cfg,
      provider,
      model,
      catalog: catalogForThinking,
    });
    defaultThinkingLevel =
      resolved ?? (agentCfg?.thinkingDefault as ThinkLevel | undefined) ?? "off";
    return defaultThinkingLevel;
  };

  return {
    provider,
    model,
    allowedModelKeys,
    allowedModelCatalog,
    resetModelOverride,
    resolveDefaultThinkingLevel,
    needsModelCatalog,
  };
}

export function resolveModelDirectiveSelection(params: {
  raw: string;
  defaultProvider: string;
  defaultModel: string;
  aliasIndex: ModelAliasIndex;
  allowedModelKeys: Set<string>;
}): { selection?: ModelDirectiveSelection; error?: string } {
  const { raw, defaultProvider, defaultModel, aliasIndex, allowedModelKeys } = params;

  const rawTrimmed = raw.trim();
  const rawLower = rawTrimmed.toLowerCase();

  const pickAliasForKey = (provider: string, model: string): string | undefined =>
    aliasIndex.byKey.get(modelKey(provider, model))?.[0];

  const buildSelection = (provider: string, model: string): ModelDirectiveSelection => {
    const alias = pickAliasForKey(provider, model);
    return {
      provider,
      model,
      isDefault: provider === defaultProvider && model === defaultModel,
      ...(alias ? { alias } : undefined),
    };
  };

  const resolveFuzzy = (params: {
    provider?: string;
    fragment: string;
  }): { selection?: ModelDirectiveSelection; error?: string } => {
    const fragment = params.fragment.trim().toLowerCase();
    if (!fragment) {
      return {};
    }

    const providerFilter = params.provider ? normalizeProviderId(params.provider) : undefined;

    const candidates: Array<{ provider: string; model: string }> = [];
    for (const key of allowedModelKeys) {
      const slash = key.indexOf("/");
      if (slash <= 0) {
        continue;
      }
      const provider = normalizeProviderId(key.slice(0, slash));
      const model = key.slice(slash + 1);
      if (providerFilter && provider !== providerFilter) {
        continue;
      }
      candidates.push({ provider, model });
    }

    // Also allow partial alias matches when the user didn't specify a provider.
    if (!params.provider) {
      const aliasMatches: Array<{ provider: string; model: string }> = [];
      for (const [aliasKey, entry] of aliasIndex.byAlias.entries()) {
        if (!aliasKey.includes(fragment)) {
          continue;
        }
        aliasMatches.push({
          provider: entry.ref.provider,
          model: entry.ref.model,
        });
      }
      for (const match of aliasMatches) {
        const key = modelKey(match.provider, match.model);
        if (!allowedModelKeys.has(key)) {
          continue;
        }
        if (!candidates.some((c) => c.provider === match.provider && c.model === match.model)) {
          candidates.push(match);
        }
      }
    }

    if (candidates.length === 0) {
      return {};
    }

    const scored = candidates
      .map((candidate) => {
        const details = scoreFuzzyMatch({
          provider: candidate.provider,
          model: candidate.model,
          fragment,
          aliasIndex,
          defaultProvider,
          defaultModel,
        });
        return Object.assign({ candidate }, details);
      })
      .toSorted((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        if (a.isDefault !== b.isDefault) {
          return a.isDefault ? -1 : 1;
        }
        if (a.variantMatchCount !== b.variantMatchCount) {
          return b.variantMatchCount - a.variantMatchCount;
        }
        if (a.variantCount !== b.variantCount) {
          return a.variantCount - b.variantCount;
        }
        if (a.modelLength !== b.modelLength) {
          return a.modelLength - b.modelLength;
        }
        return a.key.localeCompare(b.key);
      });

    const bestScored = scored[0];
    const best = bestScored?.candidate;
    if (!best || !bestScored) {
      return {};
    }

    const minScore = providerFilter ? 90 : 120;
    if (bestScored.score < minScore) {
      return {};
    }

    return { selection: buildSelection(best.provider, best.model) };
  };

  const resolved = resolveModelRefFromString({
    raw: rawTrimmed,
    defaultProvider,
    aliasIndex,
  });

  if (!resolved) {
    const fuzzy = resolveFuzzy({ fragment: rawTrimmed });
    if (fuzzy.selection || fuzzy.error) {
      return fuzzy;
    }
    return {
      error: `Unrecognized model "${rawTrimmed}". Use /models to list providers, or /models <provider> to list models.`,
    };
  }

  const resolvedKey = modelKey(resolved.ref.provider, resolved.ref.model);
  if (allowedModelKeys.size === 0 || allowedModelKeys.has(resolvedKey)) {
    return {
      selection: {
        provider: resolved.ref.provider,
        model: resolved.ref.model,
        isDefault: resolved.ref.provider === defaultProvider && resolved.ref.model === defaultModel,
        alias: resolved.alias,
      },
    };
  }

  // If the user specified a provider/model but the exact model isn't allowed,
  // attempt a fuzzy match within that provider.
  if (rawLower.includes("/")) {
    const slash = rawTrimmed.indexOf("/");
    const provider = normalizeProviderId(rawTrimmed.slice(0, slash).trim());
    const fragment = rawTrimmed.slice(slash + 1).trim();
    const fuzzy = resolveFuzzy({ provider, fragment });
    if (fuzzy.selection || fuzzy.error) {
      return fuzzy;
    }
  }

  // Otherwise, try fuzzy matching across allowlisted models.
  const fuzzy = resolveFuzzy({ fragment: rawTrimmed });
  if (fuzzy.selection || fuzzy.error) {
    return fuzzy;
  }

  return {
    error: `Model "${resolved.ref.provider}/${resolved.ref.model}" is not allowed. Use /models to list providers, or /models <provider> to list models.`,
  };
}

export function resolveContextTokens(params: {
  agentCfg: NonNullable<NonNullable<OpenClawConfig["agents"]>["defaults"]> | undefined;
  model: string;
}): number {
  return (
    params.agentCfg?.contextTokens ?? lookupContextTokens(params.model) ?? DEFAULT_CONTEXT_TOKENS
  );
}
