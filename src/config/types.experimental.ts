/**
 * Experimental features configuration
 * These features are under active development and may change
 */

export type ContextOptimizerConfig = {
  /** Enable/disable the context optimizer */
  enabled?: boolean;
  /** Optimization level: conservative (safe), balanced (recommended), aggressive (max savings) */
  level?: "conservative" | "balanced" | "aggressive";
  /** Minimum message age before considering for eviction */
  evictionThreshold?: number;
  /** Maximum context ratio before triggering optimization (0.0-1.0) */
  maxContextRatio?: number;
  /** Protected zones that should never be evicted */
  protectedZones?: string[];
  /** Types of content that can be evicted */
  evictableTypes?: string[];
  /** Automatically reload evicted content when needed */
  autoReload?: boolean;
  /** Enable debug logging for optimization decisions */
  debug?: boolean;
};

export type ExperimentalConfig = {
  /** Context optimizer for reducing token costs */
  contextOptimizeCustom?: ContextOptimizerConfig;
  
  // Future experimental features can be added here
  // exampleFeature?: ExampleFeatureConfig;
};