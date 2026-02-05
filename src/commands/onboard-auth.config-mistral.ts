import type { OpenClawConfig } from "../config/config.js";
import type { ModelDefinitionConfig } from "../config/types.js";
import { MISTRAL_DEFAULT_MODEL_REF } from "./onboard-auth.credentials.js";

export const MISTRAL_BASE_URL = "https://api.mistral.ai/v1";

export const MISTRAL_DEFAULT_MODEL_ID = "mistral-large-latest";

// Mistral uses per-token pricing; costs vary by model.
// Set to 0 as a default; users can override in config.
export const MISTRAL_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

export type MistralModelCatalogEntry = {
  id: string;
  name: string;
  reasoning: boolean;
  input: ("text" | "image")[];
  contextWindow: number;
  maxTokens: number;
};

export const MISTRAL_MODEL_CATALOG: MistralModelCatalogEntry[] = [
  {
    id: "mistral-large-latest",
    name: "Mistral Large",
    reasoning: true,
    input: ["text", "image"],
    contextWindow: 256000,
    maxTokens: 8192,
  },
  {
    id: "mistral-medium-latest",
    name: "Mistral Medium",
    reasoning: true,
    input: ["text", "image"],
    contextWindow: 128000,
    maxTokens: 8192,
  },
  {
    id: "mistral-small-latest",
    name: "Mistral Small",
    reasoning: true,
    input: ["text", "image"],
    contextWindow: 128000,
    maxTokens: 8192,
  },
  {
    id: "codestral-latest",
    name: "Codestral",
    reasoning: false,
    input: ["text"],
    contextWindow: 128000,
    maxTokens: 8192,
  },
  {
    id: "devstral-latest",
    name: "Devstral",
    reasoning: false,
    input: ["text"],
    contextWindow: 256000,
    maxTokens: 8192,
  },
  // Voxtral models accept audio input (transcription) - using "text" as output type
  {
    id: "voxtral-mini-latest",
    name: "Voxtral Mini",
    reasoning: false,
    input: ["text"],
    contextWindow: 32000,
    maxTokens: 8192,
  },
  {
    id: "voxtral-mini-transcribe-realtime-latest",
    name: "Voxtral Mini Transcribe Realtime",
    reasoning: false,
    input: ["text"],
    contextWindow: 32000,
    maxTokens: 8192,
  },
  // OCR model for document/image text extraction
  {
    id: "mistral-ocr-latest",
    name: "Mistral OCR",
    reasoning: false,
    input: ["image"],
    contextWindow: 128000,
    maxTokens: 8192,
  },
];

export function buildMistralModelDefinition(
  entry: MistralModelCatalogEntry,
): ModelDefinitionConfig {
  return {
    id: entry.id,
    name: entry.name,
    reasoning: entry.reasoning,
    input: [...entry.input],
    cost: MISTRAL_DEFAULT_COST,
    contextWindow: entry.contextWindow,
    maxTokens: entry.maxTokens,
  };
}

export function applyMistralProviderConfig(cfg: OpenClawConfig): OpenClawConfig {
  const models = { ...cfg.agents?.defaults?.models };
  models[MISTRAL_DEFAULT_MODEL_REF] = {
    ...models[MISTRAL_DEFAULT_MODEL_REF],
    alias: models[MISTRAL_DEFAULT_MODEL_REF]?.alias ?? "Mistral",
  };

  const providers = { ...cfg.models?.providers };
  const existingProvider = providers.mistral;
  const existingModels = Array.isArray(existingProvider?.models) ? existingProvider.models : [];
  const mistralModels = MISTRAL_MODEL_CATALOG.map(buildMistralModelDefinition);
  const mergedModels = [
    ...existingModels,
    ...mistralModels.filter(
      (model) => !existingModels.some((existing) => existing.id === model.id),
    ),
  ];
  const { apiKey: existingApiKey, ...existingProviderRest } = (existingProvider ?? {}) as Record<
    string,
    unknown
  > as { apiKey?: string };
  const resolvedApiKey = typeof existingApiKey === "string" ? existingApiKey : undefined;
  const normalizedApiKey = resolvedApiKey?.trim();
  providers.mistral = {
    ...existingProviderRest,
    baseUrl: MISTRAL_BASE_URL,
    api: "openai-completions",
    ...(normalizedApiKey ? { apiKey: normalizedApiKey } : {}),
    models: mergedModels.length > 0 ? mergedModels : mistralModels,
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

export function applyMistralConfig(cfg: OpenClawConfig): OpenClawConfig {
  const next = applyMistralProviderConfig(cfg);
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
          primary: MISTRAL_DEFAULT_MODEL_REF,
        },
      },
    },
  };
}
