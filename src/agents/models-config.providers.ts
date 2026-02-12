import type { OpenClawConfig } from "../config/config.js";
import type { ModelDefinitionConfig } from "../config/types.models.js";
import {
  DEFAULT_COPILOT_API_BASE_URL,
  resolveCopilotApiToken,
} from "../providers/github-copilot-token.js";
import { ensureAuthProfileStore, listProfilesForProvider } from "./auth-profiles.js";
import { discoverBedrockModels } from "./bedrock-discovery.js";
import { resolveAwsSdkEnvVarName, resolveEnvApiKey } from "./model-auth.js";
import {
  buildSyntheticModelDefinition,
  SYNTHETIC_BASE_URL,
  SYNTHETIC_MODEL_CATALOG,
} from "./synthetic-models.js";
import { discoverVeniceModels, VENICE_BASE_URL } from "./venice-models.js";

type ModelsConfig = NonNullable<OpenClawConfig["models"]>;
export type ProviderConfig = NonNullable<ModelsConfig["providers"]>[string];

const MINIMAX_API_BASE_URL = "https://api.minimax.chat/v1";
const MINIMAX_PORTAL_BASE_URL = "https://api.minimax.io/anthropic";
const MINIMAX_DEFAULT_MODEL_ID = "MiniMax-M2.1";
const MINIMAX_DEFAULT_VISION_MODEL_ID = "MiniMax-VL-01";
const MINIMAX_DEFAULT_CONTEXT_WINDOW = 200000;
const MINIMAX_DEFAULT_MAX_TOKENS = 8192;
const MINIMAX_OAUTH_PLACEHOLDER = "minimax-oauth";
// Pricing: MiniMax doesn't publish public rates. Override in models.json for accurate costs.
const MINIMAX_API_COST = {
  input: 15,
  output: 60,
  cacheRead: 2,
  cacheWrite: 10,
};

const XIAOMI_BASE_URL = "https://api.xiaomimimo.com/anthropic";
export const XIAOMI_DEFAULT_MODEL_ID = "mimo-v2-flash";
const XIAOMI_DEFAULT_CONTEXT_WINDOW = 262144;
const XIAOMI_DEFAULT_MAX_TOKENS = 8192;
const XIAOMI_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

const MOONSHOT_BASE_URL = "https://api.moonshot.ai/v1";
const MOONSHOT_DEFAULT_MODEL_ID = "kimi-k2.5";
const MOONSHOT_DEFAULT_CONTEXT_WINDOW = 256000;
const MOONSHOT_DEFAULT_MAX_TOKENS = 8192;
const MOONSHOT_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

const QWEN_PORTAL_BASE_URL = "https://portal.qwen.ai/v1";
const QWEN_PORTAL_OAUTH_PLACEHOLDER = "qwen-oauth";
const QWEN_PORTAL_DEFAULT_CONTEXT_WINDOW = 128000;
const QWEN_PORTAL_DEFAULT_MAX_TOKENS = 8192;
const QWEN_PORTAL_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const GROQ_DEFAULT_MODEL_ID = "llama-3.3-70b-versatile";
const GROQ_DEFAULT_CONTEXT_WINDOW = 128000;
const GROQ_DEFAULT_MAX_TOKENS = 8192;
const GROQ_DEFAULT_COST = {
  input: 0.59,
  output: 0.79,
  cacheRead: 0,
  cacheWrite: 0,
};

const MISTRAL_BASE_URL = "https://api.mistral.ai/v1";
const MISTRAL_DEFAULT_MODEL_ID = "mistral-large-latest";
const MISTRAL_DEFAULT_CONTEXT_WINDOW = 128000;
const MISTRAL_DEFAULT_MAX_TOKENS = 8192;
const MISTRAL_DEFAULT_COST = {
  input: 2,
  output: 6,
  cacheRead: 0,
  cacheWrite: 0,
};

const XAI_BASE_URL = "https://api.x.ai/v1";
const XAI_DEFAULT_MODEL_ID = "grok-2";
const XAI_DEFAULT_CONTEXT_WINDOW = 128000;
const XAI_DEFAULT_MAX_TOKENS = 8192;
const XAI_DEFAULT_COST = {
  input: 2,
  output: 10,
  cacheRead: 0,
  cacheWrite: 0,
};

const CEREBRAS_BASE_URL = "https://api.cerebras.ai/v1";
const CEREBRAS_DEFAULT_MODEL_ID = "llama3.1-70b";
const CEREBRAS_DEFAULT_CONTEXT_WINDOW = 128000;
const CEREBRAS_DEFAULT_MAX_TOKENS = 8192;
const CEREBRAS_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const OPENROUTER_DEFAULT_MODEL_ID = "openai/gpt-4o-mini";
const OPENROUTER_DEFAULT_CONTEXT_WINDOW = 128000;
const OPENROUTER_DEFAULT_MAX_TOKENS = 8192;
const OPENROUTER_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

const OLLAMA_BASE_URL = "http://127.0.0.1:11434/v1";
const OLLAMA_API_BASE_URL = "http://127.0.0.1:11434";
const OLLAMA_DEFAULT_CONTEXT_WINDOW = 128000;
const OLLAMA_DEFAULT_MAX_TOKENS = 8192;
const OLLAMA_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    family?: string;
    parameter_size?: string;
  };
}

interface OllamaTagsResponse {
  models: OllamaModel[];
}

async function discoverOllamaModels(): Promise<ModelDefinitionConfig[]> {
  // Skip Ollama discovery in test environments
  if (process.env.VITEST || process.env.NODE_ENV === "test") {
    return [];
  }
  try {
    const response = await fetch(`${OLLAMA_API_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      console.warn(`Failed to discover Ollama models: ${response.status}`);
      return [];
    }
    const data = (await response.json()) as OllamaTagsResponse;
    if (!data.models || data.models.length === 0) {
      console.warn("No Ollama models found on local instance");
      return [];
    }
    return data.models.map((model) => {
      const modelId = model.name;
      const isReasoning =
        modelId.toLowerCase().includes("r1") || modelId.toLowerCase().includes("reasoning");
      return {
        id: modelId,
        name: modelId,
        reasoning: isReasoning,
        input: ["text"],
        cost: OLLAMA_DEFAULT_COST,
        contextWindow: OLLAMA_DEFAULT_CONTEXT_WINDOW,
        maxTokens: OLLAMA_DEFAULT_MAX_TOKENS,
      };
    });
  } catch (error) {
    console.warn(`Failed to discover Ollama models: ${String(error)}`);
    return [];
  }
}

function normalizeApiKeyConfig(value: string): string {
  const trimmed = value.trim();
  const match = /^\$\{([A-Z0-9_]+)\}$/.exec(trimmed);
  return match?.[1] ?? trimmed;
}

function resolveEnvApiKeyVarName(provider: string): string | undefined {
  const resolved = resolveEnvApiKey(provider);
  if (!resolved) {
    return undefined;
  }
  const match = /^(?:env: |shell env: )([A-Z0-9_]+)$/.exec(resolved.source);
  return match ? match[1] : undefined;
}

function resolveAwsSdkApiKeyVarName(): string {
  return resolveAwsSdkEnvVarName() ?? "AWS_PROFILE";
}

function resolveApiKeyFromProfiles(params: {
  provider: string;
  store: ReturnType<typeof ensureAuthProfileStore>;
}): string | undefined {
  const ids = listProfilesForProvider(params.store, params.provider);
  for (const id of ids) {
    const cred = params.store.profiles[id];
    if (!cred) {
      continue;
    }
    if (cred.type === "api_key") {
      return cred.key;
    }
    if (cred.type === "token") {
      return cred.token;
    }
    if (cred.type === "oauth") {
      const access = (cred as { access?: string }).access?.trim();
      if (!access) {
        continue;
      }
      const projectId = (cred as { projectId?: string }).projectId?.trim();
      if (
        projectId &&
        (cred.provider === "google-antigravity" || cred.provider === "google-gemini-cli")
      ) {
        // pi-ai expects OAuth apiKey payload as JSON for Google OAuth providers.
        return JSON.stringify({ token: access, projectId });
      }
      return access;
    }
  }
  return undefined;
}

export function normalizeGoogleModelId(id: string): string {
  if (id === "gemini-3-pro") {
    return "gemini-3-pro-preview";
  }
  if (id === "gemini-3-flash") {
    return "gemini-3-flash-preview";
  }
  return id;
}

function normalizeGoogleProvider(provider: ProviderConfig): ProviderConfig {
  let mutated = false;
  const models = provider.models.map((model) => {
    const nextId = normalizeGoogleModelId(model.id);
    if (nextId === model.id) {
      return model;
    }
    mutated = true;
    return { ...model, id: nextId };
  });
  return mutated ? { ...provider, models } : provider;
}

export function normalizeProviders(params: {
  providers: ModelsConfig["providers"];
  agentDir: string;
}): ModelsConfig["providers"] {
  const { providers } = params;
  if (!providers) {
    return providers;
  }
  const authStore = ensureAuthProfileStore(params.agentDir, {
    allowKeychainPrompt: false,
  });
  let mutated = false;
  const next: Record<string, ProviderConfig> = {};

  for (const [key, provider] of Object.entries(providers)) {
    const normalizedKey = key.trim();
    let normalizedProvider = provider;

    // Fix common misconfig: apiKey set to "${ENV_VAR}" instead of "ENV_VAR".
    if (
      normalizedProvider.apiKey &&
      normalizeApiKeyConfig(normalizedProvider.apiKey) !== normalizedProvider.apiKey
    ) {
      mutated = true;
      normalizedProvider = {
        ...normalizedProvider,
        apiKey: normalizeApiKeyConfig(normalizedProvider.apiKey),
      };
    }

    // If a provider defines models, pi's ModelRegistry requires apiKey to be set.
    // Fill it from the environment or auth profiles when possible.
    const hasModels =
      Array.isArray(normalizedProvider.models) && normalizedProvider.models.length > 0;
    if (hasModels && !normalizedProvider.apiKey?.trim()) {
      const authMode =
        normalizedProvider.auth ?? (normalizedKey === "amazon-bedrock" ? "aws-sdk" : undefined);
      if (authMode === "aws-sdk") {
        const apiKey = resolveAwsSdkApiKeyVarName();
        mutated = true;
        normalizedProvider = { ...normalizedProvider, apiKey };
      } else {
        const fromEnv = resolveEnvApiKeyVarName(normalizedKey);
        const fromProfiles = resolveApiKeyFromProfiles({
          provider: normalizedKey,
          store: authStore,
        });
        const apiKey = fromEnv ?? fromProfiles;
        if (apiKey?.trim()) {
          mutated = true;
          normalizedProvider = { ...normalizedProvider, apiKey };
        }
      }
    }

    if (normalizedKey === "google") {
      const googleNormalized = normalizeGoogleProvider(normalizedProvider);
      if (googleNormalized !== normalizedProvider) {
        mutated = true;
      }
      normalizedProvider = googleNormalized;
    }

    next[key] = normalizedProvider;
  }

  return mutated ? next : providers;
}

function buildMinimaxProvider(): ProviderConfig {
  return {
    baseUrl: MINIMAX_API_BASE_URL,
    api: "openai-completions",
    models: [
      {
        id: MINIMAX_DEFAULT_MODEL_ID,
        name: "MiniMax M2.1",
        reasoning: false,
        input: ["text"],
        cost: MINIMAX_API_COST,
        contextWindow: MINIMAX_DEFAULT_CONTEXT_WINDOW,
        maxTokens: MINIMAX_DEFAULT_MAX_TOKENS,
      },
      {
        id: MINIMAX_DEFAULT_VISION_MODEL_ID,
        name: "MiniMax VL 01",
        reasoning: false,
        input: ["text", "image"],
        cost: MINIMAX_API_COST,
        contextWindow: MINIMAX_DEFAULT_CONTEXT_WINDOW,
        maxTokens: MINIMAX_DEFAULT_MAX_TOKENS,
      },
    ],
  };
}

function buildMinimaxPortalProvider(): ProviderConfig {
  return {
    baseUrl: MINIMAX_PORTAL_BASE_URL,
    api: "anthropic-messages",
    models: [
      {
        id: MINIMAX_DEFAULT_MODEL_ID,
        name: "MiniMax M2.1",
        reasoning: false,
        input: ["text"],
        cost: MINIMAX_API_COST,
        contextWindow: MINIMAX_DEFAULT_CONTEXT_WINDOW,
        maxTokens: MINIMAX_DEFAULT_MAX_TOKENS,
      },
    ],
  };
}

function buildMoonshotProvider(): ProviderConfig {
  return {
    baseUrl: MOONSHOT_BASE_URL,
    api: "openai-completions",
    models: [
      {
        id: MOONSHOT_DEFAULT_MODEL_ID,
        name: "Kimi K2.5",
        reasoning: false,
        input: ["text"],
        cost: MOONSHOT_DEFAULT_COST,
        contextWindow: MOONSHOT_DEFAULT_CONTEXT_WINDOW,
        maxTokens: MOONSHOT_DEFAULT_MAX_TOKENS,
      },
    ],
  };
}

function buildQwenPortalProvider(): ProviderConfig {
  return {
    baseUrl: QWEN_PORTAL_BASE_URL,
    api: "openai-completions",
    models: [
      {
        id: "coder-model",
        name: "Qwen Coder",
        reasoning: false,
        input: ["text"],
        cost: QWEN_PORTAL_DEFAULT_COST,
        contextWindow: QWEN_PORTAL_DEFAULT_CONTEXT_WINDOW,
        maxTokens: QWEN_PORTAL_DEFAULT_MAX_TOKENS,
      },
      {
        id: "vision-model",
        name: "Qwen Vision",
        reasoning: false,
        input: ["text", "image"],
        cost: QWEN_PORTAL_DEFAULT_COST,
        contextWindow: QWEN_PORTAL_DEFAULT_CONTEXT_WINDOW,
        maxTokens: QWEN_PORTAL_DEFAULT_MAX_TOKENS,
      },
    ],
  };
}

function buildSyntheticProvider(): ProviderConfig {
  return {
    baseUrl: SYNTHETIC_BASE_URL,
    api: "anthropic-messages",
    models: SYNTHETIC_MODEL_CATALOG.map(buildSyntheticModelDefinition),
  };
}

export function buildXiaomiProvider(): ProviderConfig {
  return {
    baseUrl: XIAOMI_BASE_URL,
    api: "anthropic-messages",
    models: [
      {
        id: XIAOMI_DEFAULT_MODEL_ID,
        name: "Xiaomi MiMo V2 Flash",
        reasoning: false,
        input: ["text"],
        cost: XIAOMI_DEFAULT_COST,
        contextWindow: XIAOMI_DEFAULT_CONTEXT_WINDOW,
        maxTokens: XIAOMI_DEFAULT_MAX_TOKENS,
      },
    ],
  };
}

async function buildVeniceProvider(): Promise<ProviderConfig> {
  const models = await discoverVeniceModels();
  return {
    baseUrl: VENICE_BASE_URL,
    api: "openai-completions",
    models,
  };
}

async function buildOllamaProvider(): Promise<ProviderConfig> {
  const models = await discoverOllamaModels();
  return {
    baseUrl: OLLAMA_BASE_URL,
    api: "openai-completions",
    models,
  };
}

function buildGroqProvider(): ProviderConfig {
  return {
    baseUrl: GROQ_BASE_URL,
    api: "openai-completions",
    models: [
      {
        id: GROQ_DEFAULT_MODEL_ID,
        name: "Llama 3.3 70B Versatile",
        reasoning: false,
        input: ["text"],
        cost: GROQ_DEFAULT_COST,
        contextWindow: GROQ_DEFAULT_CONTEXT_WINDOW,
        maxTokens: GROQ_DEFAULT_MAX_TOKENS,
      },
      {
        id: "mixtral-8x7b-32768",
        name: "Mixtral 8x7B 32k",
        reasoning: false,
        input: ["text"],
        cost: {
          input: 0.24,
          output: 0.24,
          cacheRead: 0,
          cacheWrite: 0,
        },
        contextWindow: 32768,
        maxTokens: 32768,
      },
    ],
  };
}

function buildMistralProvider(): ProviderConfig {
  return {
    baseUrl: MISTRAL_BASE_URL,
    api: "openai-completions",
    models: [
      {
        id: MISTRAL_DEFAULT_MODEL_ID,
        name: "Mistral Large",
        reasoning: false,
        input: ["text"],
        cost: MISTRAL_DEFAULT_COST,
        contextWindow: MISTRAL_DEFAULT_CONTEXT_WINDOW,
        maxTokens: MISTRAL_DEFAULT_MAX_TOKENS,
      },
      {
        id: "mistral-small-latest",
        name: "Mistral Small",
        reasoning: false,
        input: ["text"],
        cost: {
          input: 0.2,
          output: 0.6,
          cacheRead: 0,
          cacheWrite: 0,
        },
        contextWindow: 32000,
        maxTokens: 8192,
      },
    ],
  };
}

function buildXAIProvider(): ProviderConfig {
  return {
    baseUrl: XAI_BASE_URL,
    api: "openai-completions",
    models: [
      {
        id: XAI_DEFAULT_MODEL_ID,
        name: "Grok 2",
        reasoning: false,
        input: ["text"],
        cost: XAI_DEFAULT_COST,
        contextWindow: XAI_DEFAULT_CONTEXT_WINDOW,
        maxTokens: XAI_DEFAULT_MAX_TOKENS,
      },
      {
        id: "grok-2-mini",
        name: "Grok 2 Mini",
        reasoning: false,
        input: ["text"],
        cost: {
          input: 0.2,
          output: 1.0,
          cacheRead: 0,
          cacheWrite: 0,
        },
        contextWindow: 128000,
        maxTokens: 8192,
      },
    ],
  };
}

function buildCerebrasProvider(): ProviderConfig {
  return {
    baseUrl: CEREBRAS_BASE_URL,
    api: "openai-completions",
    models: [
      {
        id: CEREBRAS_DEFAULT_MODEL_ID,
        name: "Llama 3.1 70B",
        reasoning: false,
        input: ["text"],
        cost: CEREBRAS_DEFAULT_COST,
        contextWindow: CEREBRAS_DEFAULT_CONTEXT_WINDOW,
        maxTokens: CEREBRAS_DEFAULT_MAX_TOKENS,
      },
    ],
  };
}

function buildOpenRouterProvider(): ProviderConfig {
  return {
    baseUrl: OPENROUTER_BASE_URL,
    api: "openai-completions",
    models: [
      {
        id: OPENROUTER_DEFAULT_MODEL_ID,
        name: "GPT-4o Mini (OpenRouter)",
        reasoning: false,
        input: ["text"],
        cost: OPENROUTER_DEFAULT_COST,
        contextWindow: OPENROUTER_DEFAULT_CONTEXT_WINDOW,
        maxTokens: OPENROUTER_DEFAULT_MAX_TOKENS,
      },
    ],
  };
}

export async function resolveImplicitProviders(params: {
  agentDir: string;
}): Promise<ModelsConfig["providers"]> {
  const providers: Record<string, ProviderConfig> = {};
  const authStore = ensureAuthProfileStore(params.agentDir, {
    allowKeychainPrompt: false,
  });

  const minimaxKey =
    resolveEnvApiKeyVarName("minimax") ??
    resolveApiKeyFromProfiles({ provider: "minimax", store: authStore });
  if (minimaxKey) {
    providers.minimax = { ...buildMinimaxProvider(), apiKey: minimaxKey };
  }

  const minimaxOauthProfile = listProfilesForProvider(authStore, "minimax-portal");
  if (minimaxOauthProfile.length > 0) {
    providers["minimax-portal"] = {
      ...buildMinimaxPortalProvider(),
      apiKey: MINIMAX_OAUTH_PLACEHOLDER,
    };
  }

  const moonshotKey =
    resolveEnvApiKeyVarName("moonshot") ??
    resolveApiKeyFromProfiles({ provider: "moonshot", store: authStore });
  if (moonshotKey) {
    providers.moonshot = { ...buildMoonshotProvider(), apiKey: moonshotKey };
  }

  const syntheticKey =
    resolveEnvApiKeyVarName("synthetic") ??
    resolveApiKeyFromProfiles({ provider: "synthetic", store: authStore });
  if (syntheticKey) {
    providers.synthetic = { ...buildSyntheticProvider(), apiKey: syntheticKey };
  }

  const veniceKey =
    resolveEnvApiKeyVarName("venice") ??
    resolveApiKeyFromProfiles({ provider: "venice", store: authStore });
  if (veniceKey) {
    providers.venice = { ...(await buildVeniceProvider()), apiKey: veniceKey };
  }

  const qwenProfiles = listProfilesForProvider(authStore, "qwen-portal");
  if (qwenProfiles.length > 0) {
    providers["qwen-portal"] = {
      ...buildQwenPortalProvider(),
      apiKey: QWEN_PORTAL_OAUTH_PLACEHOLDER,
    };
  }

  const xiaomiKey =
    resolveEnvApiKeyVarName("xiaomi") ??
    resolveApiKeyFromProfiles({ provider: "xiaomi", store: authStore });
  if (xiaomiKey) {
    providers.xiaomi = { ...buildXiaomiProvider(), apiKey: xiaomiKey };
  }

  const groqKey =
    resolveEnvApiKeyVarName("groq") ??
    resolveApiKeyFromProfiles({ provider: "groq", store: authStore });
  if (groqKey) {
    providers.groq = { ...buildGroqProvider(), apiKey: groqKey };
  }

  const mistralKey =
    resolveEnvApiKeyVarName("mistral") ??
    resolveApiKeyFromProfiles({ provider: "mistral", store: authStore });
  if (mistralKey) {
    providers.mistral = { ...buildMistralProvider(), apiKey: mistralKey };
  }

  const xaiKey =
    resolveEnvApiKeyVarName("xai") ??
    resolveApiKeyFromProfiles({ provider: "xai", store: authStore });
  if (xaiKey) {
    providers.xai = { ...buildXAIProvider(), apiKey: xaiKey };
  }

  const cerebrasKey =
    resolveEnvApiKeyVarName("cerebras") ??
    resolveApiKeyFromProfiles({ provider: "cerebras", store: authStore });
  if (cerebrasKey) {
    providers.cerebras = { ...buildCerebrasProvider(), apiKey: cerebrasKey };
  }

  const openrouterKey =
    resolveEnvApiKeyVarName("openrouter") ??
    resolveApiKeyFromProfiles({ provider: "openrouter", store: authStore });
  if (openrouterKey) {
    providers.openrouter = { ...buildOpenRouterProvider(), apiKey: openrouterKey };
  }

  // Ollama provider - only add if explicitly configured
  const ollamaKey =
    resolveEnvApiKeyVarName("ollama") ??
    resolveApiKeyFromProfiles({ provider: "ollama", store: authStore });
  if (ollamaKey) {
    providers.ollama = { ...(await buildOllamaProvider()), apiKey: ollamaKey };
  }

  // Google Antigravity
  const antigravityKey =
    resolveEnvApiKeyVarName("google-antigravity") ??
    resolveApiKeyFromProfiles({ provider: "google-antigravity", store: authStore }) ??
    resolveApiKeyFromProfiles({ provider: "google-gemini-cli", store: authStore });

  if (antigravityKey) {
    const baseProvider = buildGoogleAntigravityProvider();
    providers["google-antigravity"] = {
      ...baseProvider,
      // pi-ai expects a JSON oauth payload ({ token, projectId }) for this provider.
      apiKey: antigravityKey,
    } as ProviderConfig;
  }

  return providers;
}

const ANTIGRAVITY_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

function buildGoogleAntigravityProvider(): ProviderConfig {
  // pi-ai handles Google OAuth routing internally when api is 'google-gemini-cli'.
  // Do NOT set baseUrl — pi-ai resolves the correct endpoint from the OAuth payload.
  return {
    api: "google-gemini-cli",
    models: [
      {
        id: "gemini-3-pro",
        name: "Gemini 3 Pro (High)",
        reasoning: true,
        input: ["text", "image"],
        cost: ANTIGRAVITY_DEFAULT_COST,
        contextWindow: 2097152,
        maxTokens: 8192,
      },
      {
        id: "gemini-3-pro-high",
        name: "Gemini 3 Pro (High)",
        reasoning: true,
        input: ["text", "image"],
        cost: ANTIGRAVITY_DEFAULT_COST,
        contextWindow: 2097152,
        maxTokens: 8192,
      },
      {
        id: "gemini-3-pro-low",
        name: "Gemini 3 Pro (Low)",
        reasoning: true,
        input: ["text", "image"],
        cost: ANTIGRAVITY_DEFAULT_COST,
        contextWindow: 2097152,
        maxTokens: 8192,
      },
      {
        id: "gemini-3-flash",
        name: "Gemini 3 Flash",
        reasoning: true,
        input: ["text", "image"],
        cost: ANTIGRAVITY_DEFAULT_COST,
        contextWindow: 1048576,
        maxTokens: 8192,
      },
      {
        id: "gemini-2.5-pro",
        name: "Gemini 2.5 Pro",
        reasoning: true,
        input: ["text", "image"],
        cost: ANTIGRAVITY_DEFAULT_COST,
        contextWindow: 1048576,
        maxTokens: 8192,
      },
      {
        id: "gemini-2.5-flash",
        name: "Gemini 2.5 Flash",
        reasoning: true,
        input: ["text", "image"],
        cost: ANTIGRAVITY_DEFAULT_COST,
        contextWindow: 1048576,
        maxTokens: 8192,
      },
      {
        id: "gemini-2.5-flash-lite",
        name: "Gemini 2.5 Flash Lite",
        reasoning: false,
        input: ["text", "image"],
        cost: ANTIGRAVITY_DEFAULT_COST,
        contextWindow: 1048576,
        maxTokens: 8192,
      },
      {
        id: "claude-sonnet-4-5",
        name: "Claude Sonnet 4.5",
        reasoning: false,
        input: ["text", "image"],
        cost: ANTIGRAVITY_DEFAULT_COST,
        contextWindow: 200000,
        maxTokens: 8192,
      },
      {
        id: "claude-sonnet-4-5-thinking",
        name: "Claude Sonnet 4.5 (Thinking)",
        reasoning: true,
        input: ["text", "image"],
        cost: ANTIGRAVITY_DEFAULT_COST,
        contextWindow: 200000,
        maxTokens: 8192,
      },
      {
        id: "claude-opus-4-5-thinking",
        name: "Claude Opus 4.5 (Thinking)",
        reasoning: true,
        input: ["text", "image"],
        cost: ANTIGRAVITY_DEFAULT_COST,
        contextWindow: 200000,
        maxTokens: 8192,
      },
      {
        id: "claude-opus-4-6-thinking",
        name: "Claude Opus 4.6 (Thinking)",
        reasoning: true,
        input: ["text", "image"],
        cost: ANTIGRAVITY_DEFAULT_COST,
        contextWindow: 200000,
        maxTokens: 8192,
      },
      {
        id: "gpt-oss-120b",
        name: "GPT-OSS 120B",
        reasoning: false,
        input: ["text"],
        cost: ANTIGRAVITY_DEFAULT_COST,
        contextWindow: 128000,
        maxTokens: 8192,
      },
      {
        id: "gpt-oss-120b-medium",
        name: "GPT-OSS 120B (Medium)",
        reasoning: false,
        input: ["text"],
        cost: ANTIGRAVITY_DEFAULT_COST,
        contextWindow: 128000,
        maxTokens: 8192,
      },
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        reasoning: false,
        input: ["text", "image"],
        cost: ANTIGRAVITY_DEFAULT_COST,
        contextWindow: 1048576,
        maxTokens: 8192,
      },
      {
        id: "gemini-2.0-pro-exp-02-05",
        name: "Gemini 2.0 Pro Experimental",
        reasoning: true,
        input: ["text", "image"],
        cost: ANTIGRAVITY_DEFAULT_COST,
        contextWindow: 2097152,
        maxTokens: 8192,
      },
      {
        id: "gemini-2.0-flash-thinking-exp-01-21",
        name: "Gemini 2.0 Flash Thinking",
        reasoning: true,
        input: ["text", "image"],
        cost: ANTIGRAVITY_DEFAULT_COST,
        contextWindow: 1048576,
        maxTokens: 8192,
      },
      {
        id: "gemini-1.5-pro",
        name: "Gemini 1.5 Pro",
        reasoning: false,
        input: ["text", "image"],
        cost: ANTIGRAVITY_DEFAULT_COST,
        contextWindow: 2097152,
        maxTokens: 8192,
      },
      {
        id: "gemini-1.5-pro-high",
        name: "Gemini 1.5 Pro (High)",
        reasoning: false,
        input: ["text", "image"],
        cost: ANTIGRAVITY_DEFAULT_COST,
        contextWindow: 2097152,
        maxTokens: 8192,
      },
      {
        id: "gemini-1.5-pro-low",
        name: "Gemini 1.5 Pro (Low)",
        reasoning: false,
        input: ["text", "image"],
        cost: ANTIGRAVITY_DEFAULT_COST,
        contextWindow: 2097152,
        maxTokens: 8192,
      },
      {
        id: "gemini-1.5-flash",
        name: "Gemini 1.5 Flash",
        reasoning: false,
        input: ["text", "image"],
        cost: ANTIGRAVITY_DEFAULT_COST,
        contextWindow: 1048576,
        maxTokens: 8192,
      },
      {
        id: "MODEL_GOOGLE_GEMINI_2_5_FLASH",
        name: "Gemini 2.5 Flash (Alias)",
        reasoning: true,
        input: ["text", "image"],
        cost: ANTIGRAVITY_DEFAULT_COST,
        contextWindow: 1048576,
        maxTokens: 8192,
      },
    ],
  };
}

export async function resolveImplicitCopilotProvider(params: {
  agentDir: string;
  env?: NodeJS.ProcessEnv;
}): Promise<ProviderConfig | null> {
  const env = params.env ?? process.env;
  const authStore = ensureAuthProfileStore(params.agentDir, { allowKeychainPrompt: false });
  const hasProfile = listProfilesForProvider(authStore, "github-copilot").length > 0;
  const envToken = env.COPILOT_GITHUB_TOKEN ?? env.GH_TOKEN ?? env.GITHUB_TOKEN;
  const githubToken = (envToken ?? "").trim();

  if (!hasProfile && !githubToken) {
    return null;
  }

  let selectedGithubToken = githubToken;
  if (!selectedGithubToken && hasProfile) {
    // Use the first available profile as a default for discovery (it will be
    // re-resolved per-run by the embedded runner).
    const profileId = listProfilesForProvider(authStore, "github-copilot")[0];
    const profile = profileId ? authStore.profiles[profileId] : undefined;
    if (profile && profile.type === "token") {
      selectedGithubToken = profile.token;
    }
  }

  let baseUrl = DEFAULT_COPILOT_API_BASE_URL;
  if (selectedGithubToken) {
    try {
      const token = await resolveCopilotApiToken({
        githubToken: selectedGithubToken,
        env,
      });
      baseUrl = token.baseUrl;
    } catch {
      baseUrl = DEFAULT_COPILOT_API_BASE_URL;
    }
  }

  // pi-coding-agent's ModelRegistry marks a model "available" only if its
  // `AuthStorage` has auth configured for that provider (via auth.json/env/etc).
  // Our Copilot auth lives in OpenClaw's auth-profiles store instead, so we also
  // write a runtime-only auth.json entry for pi-coding-agent to pick up.
  //
  // This is safe because it's (1) within OpenClaw's agent dir, (2) contains the
  // GitHub token (not the exchanged Copilot token), and (3) matches existing
  // patterns for OAuth-like providers in pi-coding-agent.
  // Note: we deliberately do not write pi-coding-agent's `auth.json` here.
  // OpenClaw uses its own auth store and exchanges tokens at runtime.
  // `models list` uses OpenClaw's auth heuristics for availability.

  // We intentionally do NOT define custom models for Copilot in models.json.
  // pi-coding-agent treats providers with models as replacements requiring apiKey.
  // We only override baseUrl; the model list comes from pi-ai built-ins.
  return {
    baseUrl,
    models: [],
  } satisfies ProviderConfig;
}

export async function resolveImplicitBedrockProvider(params: {
  agentDir: string;
  config?: OpenClawConfig;
  env?: NodeJS.ProcessEnv;
}): Promise<ProviderConfig | null> {
  const env = params.env ?? process.env;
  const discoveryConfig = params.config?.models?.bedrockDiscovery;
  const enabled = discoveryConfig?.enabled;
  const hasAwsCreds = resolveAwsSdkEnvVarName(env) !== undefined;
  if (enabled === false) {
    return null;
  }
  if (enabled !== true && !hasAwsCreds) {
    return null;
  }

  const region = discoveryConfig?.region ?? env.AWS_REGION ?? env.AWS_DEFAULT_REGION ?? "us-east-1";
  const models = await discoverBedrockModels({ region, config: discoveryConfig });
  if (models.length === 0) {
    return null;
  }

  return {
    baseUrl: `https://bedrock-runtime.${region}.amazonaws.com`,
    api: "bedrock-converse-stream",
    auth: "aws-sdk",
    models,
  } satisfies ProviderConfig;
}
