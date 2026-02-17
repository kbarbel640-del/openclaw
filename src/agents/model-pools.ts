/**
 * Unified Model Pools System
 *
 * Provides:
 * - Model pools (ordered lists of models for specific use cases)
 * - Flexible selection modes (ordered, best-fit, agent-choice)
 * - Capability-based validation
 * - Backward compatibility with old config
 */

import type { OpenClawConfig } from "../config/config.js";
import {
  findCapableModels,
  inferModelCapabilities,
  scoreCapabilityMatch,
  validateCapabilities,
} from "../providers/core/capabilities.js";
import { isProviderHealthy } from "../providers/core/health.js";
import { parseModelRef } from "../providers/core/normalization.js";
import type { ModelRef } from "../providers/core/types.js";
import { resolveAgentConfig } from "./agent-scope.js";
import { DEFAULT_MODEL, DEFAULT_PROVIDER } from "./defaults.js";
import type { ModelCatalogEntry } from "./model-catalog.js";
import type { TaskComplexity, TaskType } from "./task-classifier.js";

/**
 * Selection mode for models in a pool.
 */
export type PoolSelectionMode =
  | "ordered" // Use models in order, fallback to next
  | "best-fit" // Auto-select best match by capabilities
  | "agent-choice"; // Agent can choose any model from pool

/**
 * Fallback behavior when a model fails or is unavailable.
 */
export type PoolFallbackBehavior =
  | "next-in-pool" // Try next model in the same pool
  | "next-pool" // Fall back to another pool (e.g., coding → default)
  | "error"; // Fail immediately

/**
 * Capability requirement level.
 */
export type CapabilityLevel = "required" | "preferred" | "optional";

/**
 * Model pool configuration.
 */
export type ModelPoolConfig = {
  /** Ordered list of models in this pool (provider/model strings) */
  models: string[];
  /** Selection strategy for this pool */
  selectionMode?: PoolSelectionMode;
  /** Fallback behavior on failure */
  fallbackBehavior?: PoolFallbackBehavior;
  /** Capability requirements for models in this pool */
  capabilities?: {
    vision?: CapabilityLevel;
    tools?: CapabilityLevel;
    reasoning?: CapabilityLevel;
    extendedThinking?: CapabilityLevel;
    streaming?: CapabilityLevel;
    contextWindow?: number; // Minimum context window
  };
  /** Alternative pool to fallback to */
  fallbackPool?: string;
};

/**
 * Complete model pools configuration.
 */
export type ModelPoolsConfig = {
  /** Default pool for general tasks */
  default: ModelPoolConfig;
  /** Coding/programming tasks pool */
  coding?: ModelPoolConfig;
  /** Deep reasoning/thinking tasks pool */
  thinking?: ModelPoolConfig;
  /** Vision/image analysis tasks pool */
  vision?: ModelPoolConfig;
  /** System operations/tools pool */
  tools?: ModelPoolConfig;
  /** Custom pools */
  [key: string]: ModelPoolConfig | undefined;
};

/**
 * Complexity to pool mapping.
 */
export type ComplexityPoolMapping = {
  trivial?: { pool: string; preferIndex?: number };
  moderate?: { pool: string; preferIndex?: number };
  complex?: { pool: string; preferIndex?: number };
};

/**
 * Selection context for model resolution.
 */
export type ModelSelectionContext = {
  taskType?: TaskType;
  complexity?: TaskComplexity;
  requiredCapabilities?: {
    vision?: boolean;
    tools?: boolean;
    reasoning?: boolean;
    contextWindow?: number;
  };
  preferredCapabilities?: {
    vision?: boolean;
    tools?: boolean;
    reasoning?: boolean;
    contextWindow?: number;
  };
  agentId?: string;
};

/**
 * Get model pools configuration, with auto-migration from old config.
 */
export function getModelPools(cfg: OpenClawConfig, agentId?: string): ModelPoolsConfig {
  // Check for agent-specific pools override
  if (agentId) {
    const agentCfg = resolveAgentConfig(cfg, agentId);
    // @ts-ignore - modelPools not yet in types
    if (agentCfg?.modelPools) {
      // @ts-ignore
      return agentCfg.modelPools as ModelPoolsConfig;
    }
  }

  // Check for global pools config
  // @ts-ignore - modelPools not yet in types
  if (cfg.agents?.defaults?.modelPools) {
    // @ts-ignore
    return cfg.agents.defaults.modelPools as ModelPoolsConfig;
  }

  // Auto-migrate from old config
  return migrateToPoolsConfig(cfg);
}

/**
 * Migrate old model config to pools-based config.
 */
function migrateToPoolsConfig(cfg: OpenClawConfig): ModelPoolsConfig {
  const defaults = cfg.agents?.defaults;

  // Default pool
  const defaultModels = [defaults?.model?.primary, ...(defaults?.model?.fallbacks ?? [])].filter(
    (m): m is string => Boolean(m),
  );

  const pools: ModelPoolsConfig = {
    default: {
      models: defaultModels.length > 0 ? defaultModels : [`${DEFAULT_PROVIDER}/${DEFAULT_MODEL}`],
      selectionMode: "ordered",
      fallbackBehavior: "next-in-pool",
    },
  };

  // Coding pool
  if (defaults?.codingModel) {
    const codingModels = [
      defaults.codingModel.primary,
      ...(defaults.codingModel.fallbacks ?? []),
    ].filter((m): m is string => Boolean(m));

    if (codingModels.length > 0) {
      pools.coding = {
        models: codingModels,
        selectionMode: "agent-choice",
        fallbackBehavior: "next-pool",
        fallbackPool: "default",
      };
    }
  }

  // Vision pool
  if (defaults?.imageModel) {
    const visionModels = [
      defaults.imageModel.primary,
      ...(defaults.imageModel.fallbacks ?? []),
    ].filter((m): m is string => Boolean(m));

    if (visionModels.length > 0) {
      pools.vision = {
        models: visionModels,
        selectionMode: "best-fit",
        fallbackBehavior: "next-pool",
        fallbackPool: "default",
        capabilities: {
          vision: "required",
        },
      };
    }
  }

  // Tools pool
  if (defaults?.toolModel) {
    const toolModels = [defaults.toolModel.primary, ...(defaults.toolModel.fallbacks ?? [])].filter(
      (m): m is string => Boolean(m),
    );

    if (toolModels.length > 0) {
      pools.tools = {
        models: toolModels,
        selectionMode: "ordered",
        fallbackBehavior: "next-pool",
        fallbackPool: "default",
        capabilities: {
          tools: "required",
        },
      };
    }
  }

  return pools;
}

/**
 * Resolve model from pool based on selection context.
 */
export function resolveModelFromPool(params: {
  cfg: OpenClawConfig;
  poolName: string;
  catalog: ModelCatalogEntry[];
  context?: ModelSelectionContext;
  preferIndex?: number;
}): ModelRef | null {
  const { cfg, poolName, catalog, context, preferIndex } = params;
  const pools = getModelPools(cfg, context?.agentId);
  const pool = pools[poolName];

  if (!pool || pool.models.length === 0) {
    return null;
  }

  const mode = pool.selectionMode ?? "ordered";

  switch (mode) {
    case "ordered":
      return selectOrderedFromPool({ pool, catalog, preferIndex });

    case "best-fit":
      return selectBestFitFromPool({ pool, catalog, context });

    case "agent-choice":
      // For now, agent-choice falls back to best-fit
      // TODO: Expose pool options to agent via tool
      return selectBestFitFromPool({ pool, catalog, context });

    default:
      return selectOrderedFromPool({ pool, catalog, preferIndex });
  }
}

/**
 * Select first available model from pool (ordered mode).
 */
function selectOrderedFromPool(params: {
  pool: ModelPoolConfig;
  catalog: ModelCatalogEntry[];
  preferIndex?: number;
}): ModelRef | null {
  const { pool, catalog, preferIndex } = params;

  // Helper to validate a model
  const validateModel = (parsed: ModelRef): boolean => {
    // Check if provider is healthy
    if (!isProviderHealthy(parsed.provider)) {
      return false;
    }

    // Validate capabilities if specified
    if (pool.capabilities) {
      const entry = catalog.find((e) => e.provider === parsed.provider && e.id === parsed.model);
      if (entry) {
        const caps = inferModelCapabilities(entry);
        const required: Record<string, unknown> = {};

        if (pool.capabilities.vision === "required") {
          required.vision = true;
        }
        if (pool.capabilities.tools === "required") {
          required.tools = true;
        }
        if (pool.capabilities.reasoning === "required") {
          required.reasoning = true;
        }
        if (pool.capabilities.contextWindow) {
          required.contextWindow = pool.capabilities.contextWindow;
        }

        const validation = validateCapabilities(caps, required);
        if (!validation.valid) {
          return false;
        }
      }
    }

    return true;
  };

  // If preferIndex specified, try that model first
  if (preferIndex !== undefined && preferIndex >= 0 && preferIndex < pool.models.length) {
    const modelStr = pool.models[preferIndex];
    const parsed = parseModelRef(modelStr, DEFAULT_PROVIDER);
    if (parsed && validateModel(parsed)) {
      return parsed;
    }
  }

  // Fallback: try all models in order
  for (const modelStr of pool.models) {
    const parsed = parseModelRef(modelStr, DEFAULT_PROVIDER);
    if (!parsed) {
      continue;
    }

    if (validateModel(parsed)) {
      return parsed;
    }
  }

  return null;
}

/**
 * Select best-fit model from pool based on capabilities.
 */
function selectBestFitFromPool(params: {
  pool: ModelPoolConfig;
  catalog: ModelCatalogEntry[];
  context?: ModelSelectionContext;
}): ModelRef | null {
  const { pool, catalog, context } = params;

  // Build required/preferred capabilities from pool config + context
  const required: Record<string, unknown> = {};
  const preferred: Record<string, unknown> = {};

  // From pool config
  if (pool.capabilities?.vision === "required") {
    required.vision = true;
  }
  if (pool.capabilities?.vision === "preferred") {
    preferred.vision = true;
  }
  if (pool.capabilities?.tools === "required") {
    required.tools = true;
  }
  if (pool.capabilities?.tools === "preferred") {
    preferred.tools = true;
  }
  if (pool.capabilities?.reasoning === "required") {
    required.reasoning = true;
  }
  if (pool.capabilities?.reasoning === "preferred") {
    preferred.reasoning = true;
  }
  if (pool.capabilities?.contextWindow) {
    required.contextWindow = pool.capabilities.contextWindow;
  }

  // From context
  if (context?.requiredCapabilities?.vision) {
    required.vision = true;
  }
  if (context?.requiredCapabilities?.tools) {
    required.tools = true;
  }
  if (context?.requiredCapabilities?.reasoning) {
    required.reasoning = true;
  }
  if (context?.requiredCapabilities?.contextWindow) {
    required.contextWindow = Math.max(
      (required.contextWindow as number) ?? 0,
      context.requiredCapabilities.contextWindow,
    );
  }

  if (context?.preferredCapabilities?.vision) {
    preferred.vision = true;
  }
  if (context?.preferredCapabilities?.tools) {
    preferred.tools = true;
  }
  if (context?.preferredCapabilities?.reasoning) {
    preferred.reasoning = true;
  }

  // Filter pool models to those in catalog
  const poolRefs = pool.models
    .map((m) => parseModelRef(m, DEFAULT_PROVIDER))
    .filter((r): r is ModelRef => r !== null);

  const poolEntries = catalog.filter((entry) =>
    poolRefs.some((ref) => ref.provider === entry.provider && ref.model === entry.id),
  );

  // Find capable models
  const capable = findCapableModels(poolEntries, required);
  if (capable.length === 0) {
    // No models meet requirements - fallback to ordered
    return selectOrderedFromPool({ pool, catalog });
  }

  // Score by preferred capabilities + health
  const scored = capable.map((entry) => {
    const caps = inferModelCapabilities(entry);
    const capScore = scoreCapabilityMatch(caps, { ...required, ...preferred });

    // Boost score if provider is healthy
    const healthBoost = isProviderHealthy(entry.provider) ? 10 : 0;

    return {
      entry,
      score: capScore + healthBoost,
    };
  });

  // Sort by score (descending)
  scored.sort((a, b) => b.score - a.score);

  const best = scored[0]?.entry;
  if (!best) {
    return null;
  }

  return {
    provider: best.provider,
    model: best.id,
  };
}

/**
 * Get complexity to pool mapping.
 */
export function getComplexityMapping(cfg: OpenClawConfig, agentId?: string): ComplexityPoolMapping {
  // Check agent-specific override
  if (agentId) {
    const agentCfg = resolveAgentConfig(cfg, agentId);
    // @ts-ignore
    if (agentCfg?.complexityMapping) {
      // @ts-ignore
      return agentCfg.complexityMapping as ComplexityPoolMapping;
    }
  }

  // Check global config
  // @ts-ignore
  if (cfg.agents?.defaults?.complexityMapping) {
    // @ts-ignore
    return cfg.agents.defaults.complexityMapping as ComplexityPoolMapping;
  }

  // Auto-generate from modelByComplexity
  const complexity = cfg.agents?.defaults?.modelByComplexity;
  if (complexity) {
    const mapping: ComplexityPoolMapping = {};

    if (complexity.trivial) {
      mapping.trivial = { pool: "default", preferIndex: 1 };
    }
    if (complexity.moderate) {
      mapping.moderate = { pool: "default", preferIndex: 0 };
    }
    if (complexity.complex) {
      mapping.complex = { pool: "thinking", preferIndex: 0 };
    }

    return mapping;
  }

  // Default mapping
  return {
    trivial: { pool: "default", preferIndex: 1 },
    moderate: { pool: "default", preferIndex: 0 },
    complex: { pool: "default", preferIndex: 0 },
  };
}

/**
 * Resolve model based on task type and complexity (unified logic).
 */
export function resolveModelForTask(params: {
  cfg: OpenClawConfig;
  catalog: ModelCatalogEntry[];
  taskType?: TaskType;
  complexity?: TaskComplexity;
  agentId?: string;
}): ModelRef | null {
  const { cfg, catalog, taskType, complexity, agentId } = params;

  // Get complexity mapping and preferIndex
  const mapping = getComplexityMapping(cfg, agentId);
  const complexityConfig = complexity ? mapping[complexity] : undefined;

  // Determine pool and preferIndex based on complexity first
  let poolName = "default";
  let preferIndex: number | undefined;

  if (complexityConfig) {
    poolName = complexityConfig.pool;
    preferIndex = complexityConfig.preferIndex;
  }

  // Override pool based on task type (task type takes precedence)
  if (taskType === "coding") {
    poolName = "coding";
    preferIndex = undefined; // Reset preferIndex for task-type pools
  } else if (taskType === "vision") {
    poolName = "vision";
    preferIndex = undefined;
  } else if (taskType === "tools") {
    poolName = "tools";
    preferIndex = undefined;
  } else if (taskType === "reasoning") {
    poolName = "thinking";
    preferIndex = undefined;
  }

  // Try primary pool
  const context: ModelSelectionContext = {
    taskType,
    complexity,
    agentId,
    requiredCapabilities: taskType === "vision" ? { vision: true } : undefined,
  };

  let model = resolveModelFromPool({ cfg, poolName, catalog, context, preferIndex });

  // Fallback to default pool if primary pool fails
  if (!model && poolName !== "default") {
    model = resolveModelFromPool({ cfg, poolName: "default", catalog, context });
  }

  return model;
}
