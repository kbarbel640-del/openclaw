/**
 * Morpheus Inference API - Model Discovery
 *
 * The Morpheus Inference Marketplace provides access to open-source models
 * through a decentralized P2P network. Models include GLM-5, Kimi K2.5,
 * GLM 4.7 Flash, MiniMax M2.5, and 30+ others.
 *
 * API Base URL: https://api.mor.org/api/v1
 * Documentation: https://apidocs.mor.org/
 *
 * @see https://api.mor.org/api/v1/models
 */

import { createSubsystemLogger } from "../logging/subsystem.js";
import type { ModelDefinitionConfig } from "../config/types.js";

const log = createSubsystemLogger("morpheus-models");

export const MORPHEUS_BASE_URL = "https://api.mor.org/api/v1";
export const MORPHEUS_DEFAULT_MODEL_ID = "glm-5";
export const MORPHEUS_DEFAULT_MODEL_REF = \`morpheus/\${MORPHEUS_DEFAULT_MODEL_ID}\`;

// Morpheus provides free inference (no per-token costs until billing is implemented)
export const MORPHEUS_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

/**
 * Morpheus model catalog - fetched dynamically from /models endpoint.
 *
 * This catalog serves as a fallback when the Morpheus API is unreachable.
 * Models are clustered by provider (GLM, Kimi, MiniMax, Llama, Qwen, etc.)
 *
 * Each model has a blockchainID for on-chain verification.
 */
export const MORPHEUS_MODEL_CATALOG = [
  // GLM MODELS (Zhipu AI)
  { id: "glm-5", name: "GLM-5", reasoning: true, input: ["text"], contextWindow: 131072, maxTokens: 8192 },
  { id: "glm-5:web", name: "GLM-5 Web", reasoning: true, input: ["text"], contextWindow: 131072, maxTokens: 8192 },
  { id: "glm-4.7", name: "GLM-4.7", reasoning: false, input: ["text"], contextWindow: 131072, maxTokens: 8192 },
  { id: "glm-4.7:web", name: "GLM-4.7 Web", reasoning: false, input: ["text"], contextWindow: 131072, maxTokens: 8192 },
  { id: "glm-4.7-flash", name: "GLM-4.7 Flash", reasoning: false, input: ["text"], contextWindow: 131072, maxTokens: 8192 },
  { id: "glm-4.7-flash:web", name: "GLM-4.7 Flash Web", reasoning: false, input: ["text"], contextWindow: 131072, maxTokens: 8192 },
  { id: "glm-4.7-thinking", name: "GLM-4.7 Thinking", reasoning: true, input: ["text"], contextWindow: 131072, maxTokens: 8192 },
  { id: "glm-4.7-thinking:web", name: "GLM-4.7 Thinking Web", reasoning: true, input: ["text"], contextWindow: 131072, maxTokens: 8192 },
  { id: "glm-4.6", name: "GLM-4.6", reasoning: false, input: ["text"], contextWindow: 131072, maxTokens: 8192 },
  { id: "glm-4.6:web", name: "GLM-4.6 Web", reasoning: false, input: ["text"], contextWindow: 131072, maxTokens: 8192 },
  // KIMI MODELS (Moonshot AI)
  { id: "kimi-k2.5", name: "Kimi K2.5", reasoning: false, input: ["text"], contextWindow: 256000, maxTokens: 8192 },
  { id: "kimi-k2.5:web", name: "Kimi K2.5 Web", reasoning: false, input: ["text"], contextWindow: 256000, maxTokens: 8192 },
  { id: "kimi-k2-thinking", name: "Kimi K2 Thinking", reasoning: true, input: ["text"], contextWindow: 256000, maxTokens: 8192 },
  { id: "kimi-k2-thinking:web", name: "Kimi K2 Thinking Web", reasoning: true, input: ["text"], contextWindow: 256000, maxTokens: 8192 },
  // MINIMAX MODELS
  { id: "MiniMax-M2.5", name: "MiniMax M2.5", reasoning: false, input: ["text"], contextWindow: 131072, maxTokens: 8192 },
  { id: "MiniMax-M2.5:web", name: "MiniMax M2.5 Web", reasoning: false, input: ["text"], contextWindow: 131072, maxTokens: 8192 },
  // LLAMA MODELS (Meta)
  { id: "llama-3.3-70b", name: "Llama 3.3 70B", reasoning: false, input: ["text"], contextWindow: 131072, maxTokens: 8192 },
  { id: "llama-3.3-70b:web", name: "Llama 3.3 70B Web", reasoning: false, input: ["text"], contextWindow: 131072, maxTokens: 8192 },
  { id: "llama-3.2-3b", name: "Llama 3.2 3B", reasoning: false, input: ["text"], contextWindow: 131072, maxTokens: 8192 },
  { id: "llama-3.2-3b:web", name: "Llama 3.2 3B Web", reasoning: false, input: ["text"], contextWindow: 131072, maxTokens: 8192 },
  // HERMES MODELS (Nous Research)
  { id: "hermes-3-llama-3.1-405b", name: "Hermes 3 Llama 3.1 405B", reasoning: false, input: ["text"], contextWindow: 131072, maxTokens: 8192 },
  { id: "hermes-3-llama-3.1-405b:web", name: "Hermes 3 Llama 3.1 405B Web", reasoning: false, input: ["text"], contextWindow: 131072, maxTokens: 8192 },
  { id: "hermes-4-14b", name: "Hermes 4 14B", reasoning: false, input: ["text"], contextWindow: 131072, maxTokens: 8192 },
  // QWEN MODELS (Alibaba)
  { id: "qwen3-235b", name: "Qwen3 235B", reasoning: false, input: ["text"], contextWindow: 131072, maxTokens: 8192 },
  { id: "qwen3-235b:web", name: "Qwen3 235B Web", reasoning: false, input: ["text"], contextWindow: 131072, maxTokens: 8192 },
  { id: "qwen3-next-80b", name: "Qwen3 Next 80B", reasoning: false, input: ["text"], contextWindow: 131072, maxTokens: 8192 },
  { id: "qwen3-next-80b:web", name: "Qwen3 Next 80B Web", reasoning: false, input: ["text"], contextWindow: 131072, maxTokens: 8192 },
  { id: "qwen3-coder-480b-a35b-instruct", name: "Qwen3 Coder 480B", reasoning: false, input: ["text"], contextWindow: 131072, maxTokens: 8192 },
  { id: "qwen3-coder-480b-a35b-instruct:web", name: "Qwen3 Coder 480B Web", reasoning: false, input: ["text"], contextWindow: 131072, maxTokens: 8192 },
  // MISTRAL MODELS
  { id: "mistral-31-24b", name: "Mistral 3.1 24B", reasoning: false, input: ["text"], contextWindow: 131072, maxTokens: 8192 },
  { id: "mistral-31-24b:web", name: "Mistral 3.1 24B Web", reasoning: false, input: ["text"], contextWindow: 131072, maxTokens: 8192 },
  // OTHER MODELS
  { id: "gpt-oss-120b", name: "GPT-OSS 120B", reasoning: false, input: ["text"], contextWindow: 131072, maxTokens: 8192 },
  { id: "gpt-oss-120b:web", name: "GPT-OSS 120B Web", reasoning: false, input: ["text"], contextWindow: 131072, maxTokens: 8192 },
  { id: "venice-uncensored", name: "Venice Uncensored", reasoning: false, input: ["text"], contextWindow: 131072, maxTokens: 8192 },
] as const;

type MorpheusModelEntry = (typeof MORPHEUS_MODEL_CATALOG)[number];

type MorpheusModelsResponse = {
  object: string;
  data: Array<{
    id: string;
    blockchainID?: string;
    created?: number;
    tags?: string[];
    modelType?: string;
  }>;
};

/**
 * Fetch the live model list from Morpheus API.
 * Falls back to static catalog on error.
 */
export async function discoverMorpheusModels(
  fetchFn: typeof fetch = fetch,
  baseUrl: string = MORPHEUS_BASE_URL,
): Promise<ModelDefinitionConfig[]> {
  try {
    const response = await fetchFn(\`\${baseUrl}/models\`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      log.warn("Morpheus API returned non-OK status", { status: response.status });
      return buildFallbackModels();
    }

    const data = (await response.json()) as MorpheusModelsResponse;

    if (!data.data || !Array.isArray(data.data)) {
      log.warn("Morpheus API returned unexpected shape");
      return buildFallbackModels();
    }

    const models: ModelDefinitionConfig[] = data.data
      .filter((m) => m.modelType !== "EMBEDDING")
      .map((apiModel) => {
        const catalogEntry = MORPHEUS_MODEL_CATALOG.find(
          (c) => c.id === apiModel.id || c.id === apiModel.id.replace(":web", ""),
        );

        return {
          id: apiModel.id,
          name: catalogEntry?.name ?? apiModel.id,
          reasoning: catalogEntry?.reasoning ?? false,
          input: catalogEntry?.input ? [...catalogEntry.input] : ["text"],
          contextWindow: catalogEntry?.contextWindow ?? 131072,
          maxTokens: catalogEntry?.maxTokens ?? 8192,
          cost: MORPHEUS_DEFAULT_COST,
        };
      });

    if (models.length === 0) {
      log.warn("Morpheus API returned empty model list");
      return buildFallbackModels();
    }

    log.info("Discovered Morpheus models", { count: models.length });
    return models;
  } catch (error) {
    log.warn("Failed to fetch Morpheus models, using fallback catalog", { error: String(error) });
    return buildFallbackModels();
  }
}

function buildFallbackModels(): ModelDefinitionConfig[] {
  return MORPHEUS_MODEL_CATALOG.map((entry) => ({
    id: entry.id,
    name: entry.name,
    reasoning: entry.reasoning,
    input: [...entry.input],
    contextWindow: entry.contextWindow,
    maxTokens: entry.maxTokens,
    cost: MORPHEUS_DEFAULT_COST,
  }));
}

export function buildMorpheusModelDefinition(entry: MorpheusModelEntry): ModelDefinitionConfig {
  return {
    id: entry.id,
    name: entry.name,
    reasoning: entry.reasoning,
    input: [...entry.input],
    contextWindow: entry.contextWindow,
    maxTokens: entry.maxTokens,
    cost: MORPHEUS_DEFAULT_COST,
  };
}
