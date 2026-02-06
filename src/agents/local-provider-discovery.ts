/**
 * Local provider discovery for Ollama and LM Studio.
 * Auto-discovers local AI providers without requiring API keys.
 *
 * INVARIANT: Context windows must be >= MINIMUM_CONTEXT_WINDOW (16000) for chat models.
 * The embedded agent requires this minimum to function. Never return a lower value.
 */
import type { ModelDefinitionConfig } from "../config/types.models.js";
import type { ProviderConfig } from "./models-config.providers.js";

// Constants for local providers
export const OLLAMA_API_BASE_URL = "http://127.0.0.1:11434";
export const OLLAMA_OPENAI_BASE_URL = "http://127.0.0.1:11434/v1";
export const LMSTUDIO_API_BASE_URL = "http://127.0.0.1:1234";
export const LMSTUDIO_OPENAI_BASE_URL = "http://127.0.0.1:1234/v1";

const DEFAULT_TIMEOUT_MS = 3000;

// CRITICAL: Embedded agent requires minimum 16000 context window to function.
// Any value below this will cause "connected but dead" behavior.
export const MINIMUM_CONTEXT_WINDOW = 16000;

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

// Type for Ollama /api/show response
// Keys observed: modelfile, parameters, template, details, model_info
// context_length is typically in model_info or parameters
interface OllamaShowResponse {
  modelfile?: string;
  parameters?: string;
  template?: string;
  details?: {
    family?: string;
    parameter_size?: string;
    quantization_level?: string;
  };
  model_info?: Record<string, unknown>;
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
 * Query actual context window from Ollama /api/show endpoint.
 * Returns the context length if found, undefined otherwise.
 *
 * Ollama /api/show returns model info including context_length in various places:
 * - model_info.*.context_length
 * - In parameters string as "num_ctx NNNN"
 */
export async function getOllamaModelContextWindow(
  modelName: string,
  baseUrl = OLLAMA_API_BASE_URL,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchFn: FetchFn = fetch,
): Promise<number | undefined> {
  // Skip in test environments unless explicitly testing this
  if (
    (process.env.VITEST || process.env.NODE_ENV === "test") &&
    !process.env.CLAWDBOT_TEST_LOCAL_DISCOVERY
  ) {
    return undefined;
  }

  try {
    const response = await fetchFn(`${baseUrl}/api/show`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: modelName }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      return undefined;
    }

    const data = (await response.json()) as OllamaShowResponse;

    // Check model_info for context_length (common location)
    if (data.model_info) {
      for (const [key, value] of Object.entries(data.model_info)) {
        // Keys like "llama.context_length" or just "context_length"
        if (key.includes("context_length") && typeof value === "number" && value > 0) {
          return value;
        }
      }
    }

    // Check parameters string for num_ctx
    if (data.parameters) {
      const match = data.parameters.match(/num_ctx\s+(\d+)/i);
      if (match && match[1]) {
        const ctx = parseInt(match[1], 10);
        if (!Number.isNaN(ctx) && ctx > 0) {
          return ctx;
        }
      }
    }

    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Infer context window size based on model name.
 *
 * INVARIANT: Returns >= MINIMUM_CONTEXT_WINDOW (16000) for any model.
 * The embedded agent requires this minimum to function.
 *
 * Model family defaults (when /api/show doesn't provide actual value):
 * - llama3/llama-3: 32768 (llama3.1 supports up to 128k, but 32k is safe default)
 * - llama3 70b/405b: 128000
 * - qwen: 32768
 * - deepseek: 64000
 * - mistral/mixtral: 32768
 * - codellama: 16384
 * - phi: 16000 (clamped from 4096)
 * - unknown: 16000 (minimum floor)
 */
export function inferOllamaContextWindow(modelId: string): number {
  const lower = modelId.toLowerCase();
  let ctx: number;

  // Llama 3.x models - default to 32k (llama3.1 supports 128k, llama3 supports 8k native but we need 16k min)
  if (lower.includes("llama3") || lower.includes("llama-3")) {
    if (lower.includes("70b") || lower.includes("405b")) {
      ctx = 128000;
    } else if (lower.includes("32k")) {
      ctx = 32768;
    } else {
      // Default llama3 to 32k - safe for llama3.1, works for llama3 with extended context
      ctx = 32768;
    }
  }
  // Qwen models - 32k is common for qwen2.5
  else if (lower.includes("qwen")) {
    if (lower.includes("72b") || lower.includes("110b")) {
      ctx = 131072;
    } else {
      ctx = 32768;
    }
  }
  // DeepSeek models - 64k typical
  else if (lower.includes("deepseek")) {
    ctx = 64000;
  }
  // Mistral/Mixtral - 32k
  else if (lower.includes("mistral") || lower.includes("mixtral")) {
    ctx = 32768;
  }
  // CodeLlama - 16k
  else if (lower.includes("codellama")) {
    ctx = 16384;
  }
  // Phi models - native 4k but we clamp to minimum
  else if (lower.includes("phi")) {
    ctx = MINIMUM_CONTEXT_WINDOW;
  }
  // Default: use minimum floor
  else {
    ctx = MINIMUM_CONTEXT_WINDOW;
  }

  // CRITICAL: Clamp to minimum - embedded agent requires at least 16000
  if (ctx < MINIMUM_CONTEXT_WINDOW) {
    ctx = MINIMUM_CONTEXT_WINDOW;
  }

  return ctx;
}

/**
 * Probe Ollama at the given base URL.
 * Returns provider config with discovered models, or null if unreachable.
 *
 * For each model, attempts to query actual context window via /api/show.
 * Falls back to inferOllamaContextWindow() if /api/show doesn't provide ctx.
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
        auth: "none", // Local Ollama requires no API key
        models: [],
      };
    }

    // Build models with context windows (query /api/show for each, fallback to heuristics)
    const models: ModelDefinitionConfig[] = await Promise.all(
      data.models.map(async (model) => {
        const modelId = model.name;
        const isReasoning =
          modelId.toLowerCase().includes("r1") || modelId.toLowerCase().includes("reasoning");

        // Try to get actual context window from Ollama /api/show
        let contextWindow = await getOllamaModelContextWindow(modelId, baseUrl, timeoutMs, fetchFn);

        // Fallback to heuristic if /api/show didn't provide context
        if (contextWindow === undefined) {
          contextWindow = inferOllamaContextWindow(modelId);
        }

        // CRITICAL: Clamp to minimum - embedded agent requires at least 16000
        if (contextWindow < MINIMUM_CONTEXT_WINDOW) {
          contextWindow = MINIMUM_CONTEXT_WINDOW;
        }

        return {
          id: modelId,
          name: modelId,
          reasoning: isReasoning,
          input: ["text"] as ("text" | "image")[],
          cost: OLLAMA_DEFAULT_COST,
          contextWindow,
          maxTokens: 8192,
        };
      }),
    );

    return {
      baseUrl: `${baseUrl}/v1`,
      api: "openai-completions",
      auth: "none", // Local Ollama requires no API key
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
        auth: "none", // Local LM Studio requires no API key
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
      auth: "none", // Local LM Studio requires no API key
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
