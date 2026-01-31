import {
  getOpencodeZenStaticFallbackModels,
  OPENCODE_ZEN_API_BASE_URL,
  OPENCODE_ZEN_DEFAULT_MODEL_REF,
} from "../agents/opencode-zen-models.js";
import type { OpenClawConfig } from "../config/config.js";

/**
 * Apply OpenCode Zen provider configuration without changing the default model.
 * Registers OpenCode Zen models and sets up the provider, but preserves existing model selection.
 */
export function applyOpencodeZenProviderConfig(cfg: OpenClawConfig): OpenClawConfig {
  const models = { ...cfg.agents?.defaults?.models };
  models[OPENCODE_ZEN_DEFAULT_MODEL_REF] = {
    ...models[OPENCODE_ZEN_DEFAULT_MODEL_REF],
    alias: models[OPENCODE_ZEN_DEFAULT_MODEL_REF]?.alias ?? "Opus",
  };

  const providers = { ...cfg.models?.providers };
  const existingProvider = providers.opencode;
  const existingModels = Array.isArray(existingProvider?.models) ? existingProvider.models : [];

  // Use static fallback models for initial configuration
  const opencodeModels = getOpencodeZenStaticFallbackModels();
  const mergedModels = [
    ...existingModels,
    ...opencodeModels.filter(
      (model) => !existingModels.some((existing) => existing.id === model.id),
    ),
  ];

  const { apiKey: existingApiKey, ...existingProviderRest } = (existingProvider ?? {}) as Record<
    string,
    unknown
  > as { apiKey?: string };
  const resolvedApiKey = typeof existingApiKey === "string" ? existingApiKey : undefined;
  const normalizedApiKey = resolvedApiKey?.trim();

  providers.opencode = {
    ...existingProviderRest,
    baseUrl: OPENCODE_ZEN_API_BASE_URL,
    api: "openai-completions",
    ...(normalizedApiKey ? { apiKey: normalizedApiKey } : {}),
    models: mergedModels.length > 0 ? mergedModels : opencodeModels,
  };

  return {
    ...cfg,
    agents: {
      ...cfg.agents,
      defaults: {
        ...cfg.agents?.defaults,
        models,
      },
    },
    models: {
      mode: cfg.models?.mode ?? "merge",
      providers,
    },
  };
}

/**
 * Apply OpenCode Zen provider configuration AND set OpenCode Zen as the default model.
 * Use this when OpenCode Zen is the primary provider choice during onboarding.
 */
export function applyOpencodeZenConfig(cfg: OpenClawConfig): OpenClawConfig {
  const next = applyOpencodeZenProviderConfig(cfg);
  const existingModel = next.agents?.defaults?.model;
  return {
    ...next,
    agents: {
      ...next.agents,
      defaults: {
        ...next.agents?.defaults,
        model: {
          ...(existingModel && "fallbacks" in (existingModel as Record<string, unknown>)
            ? {
                fallbacks: (existingModel as { fallbacks?: string[] }).fallbacks,
              }
            : undefined),
          primary: OPENCODE_ZEN_DEFAULT_MODEL_REF,
        },
      },
    },
  };
}
