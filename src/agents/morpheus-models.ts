import type { ModelDefinitionConfig } from "../config/types.js";

/**
 * Morpheus decentralized AI inference — model catalog and discovery.
 *
 * Morpheus routes inference through its P2P network via proxy-router.
 * Models are registered on-chain (Base mainnet) with hex IDs.
 *
 * Two access modes:
 * 1. Gateway (api.mor.org) — OpenAI-compatible, uses API key directly
 * 2. Local proxy-router — requires session management + blockchain model IDs
 *
 * Key fixes from Everclaw integration (13 bugs found):
 * - Dynamic model IDs from blockchain API (not hardcoded hex values)
 * - Never use maxUint256 with increaseAllowance (Solidity overflow panic 0x11)
 * - Correct decimal handling for session economics (wei, not kwei)
 * - Auto-session management with renewal before expiry
 * - Billing-aware error classification (server_error, never "billing")
 */

export const MORPHEUS_GATEWAY_BASE_URL = "https://api.mor.org/api/v1";
export const MORPHEUS_DEFAULT_MODEL_ID = "kimi-k2.5";
export const MORPHEUS_DEFAULT_MODEL_REF = `morpheus/${MORPHEUS_DEFAULT_MODEL_ID}`;

// Morpheus uses MOR token staking for sessions, not per-token billing.
// A 7-day session stakes ~1.9 MOR (returned when session ends).
export const MORPHEUS_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

/**
 * Blockchain model ID mapping for the local proxy-router path.
 * These hex IDs correspond to on-chain model registrations on Base mainnet.
 * When using the gateway (api.mor.org), friendly model names work directly.
 *
 * To get fresh IDs: GET {routerUrl}/blockchain/models
 */
export const MORPHEUS_MODEL_MAP: Record<string, string> = {
  "kimi-k2.5": "0xbb9e920d94ad3fa2861e1e209d0a969dbe9e1af1cf1ad95c49f76d7b63d32d93",
  "kimi-k2.5:web": "0xb487ee62516981f533d9164a0a3dcca836b06144506ad47a5c024a7a2a33fc58",
  "kimi-k2-thinking": "0xc40b0a1ea1b20e042449ae44ffee8e87f3b8ba3d0be3ea61b86e6a89ba1a44e3",
  "glm-4.7-flash": "0xfdc54de0b7f3e3525b4173f49e3819aebf1ed31e06d96be4eefaca04f2fcaeff",
  "glm-4.7": "0xed0a2bc2a6e28cc87a9b55bc24b61f089f3c86b15d94e5776bc0312e0b4df34b",
  "qwen3-235b": "0x2a71d1dfad6a7ead6e0c7f3d87d9a3c64e8bfa53f9a62fb71b83e7f49e3a6c0b",
  "llama-3.3-70b": "0xc753061a5d2640decfbbc1d1d35744e6805015d30d32872f814a93784c627fc3",
  "gpt-oss-120b": "0x2e7228fe07523d84307838aa617141a5e47af0e00b4eaeab1522bc71985ffd11",
};

/**
 * Static model catalog — fallback when blockchain API is unreachable.
 * These are the known-good models available on the Morpheus network.
 */
export const MORPHEUS_MODEL_CATALOG = [
  {
    id: "kimi-k2.5",
    name: "Kimi K2.5",
    reasoning: false,
    input: ["text"],
    contextWindow: 131072,
    maxTokens: 8192,
  },
  {
    id: "kimi-k2.5:web",
    name: "Kimi K2.5 Web",
    reasoning: false,
    input: ["text"],
    contextWindow: 131072,
    maxTokens: 8192,
  },
  {
    id: "kimi-k2-thinking",
    name: "Kimi K2 Thinking",
    reasoning: true,
    input: ["text"],
    contextWindow: 131072,
    maxTokens: 8192,
  },
  {
    id: "glm-4.7-flash",
    name: "GLM 4.7 Flash",
    reasoning: false,
    input: ["text"],
    contextWindow: 202752,
    maxTokens: 8192,
  },
  {
    id: "glm-4.7",
    name: "GLM 4.7",
    reasoning: true,
    input: ["text"],
    contextWindow: 202752,
    maxTokens: 8192,
  },
  {
    id: "qwen3-235b",
    name: "Qwen3 235B",
    reasoning: true,
    input: ["text"],
    contextWindow: 131072,
    maxTokens: 8192,
  },
  {
    id: "llama-3.3-70b",
    name: "Llama 3.3 70B",
    reasoning: false,
    input: ["text"],
    contextWindow: 131072,
    maxTokens: 8192,
  },
  {
    id: "gpt-oss-120b",
    name: "GPT OSS 120B",
    reasoning: false,
    input: ["text"],
    contextWindow: 131072,
    maxTokens: 8192,
  },
] as const;

export type MorpheusCatalogEntry = (typeof MORPHEUS_MODEL_CATALOG)[number];

/**
 * Build a ModelDefinitionConfig from a Morpheus catalog entry.
 */
export function buildMorpheusModelDefinition(
  entry: MorpheusCatalogEntry,
): ModelDefinitionConfig {
  return {
    id: entry.id,
    name: entry.name,
    reasoning: entry.reasoning,
    input: [...entry.input],
    cost: MORPHEUS_DEFAULT_COST,
    contextWindow: entry.contextWindow,
    maxTokens: entry.maxTokens,
  };
}

/**
 * Resolve a friendly model name to a blockchain hex ID.
 * Returns null if the model isn't known and doesn't look like a hex ID.
 */
export function resolveBlockchainModelId(modelName: string): string | null {
  if (MORPHEUS_MODEL_MAP[modelName]) {
    return MORPHEUS_MODEL_MAP[modelName]!;
  }
  // Accept raw hex model IDs (66 chars: "0x" + 64 hex digits)
  if (modelName.startsWith("0x") && modelName.length === 66) {
    return modelName;
  }
  // Case-insensitive fallback
  const lower = modelName.toLowerCase();
  for (const [key, val] of Object.entries(MORPHEUS_MODEL_MAP)) {
    if (key.toLowerCase() === lower) {
      return val;
    }
  }
  return null;
}

/**
 * Discover models from the Morpheus network.
 *
 * When a proxy-router URL is available, queries its blockchain endpoint
 * for the live model registry. Falls back to the static catalog.
 *
 * @param routerUrl - Optional URL of the local Morpheus proxy-router
 */
export async function discoverMorpheusModels(
  routerUrl?: string,
): Promise<ModelDefinitionConfig[]> {
  // Skip network calls in test environments
  if (process.env.NODE_ENV === "test" || process.env.VITEST) {
    return MORPHEUS_MODEL_CATALOG.map(buildMorpheusModelDefinition);
  }

  // Try blockchain discovery via local proxy-router
  if (routerUrl) {
    try {
      const url = `${routerUrl.replace(/\/+$/, "")}/blockchain/models`;
      const response = await fetch(url, {
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = (await response.json()) as {
          data?: Array<{ id: string; name?: string }>;
        };
        if (Array.isArray(data.data) && data.data.length > 0) {
          const catalogById = new Map<string, MorpheusCatalogEntry>(
            MORPHEUS_MODEL_CATALOG.map((m) => [m.id, m]),
          );
          const models: ModelDefinitionConfig[] = [];

          for (const apiModel of data.data) {
            const catalogEntry = catalogById.get(apiModel.id);
            if (catalogEntry) {
              models.push(buildMorpheusModelDefinition(catalogEntry));
            } else {
              // Newly discovered model not in static catalog
              models.push({
                id: apiModel.id,
                name: apiModel.name || apiModel.id,
                reasoning: false,
                input: ["text"],
                cost: MORPHEUS_DEFAULT_COST,
                contextWindow: 131072,
                maxTokens: 8192,
              });
            }
          }

          if (models.length > 0) {
            return models;
          }
        }
      }
    } catch {
      console.warn("[morpheus-models] Blockchain discovery failed, using static catalog");
    }
  }

  return MORPHEUS_MODEL_CATALOG.map(buildMorpheusModelDefinition);
}
