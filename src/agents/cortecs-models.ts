import type { ModelDefinitionConfig } from "../config/types.js";

/**
 * ---------------------------------------------------------------------------
 * Cortecs constants
 * ---------------------------------------------------------------------------
 */

//TODO FIX::::::
export const CORTECS_BASE_URL = "https://api.cortecs.ai/v1/";
export const CORTECS_MODELS_URL = `${CORTECS_BASE_URL}models`;

export const CORTECS_DEFAULT_MODEL_ID = "gpt-oss-120b";
export const CORTECS_DEFAULT_MODEL_REF = `cortecs/${CORTECS_DEFAULT_MODEL_ID}`;
export const CORTECS_DEFAULT_CONTEXT_WINDOW = 128000;
export const CORTECS_DEFAULT_MAX_TOKENS = 8192;
export const CORTECS_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

/**
 * ---------------------------------------------------------------------------
 * Cortecs /v1/models response types
 * ---------------------------------------------------------------------------
 */
interface CortecsPricing {
  /** Cost per 1M input tokens (as returned by Cortecs). */
  input_token: number;
  /** Cost per 1M output tokens (as returned by Cortecs). */
  output_token: number;
  currency: string;
}

interface CortecsModel {
  id: string;
  object: "model";
  created: number;
  owned_by: string;
  description?: string;
  pricing?: CortecsPricing;
  context_size?: number;
  tags?: string[];
}

interface CortecsModelsResponse {
  object: "list";
  data: CortecsModel[];
}

/**
 * ---------------------------------------------------------------------------
 * Default Cortecs model definition (fallback)
 * ---------------------------------------------------------------------------
 */
export function buildCortecsModelDefinition(): ModelDefinitionConfig {
  return {
    id: CORTECS_DEFAULT_MODEL_ID,
    name: "GPT Oss 120b",
    reasoning: true,
    input: ["text"],
    cost: CORTECS_DEFAULT_COST,
    contextWindow: CORTECS_DEFAULT_CONTEXT_WINDOW,
    maxTokens: CORTECS_DEFAULT_MAX_TOKENS,
  };
}

/**
 * ---------------------------------------------------------------------------
 * Discover models from Cortecs /v1/models (with fallback)
 * ---------------------------------------------------------------------------
 */
export async function discoverCortecsModels(): Promise<ModelDefinitionConfig[]> {
  // Skip API discovery in test environment
  if (process.env.VITEST || process.env.NODE_ENV === "test") {
    return [buildCortecsModelDefinition()];
  }

  try {
    const res = await fetch(CORTECS_MODELS_URL, {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      console.warn(
        `[cortecs-models] Failed to discover models: HTTP ${res.status}, using default model`,
      );
      return [buildCortecsModelDefinition()];
    }

    const payload = (await res.json()) as CortecsModelsResponse;

    if (!Array.isArray(payload.data) || payload.data.length === 0) {
      console.warn("[cortecs-models] No models found from catalog, using default model");
      return [buildCortecsModelDefinition()];
    }

    const models: ModelDefinitionConfig[] = payload.data.map((m) => {
      const tags = m.tags ?? [];
      const tagsLower = new Set(tags.map((t) => t.toLowerCase()));

      const reasoning = tagsLower.has("reasoning");
      const hasVision = tagsLower.has("image");

      return {
        id: m.id,
        name: m.id,
        reasoning,
        input: hasVision ? ["text", "image"] : ["text"],
        cost: {
          // Cortecs already returns per-1M-token pricing in numeric form.
          input: Number.isFinite(m.pricing?.input_token as number)
            ? (m.pricing!.input_token ?? 0)
            : 0,
          output: Number.isFinite(m.pricing?.output_token as number)
            ? (m.pricing!.output_token ?? 0)
            : 0,
          cacheRead: 0,
          cacheWrite: 0,
        },
        contextWindow: m.context_size ?? CORTECS_DEFAULT_CONTEXT_WINDOW,

        /**
         * Cortecs /v1/models does not provide a separate "max output tokens".
         * Many systems cap maxTokens separately from contextWindow.
         *
         * We choose a conservative default unless you later add a field.
         */
        maxTokens: CORTECS_DEFAULT_MAX_TOKENS,
      };
    });
    return models.length > 0 ? models : [buildCortecsModelDefinition()];
  } catch (error) {
    console.warn(`[cortecs-models] Discovery failed: ${String(error)}, using default model`);
    return [buildCortecsModelDefinition()];
  }
}
