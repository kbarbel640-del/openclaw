/**
 * Local provider discovery for Ollama and LM Studio.
 * Auto-discovers local AI providers without requiring API keys.
 */
import type { ModelDefinitionConfig } from "../config/types.models.js";
import type { ProviderConfig } from "./models-config.providers.js";

// Constants for local providers
export const OLLAMA_API_BASE_URL = "http://127.0.0.1:11434";
export const OLLAMA_OPENAI_BASE_URL = "http://127.0.0.1:11434/v1";
export const LMSTUDIO_API_BASE_URL = "http://127.0.0.1:1234";
export const LMSTUDIO_OPENAI_BASE_URL = "http://127.0.0.1:1234/v1";

const DEFAULT_TIMEOUT_MS = 3000;

const OLLAMA_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

// Type for Ollama /api/tags response
interface OllamaModel {
  name: string;
  modified_at?: string;
  size?: number;
  digest?: string;
  details?: {
    family?: string;
    parameter_size?: string;
  };
}

interface OllamaTagsResponse {
  models: OllamaModel[];
}

// Type for OpenAI-compatible /v1/models response
interface OpenAIModel {
  id: string;
  object?: string;
  created?: number;
  owned_by?: string;
}

interface OpenAIModelsResponse {
  data: OpenAIModel[];
  object?: string;
}

// Injectable fetch for testing
export type FetchFn = typeof fetch;

/**
 * Infer context window size based on model name.
 * Local models have varying context windows; use conservative defaults.
 */
export function inferOllamaContextWindow(modelId: string): number {
  const lower = modelId.toLowerCase();
  // Llama 3.x models
  if (lower.includes("llama3") || lower.includes("llama-3")) {
    if (lower.includes("70b") || lower.includes("405b")) return 128000;
    return 8192;
  }
  // Qwen models
  if (lower.includes("qwen")) {
    if (lower.includes("72b") || lower.includes("110b")) return 32768;
    return 8192;
  }
  // DeepSeek models
  if (lower.includes("deepseek")) {
    return 64000;
  }
  // Mistral/Mixtral
  if (lower.includes("mistral") || lower.includes("mixtral")) {
    return 32768;
  }
  // CodeLlama
  if (lower.includes("codellama")) {
    return 16384;
  }
  // Phi models
  if (lower.includes("phi")) {
    return 4096;
  }
  // Default conservative context window
  return 8192;
}

/**
 * Probe Ollama at the given base URL.
 * Returns provider config with discovered models, or null if unreachable.
 */
export async function discoverLocalOllama(
  baseUrl = OLLAMA_API_BASE_URL,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchFn: FetchFn = fetch,
): Promise<ProviderConfig | null> {
  // Skip in test environments unless explicitly testing this
  if (
    (process.env.VITEST || process.env.NODE_ENV === "test") &&
    !process.env.CLAWDBOT_TEST_LOCAL_DISCOVERY
  ) {
    return null;
  }

  try {
    const response = await fetchFn(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as OllamaTagsResponse;
    if (!data.models || data.models.length === 0) {
      // Ollama is running but no models installed
      // Still return provider config so fallback model creation works
      return {
        baseUrl: `${baseUrl}/v1`,
        api: "openai-completions",
        models: [],
      };
    }

    const models: ModelDefinitionConfig[] = data.models.map((model) => {
      const modelId = model.name;
      const isReasoning =
        modelId.toLowerCase().includes("r1") || modelId.toLowerCase().includes("reasoning");
      return {
        id: modelId,
        name: modelId,
        reasoning: isReasoning,
        input: ["text"] as ("text" | "image")[],
        cost: OLLAMA_DEFAULT_COST,
        contextWindow: inferOllamaContextWindow(modelId),
        maxTokens: 8192,
      };
    });

    return {
      baseUrl: `${baseUrl}/v1`,
      api: "openai-completions",
      models,
    };
  } catch {
    // Connection refused, timeout, or other error
    return null;
  }
}

/**
 * Probe LM Studio at the given base URL (OpenAI-compatible API).
 * Returns provider config with discovered models, or null if unreachable.
 */
export async function discoverLocalLmStudio(
  baseUrl = LMSTUDIO_API_BASE_URL,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchFn: FetchFn = fetch,
): Promise<ProviderConfig | null> {
  // Skip in test environments unless explicitly testing this
  if (
    (process.env.VITEST || process.env.NODE_ENV === "test") &&
    !process.env.CLAWDBOT_TEST_LOCAL_DISCOVERY
  ) {
    return null;
  }

  try {
    const response = await fetchFn(`${baseUrl}/v1/models`, {
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as OpenAIModelsResponse;
    if (!data.data || data.data.length === 0) {
      // LM Studio is running but no models loaded
      return {
        baseUrl: `${baseUrl}/v1`,
        api: "openai-completions",
        models: [],
      };
    }

    const models: ModelDefinitionConfig[] = data.data.map((model) => {
      const modelId = model.id;
      const isReasoning =
        modelId.toLowerCase().includes("r1") || modelId.toLowerCase().includes("reasoning");
      return {
        id: modelId,
        name: modelId,
        reasoning: isReasoning,
        input: ["text"] as ("text" | "image")[],
        cost: OLLAMA_DEFAULT_COST,
        contextWindow: inferOllamaContextWindow(modelId),
        maxTokens: 8192,
      };
    });

    return {
      baseUrl: `${baseUrl}/v1`,
      api: "openai-completions",
      models,
    };
  } catch {
    // Connection refused, timeout, or other error
    return null;
  }
}

/**
 * Discover all local AI providers.
 * Returns a record of provider configs keyed by provider name.
 */
export async function discoverAllLocalProviders(
  fetchFn: FetchFn = fetch,
): Promise<Record<string, ProviderConfig>> {
  const providers: Record<string, ProviderConfig> = {};

  // Probe Ollama
  const ollama = await discoverLocalOllama(OLLAMA_API_BASE_URL, DEFAULT_TIMEOUT_MS, fetchFn);
  if (ollama) {
    providers.ollama = ollama;
  }

  // Probe LM Studio
  const lmstudio = await discoverLocalLmStudio(LMSTUDIO_API_BASE_URL, DEFAULT_TIMEOUT_MS, fetchFn);
  if (lmstudio) {
    providers.lmstudio = lmstudio;
  }

  return providers;
}

/**
 * Check if Ollama is reachable at the default URL.
 * Quick probe without fetching model list.
 */
export async function isOllamaReachable(
  baseUrl = OLLAMA_API_BASE_URL,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchFn: FetchFn = fetch,
): Promise<boolean> {
  // Skip in test environments unless explicitly testing this
  if (
    (process.env.VITEST || process.env.NODE_ENV === "test") &&
    !process.env.CLAWDBOT_TEST_LOCAL_DISCOVERY
  ) {
    return false;
  }

  try {
    const response = await fetchFn(`${baseUrl}/api/version`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    return response.ok;
  } catch {
    return false;
  }
}
