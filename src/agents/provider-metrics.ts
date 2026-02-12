/**
 * Comprehensive metrics system for AI provider observability.
 * Tracks latency, success/error rates, token usage, and costs per provider+model.
 */

// ============================================================================
// Metric Types
// ============================================================================

export type ProviderMetricName =
  | "request.started"
  | "request.success"
  | "request.error"
  | "request.latency"
  | "tokens.input"
  | "tokens.output"
  | "tokens.total"
  | "cost.estimated"
  | "fallback.triggered"
  | "rate_limit.hit";

export interface MetricEvent {
  /** Metric name */
  name: ProviderMetricName;
  /** Metric value */
  value: number;
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** Labels for dimensions (provider, model, error_type, etc.) */
  labels: {
    provider: string;
    model: string;
    error_type?: string;
    fallback_to?: string;
  };
}

export type OnMetricCallback = (event: MetricEvent) => void;

// ============================================================================
// Latency Percentiles
// ============================================================================

class LatencyTracker {
  private samples: number[] = [];
  private readonly maxSamples: number;

  constructor(maxSamples: number = 1000) {
    this.maxSamples = maxSamples;
  }

  add(latencyMs: number): void {
    this.samples.push(latencyMs);
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }
  }

  percentile(p: number): number {
    if (this.samples.length === 0) {
      return 0;
    }
    const sorted = [...this.samples].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)] ?? 0;
  }

  count(): number {
    return this.samples.length;
  }

  reset(): void {
    this.samples = [];
  }
}

// ============================================================================
// Per-Model Stats
// ============================================================================

interface ModelStats {
  requests: {
    started: number;
    success: number;
    error: number;
  };
  latency: LatencyTracker;
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  cost: {
    estimated: number;
  };
  errors: Record<string, number>;
  fallbacks: {
    triggered: number;
    targets: Record<string, number>;
  };
  rateLimits: number;
  lastRequestAt: number;
}

function createModelStats(): ModelStats {
  return {
    requests: {
      started: 0,
      success: 0,
      error: 0,
    },
    latency: new LatencyTracker(),
    tokens: {
      input: 0,
      output: 0,
      total: 0,
    },
    cost: {
      estimated: 0,
    },
    errors: {},
    fallbacks: {
      triggered: 0,
      targets: {},
    },
    rateLimits: 0,
    lastRequestAt: 0,
  };
}

// ============================================================================
// Metrics Snapshot
// ============================================================================

export interface ProviderMetricsSnapshot {
  /** Per-provider stats */
  providers: Record<
    string,
    {
      /** Per-model stats */
      models: Record<
        string,
        {
          requests: {
            started: number;
            success: number;
            error: number;
            successRate: number;
            errorRate: number;
          };
          latency: {
            p50: number;
            p95: number;
            p99: number;
            count: number;
          };
          tokens: {
            input: number;
            output: number;
            total: number;
          };
          cost: {
            estimated: number;
          };
          errors: Record<string, number>;
          fallbacks: {
            triggered: number;
            targets: Record<string, number>;
          };
          rateLimits: number;
          lastRequestAt: number;
        }
      >;
      /** Aggregated provider totals */
      totals: {
        requests: {
          started: number;
          success: number;
          error: number;
          successRate: number;
          errorRate: number;
        };
        tokens: {
          input: number;
          output: number;
          total: number;
        };
        cost: {
          estimated: number;
        };
        fallbacks: number;
        rateLimits: number;
      };
    }
  >;
  /** Global totals */
  global: {
    requests: {
      started: number;
      success: number;
      error: number;
      successRate: number;
      errorRate: number;
    };
    tokens: {
      input: number;
      output: number;
      total: number;
    };
    cost: {
      estimated: number;
    };
    fallbacks: number;
    rateLimits: number;
    activeProviders: number;
    activeModels: number;
  };
  /** Snapshot timestamp */
  snapshotAt: number;
}

// ============================================================================
// Metrics Collector
// ============================================================================

export interface ProviderMetrics {
  /** Emit a metric event */
  emit: (
    name: ProviderMetricName,
    value: number,
    labels: { provider: string; model: string; error_type?: string; fallback_to?: string },
  ) => void;

  /** Get current metrics snapshot */
  getSnapshot: () => ProviderMetricsSnapshot;

  /** Reset all metrics to zero */
  reset: () => void;

  /** Reset metrics for a specific provider or model */
  resetProvider: (provider: string, model?: string) => void;
}

/**
 * Create a provider metrics collector instance.
 * Optionally pass an onMetric callback to receive real-time metric events.
 */
export function createProviderMetrics(onMetric?: OnMetricCallback): ProviderMetrics {
  // Per-provider, per-model stats
  const stats = new Map<string, Map<string, ModelStats>>();

  function getOrCreateStats(provider: string, model: string): ModelStats {
    let providerMap = stats.get(provider);
    if (!providerMap) {
      providerMap = new Map();
      stats.set(provider, providerMap);
    }
    let modelStats = providerMap.get(model);
    if (!modelStats) {
      modelStats = createModelStats();
      providerMap.set(model, modelStats);
    }
    return modelStats;
  }

  function emit(
    name: ProviderMetricName,
    value: number,
    labels: { provider: string; model: string; error_type?: string; fallback_to?: string },
  ): void {
    const { provider, model, error_type, fallback_to } = labels;

    // Fire callback if provided
    if (onMetric) {
      onMetric({
        name,
        value,
        timestamp: Date.now(),
        labels: { provider, model, error_type, fallback_to },
      });
    }

    const modelStats = getOrCreateStats(provider, model);

    switch (name) {
      case "request.started":
        modelStats.requests.started += value;
        modelStats.lastRequestAt = Date.now();
        break;

      case "request.success":
        modelStats.requests.success += value;
        break;

      case "request.error":
        modelStats.requests.error += value;
        if (error_type) {
          modelStats.errors[error_type] = (modelStats.errors[error_type] ?? 0) + value;
        }
        break;

      case "request.latency":
        modelStats.latency.add(value);
        break;

      case "tokens.input":
        modelStats.tokens.input += value;
        modelStats.tokens.total += value;
        break;

      case "tokens.output":
        modelStats.tokens.output += value;
        modelStats.tokens.total += value;
        break;

      case "tokens.total":
        // Allow direct total tracking if needed
        modelStats.tokens.total += value;
        break;

      case "cost.estimated":
        modelStats.cost.estimated += value;
        break;

      case "fallback.triggered":
        modelStats.fallbacks.triggered += value;
        if (fallback_to) {
          modelStats.fallbacks.targets[fallback_to] =
            (modelStats.fallbacks.targets[fallback_to] ?? 0) + value;
        }
        break;

      case "rate_limit.hit":
        modelStats.rateLimits += value;
        break;
    }
  }

  function getSnapshot(): ProviderMetricsSnapshot {
    const providers: ProviderMetricsSnapshot["providers"] = {};

    let globalStarted = 0;
    let globalSuccess = 0;
    let globalError = 0;
    let globalTokensInput = 0;
    let globalTokensOutput = 0;
    let globalTokensTotal = 0;
    let globalCost = 0;
    let globalFallbacks = 0;
    let globalRateLimits = 0;
    let activeModelsCount = 0;

    for (const [provider, providerMap] of stats) {
      const models: Record<string, any> = {};
      let providerStarted = 0;
      let providerSuccess = 0;
      let providerError = 0;
      let providerTokensInput = 0;
      let providerTokensOutput = 0;
      let providerTokensTotal = 0;
      let providerCost = 0;
      let providerFallbacks = 0;
      let providerRateLimits = 0;

      for (const [model, modelStats] of providerMap) {
        const started = modelStats.requests.started;
        const success = modelStats.requests.success;
        const error = modelStats.requests.error;
        const total = success + error;
        const successRate = total > 0 ? success / total : 0;
        const errorRate = total > 0 ? error / total : 0;

        models[model] = {
          requests: {
            started,
            success,
            error,
            successRate,
            errorRate,
          },
          latency: {
            p50: modelStats.latency.percentile(50),
            p95: modelStats.latency.percentile(95),
            p99: modelStats.latency.percentile(99),
            count: modelStats.latency.count(),
          },
          tokens: {
            input: modelStats.tokens.input,
            output: modelStats.tokens.output,
            total: modelStats.tokens.total,
          },
          cost: {
            estimated: modelStats.cost.estimated,
          },
          errors: { ...modelStats.errors },
          fallbacks: {
            triggered: modelStats.fallbacks.triggered,
            targets: { ...modelStats.fallbacks.targets },
          },
          rateLimits: modelStats.rateLimits,
          lastRequestAt: modelStats.lastRequestAt,
        };

        providerStarted += started;
        providerSuccess += success;
        providerError += error;
        providerTokensInput += modelStats.tokens.input;
        providerTokensOutput += modelStats.tokens.output;
        providerTokensTotal += modelStats.tokens.total;
        providerCost += modelStats.cost.estimated;
        providerFallbacks += modelStats.fallbacks.triggered;
        providerRateLimits += modelStats.rateLimits;
        activeModelsCount++;
      }

      const providerTotal = providerSuccess + providerError;
      const providerSuccessRate = providerTotal > 0 ? providerSuccess / providerTotal : 0;
      const providerErrorRate = providerTotal > 0 ? providerError / providerTotal : 0;

      providers[provider] = {
        models,
        totals: {
          requests: {
            started: providerStarted,
            success: providerSuccess,
            error: providerError,
            successRate: providerSuccessRate,
            errorRate: providerErrorRate,
          },
          tokens: {
            input: providerTokensInput,
            output: providerTokensOutput,
            total: providerTokensTotal,
          },
          cost: {
            estimated: providerCost,
          },
          fallbacks: providerFallbacks,
          rateLimits: providerRateLimits,
        },
      };

      globalStarted += providerStarted;
      globalSuccess += providerSuccess;
      globalError += providerError;
      globalTokensInput += providerTokensInput;
      globalTokensOutput += providerTokensOutput;
      globalTokensTotal += providerTokensTotal;
      globalCost += providerCost;
      globalFallbacks += providerFallbacks;
      globalRateLimits += providerRateLimits;
    }

    const globalTotal = globalSuccess + globalError;
    const globalSuccessRate = globalTotal > 0 ? globalSuccess / globalTotal : 0;
    const globalErrorRate = globalTotal > 0 ? globalError / globalTotal : 0;

    return {
      providers,
      global: {
        requests: {
          started: globalStarted,
          success: globalSuccess,
          error: globalError,
          successRate: globalSuccessRate,
          errorRate: globalErrorRate,
        },
        tokens: {
          input: globalTokensInput,
          output: globalTokensOutput,
          total: globalTokensTotal,
        },
        cost: {
          estimated: globalCost,
        },
        fallbacks: globalFallbacks,
        rateLimits: globalRateLimits,
        activeProviders: stats.size,
        activeModels: activeModelsCount,
      },
      snapshotAt: Date.now(),
    };
  }

  function reset(): void {
    stats.clear();
  }

  function resetProvider(provider: string, model?: string): void {
    if (model) {
      const providerMap = stats.get(provider);
      if (providerMap) {
        providerMap.delete(model);
        if (providerMap.size === 0) {
          stats.delete(provider);
        }
      }
    } else {
      stats.delete(provider);
    }
  }

  return { emit, getSnapshot, reset, resetProvider };
}

/**
 * Create a no-op metrics instance (for when metrics are disabled).
 */
export function createNoopProviderMetrics(): ProviderMetrics {
  const emptySnapshot: ProviderMetricsSnapshot = {
    providers: {},
    global: {
      requests: { started: 0, success: 0, error: 0, successRate: 0, errorRate: 0 },
      tokens: { input: 0, output: 0, total: 0 },
      cost: { estimated: 0 },
      fallbacks: 0,
      rateLimits: 0,
      activeProviders: 0,
      activeModels: 0,
    },
    snapshotAt: 0,
  };

  return {
    emit: () => {},
    getSnapshot: () => ({ ...emptySnapshot, snapshotAt: Date.now() }),
    reset: () => {},
    resetProvider: () => {},
  };
}

// ============================================================================
// Global Singleton Instance
// ============================================================================

let globalMetrics: ProviderMetrics | null = null;

/**
 * Get the global provider metrics instance.
 * Creates one if it doesn't exist.
 */
export function getProviderMetrics(): ProviderMetrics {
  if (!globalMetrics) {
    globalMetrics = createProviderMetrics();
  }
  return globalMetrics;
}

/**
 * Set a custom global metrics instance (e.g., for testing).
 */
export function setProviderMetrics(metrics: ProviderMetrics): void {
  globalMetrics = metrics;
}

/**
 * Reset the global metrics instance.
 */
export function resetGlobalProviderMetrics(): void {
  globalMetrics = null;
}
