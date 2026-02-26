import type { OpenClawConfig } from "../config/config.js";
import { DEFAULT_GEMINI_EMBEDDING_MODEL } from "../memory/embeddings-gemini.js";
import { DEFAULT_MISTRAL_EMBEDDING_MODEL } from "../memory/embeddings-mistral.js";
import { DEFAULT_OPENAI_EMBEDDING_MODEL } from "../memory/embeddings-openai.js";
import { DEFAULT_VOYAGE_EMBEDDING_MODEL } from "../memory/embeddings-voyage.js";
import {
  createEmbeddingProvider,
  DEFAULT_LOCAL_MODEL,
  type EmbeddingProviderId,
} from "../memory/embeddings.js";

export type MemoryEmbeddingProviderId = EmbeddingProviderId;

export type PluginMemoryEmbeddingConfig = {
  provider?: MemoryEmbeddingProviderId;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  headers?: Record<string, string>;
  local?: {
    modelPath?: string;
    modelCacheDir?: string;
  };
};

export type PluginMemoryEmbeddingAdapter = {
  provider: MemoryEmbeddingProviderId;
  model: string;
  embed: (text: string) => Promise<number[]>;
  embedBatch: (texts: string[]) => Promise<number[][]>;
};

const DEFAULT_MODEL_BY_PROVIDER: Record<MemoryEmbeddingProviderId, string> = {
  openai: DEFAULT_OPENAI_EMBEDDING_MODEL,
  gemini: DEFAULT_GEMINI_EMBEDDING_MODEL,
  voyage: DEFAULT_VOYAGE_EMBEDDING_MODEL,
  mistral: DEFAULT_MISTRAL_EMBEDDING_MODEL,
  local: DEFAULT_LOCAL_MODEL,
};

const API_KEY_ENV_BY_PROVIDER: Record<Exclude<MemoryEmbeddingProviderId, "local">, string> = {
  openai: "OPENAI_API_KEY",
  gemini: "GEMINI_API_KEY",
  voyage: "VOYAGE_API_KEY",
  mistral: "MISTRAL_API_KEY",
};

const PROVIDER_CONFIG_KEY_BY_PROVIDER: Record<
  Exclude<MemoryEmbeddingProviderId, "local">,
  string
> = {
  openai: "openai",
  gemini: "google",
  voyage: "voyage",
  mistral: "mistral",
};

export function defaultMemoryEmbeddingModel(provider: MemoryEmbeddingProviderId): string {
  return DEFAULT_MODEL_BY_PROVIDER[provider];
}

export function defaultMemoryEmbeddingApiKeyEnvVar(
  provider: Exclude<MemoryEmbeddingProviderId, "local">,
): string {
  return API_KEY_ENV_BY_PROVIDER[provider];
}

export function resolveMemoryEmbeddingModel(
  provider: MemoryEmbeddingProviderId,
  rawModel?: string,
): string {
  const trimmed = rawModel?.trim();
  if (trimmed) {
    return trimmed;
  }
  return defaultMemoryEmbeddingModel(provider);
}

function normalizeProvider(value?: string): MemoryEmbeddingProviderId {
  const trimmed = value?.trim().toLowerCase();
  if (
    trimmed === "openai" ||
    trimmed === "gemini" ||
    trimmed === "voyage" ||
    trimmed === "mistral" ||
    trimmed === "local"
  ) {
    return trimmed;
  }
  throw new Error(`Unsupported embedding provider: ${String(value)}`);
}

export async function createPluginMemoryEmbeddingAdapter(params: {
  config: OpenClawConfig;
  agentDir?: string;
  embedding: PluginMemoryEmbeddingConfig;
}): Promise<PluginMemoryEmbeddingAdapter> {
  const provider = normalizeProvider(params.embedding.provider ?? "openai");
  const model = resolveMemoryEmbeddingModel(provider, params.embedding.model);
  const remoteApiKey = params.embedding.apiKey?.trim();
  const remoteBaseUrl = params.embedding.baseUrl?.trim();

  const result = await createEmbeddingProvider({
    config: params.config,
    agentDir: params.agentDir,
    provider,
    model,
    fallback: "none",
    remote:
      provider === "local"
        ? undefined
        : {
            apiKey: remoteApiKey,
            baseUrl: remoteBaseUrl,
            headers: params.embedding.headers,
          },
    local:
      provider === "local"
        ? {
            modelPath: params.embedding.local?.modelPath,
            modelCacheDir: params.embedding.local?.modelCacheDir,
          }
        : undefined,
  });

  if (!result.provider) {
    if (provider === "local") {
      throw new Error(
        result.providerUnavailableReason ??
          "Local embeddings are unavailable. Configure embedding.local.modelPath or install local embedding dependencies.",
      );
    }
    const envVar = defaultMemoryEmbeddingApiKeyEnvVar(provider);
    const providerConfigKey = PROVIDER_CONFIG_KEY_BY_PROVIDER[provider];
    const hint = `Set ${envVar} (or models.providers.${providerConfigKey}.apiKey), or provide embedding.apiKey in plugin config.`;
    const reason =
      result.providerUnavailableReason ?? `No API key found for provider "${provider}".`;
    throw new Error(`${reason}\n${hint}`);
  }

  return {
    provider: normalizeProvider(result.provider.id),
    model: result.provider.model,
    embed: async (text: string) => await result.provider!.embedQuery(text),
    embedBatch: async (texts: string[]) => await result.provider!.embedBatch(texts),
  };
}
