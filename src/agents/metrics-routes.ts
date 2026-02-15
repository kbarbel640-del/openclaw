/**
 * API routes for provider metrics.
 * Exposes metrics snapshots via GET /metrics
 */

import { Elysia } from "elysia";
import { getProviderMetrics, type ProviderMetricsSnapshot } from "./provider-metrics.js";

export const metricsRoutes = new Elysia({ prefix: "/metrics" })
  /**
   * GET /metrics
   * Get current provider metrics snapshot.
   *
   * Query params:
   * - provider: Filter by provider (optional)
   * - model: Filter by model (optional, requires provider)
   * - format: "json" (default) or "prometheus"
   */
  .get("/", ({ query, set }) => {
    try {
      const metrics = getProviderMetrics();
      const snapshot = metrics.getSnapshot();

      const { provider, model, format = "json" } = query;

      // Filter by provider/model if requested
      let filteredSnapshot = snapshot;
      if (typeof provider === "string" && provider.trim()) {
        const providerKey = provider.trim().toLowerCase();
        const providerData = snapshot.providers[providerKey];

        if (!providerData) {
          set.status = 404;
          return {
            error: "Provider not found",
            provider: providerKey,
          };
        }

        if (typeof model === "string" && model.trim()) {
          const modelKey = model.trim().toLowerCase();
          const modelData = providerData.models[modelKey];

          if (!modelData) {
            set.status = 404;
            return {
              error: "Model not found",
              provider: providerKey,
              model: modelKey,
            };
          }

          // Single model response
          filteredSnapshot = {
            providers: {
              [providerKey]: {
                models: {
                  [modelKey]: modelData,
                },
                totals: providerData.totals,
              },
            },
            global: snapshot.global,
            snapshotAt: snapshot.snapshotAt,
          };
        } else {
          // Single provider response
          filteredSnapshot = {
            providers: {
              [providerKey]: providerData,
            },
            global: snapshot.global,
            snapshotAt: snapshot.snapshotAt,
          };
        }
      }

      // Return in requested format
      if (format === "prometheus") {
        const prometheus = convertToPrometheus(filteredSnapshot);
        set.headers["content-type"] = "text/plain; version=0.0.4";
        return prometheus;
      }

      // Default: JSON
      return filteredSnapshot;
    } catch (error) {
      console.error("[metrics-routes] Error fetching metrics:", error);
      set.status = 500;
      return {
        error: "Failed to fetch metrics",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  })
  /**
   * DELETE /metrics
   * Reset metrics (admin only).
   *
   * Query params:
   * - provider: Reset specific provider (optional)
   * - model: Reset specific model (optional, requires provider)
   */
  .delete("/", ({ query }) => {
    try {
      const metrics = getProviderMetrics();
      const { provider, model } = query;

      if (typeof provider === "string" && provider.trim()) {
        const providerKey = provider.trim().toLowerCase();
        const modelKey = typeof model === "string" ? model.trim().toLowerCase() : undefined;

        if (modelKey) {
          metrics.resetProvider(providerKey, modelKey);
          return {
            message: "Model metrics reset",
            provider: providerKey,
            model: modelKey,
          };
        } else {
          metrics.resetProvider(providerKey);
          return {
            message: "Provider metrics reset",
            provider: providerKey,
          };
        }
      }

      // Reset all
      metrics.reset();
      return { message: "All metrics reset" };
    } catch (error) {
      console.error("[metrics-routes] Error resetting metrics:", error);
      return {
        error: "Failed to reset metrics",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  })
  /**
   * GET /metrics/summary
   * Get a quick summary of key metrics.
   */
  .get("/summary", ({ set }) => {
    try {
      const metrics = getProviderMetrics();
      const snapshot = metrics.getSnapshot();

      // Build summary
      const summary = {
        global: snapshot.global,
        topProviders: Object.entries(snapshot.providers)
          .map(([provider, data]) => ({
            provider,
            requests: data.totals.requests.started,
            successRate: data.totals.requests.successRate,
            tokens: data.totals.tokens.total,
            cost: data.totals.cost.estimated,
          }))
          .toSorted((a, b) => b.requests - a.requests)
          .slice(0, 5),
        topModels: Object.entries(snapshot.providers)
          .flatMap(([provider, data]) =>
            Object.entries(data.models).map(([model, modelData]) => ({
              provider,
              model,
              requests: modelData.requests.started,
              successRate: modelData.requests.successRate,
              latencyP95: modelData.latency.p95,
              tokens: modelData.tokens.total,
              cost: modelData.cost.estimated,
            })),
          )
          .toSorted((a, b) => b.requests - a.requests)
          .slice(0, 10),
        errors: Object.entries(snapshot.providers).flatMap(([provider, data]) =>
          Object.entries(data.models)
            .filter(([, modelData]) => modelData.requests.error > 0)
            .map(([model, modelData]) => ({
              provider,
              model,
              errors: modelData.requests.error,
              errorRate: modelData.requests.errorRate,
              errorTypes: modelData.errors,
            })),
        ),
        snapshotAt: snapshot.snapshotAt,
      };

      return summary;
    } catch (error) {
      console.error("[metrics-routes] Error fetching summary:", error);
      set.status = 500;
      return {
        error: "Failed to fetch summary",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  });

// ============================================================================
// Prometheus Format Converter
// ============================================================================

function convertToPrometheus(snapshot: ProviderMetricsSnapshot): string {
  const lines: string[] = [];

  // Helper to escape label values
  const escapeLabel = (value: string): string => value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

  // Global metrics
  lines.push("# HELP openclaw_ai_requests_total Total AI requests");
  lines.push("# TYPE openclaw_ai_requests_total counter");
  lines.push(`openclaw_ai_requests_total{status="started"} ${snapshot.global.requests.started}`);
  lines.push(`openclaw_ai_requests_total{status="success"} ${snapshot.global.requests.success}`);
  lines.push(`openclaw_ai_requests_total{status="error"} ${snapshot.global.requests.error}`);
  lines.push("");

  lines.push("# HELP openclaw_ai_success_rate AI request success rate (0-1)");
  lines.push("# TYPE openclaw_ai_success_rate gauge");
  lines.push(`openclaw_ai_success_rate ${snapshot.global.requests.successRate}`);
  lines.push("");

  lines.push("# HELP openclaw_ai_tokens_total Total AI tokens consumed");
  lines.push("# TYPE openclaw_ai_tokens_total counter");
  lines.push(`openclaw_ai_tokens_total{type="input"} ${snapshot.global.tokens.input}`);
  lines.push(`openclaw_ai_tokens_total{type="output"} ${snapshot.global.tokens.output}`);
  lines.push(`openclaw_ai_tokens_total{type="total"} ${snapshot.global.tokens.total}`);
  lines.push("");

  lines.push("# HELP openclaw_ai_cost_usd_total Estimated AI cost in USD");
  lines.push("# TYPE openclaw_ai_cost_usd_total counter");
  lines.push(`openclaw_ai_cost_usd_total ${snapshot.global.cost.estimated}`);
  lines.push("");

  lines.push("# HELP openclaw_ai_fallbacks_total Total fallback triggers");
  lines.push("# TYPE openclaw_ai_fallbacks_total counter");
  lines.push(`openclaw_ai_fallbacks_total ${snapshot.global.fallbacks}`);
  lines.push("");

  lines.push("# HELP openclaw_ai_rate_limits_total Total rate limit hits");
  lines.push("# TYPE openclaw_ai_rate_limits_total counter");
  lines.push(`openclaw_ai_rate_limits_total ${snapshot.global.rateLimits}`);
  lines.push("");

  // Per-provider, per-model metrics
  lines.push("# HELP openclaw_ai_model_requests_total Requests per model");
  lines.push("# TYPE openclaw_ai_model_requests_total counter");
  for (const [provider, providerData] of Object.entries(snapshot.providers)) {
    for (const [model, modelData] of Object.entries(providerData.models)) {
      const labels = `provider="${escapeLabel(provider)}",model="${escapeLabel(model)}"`;
      lines.push(
        `openclaw_ai_model_requests_total{${labels},status="started"} ${modelData.requests.started}`,
      );
      lines.push(
        `openclaw_ai_model_requests_total{${labels},status="success"} ${modelData.requests.success}`,
      );
      lines.push(
        `openclaw_ai_model_requests_total{${labels},status="error"} ${modelData.requests.error}`,
      );
    }
  }
  lines.push("");

  lines.push("# HELP openclaw_ai_model_latency_seconds Request latency percentiles (seconds)");
  lines.push("# TYPE openclaw_ai_model_latency_seconds gauge");
  for (const [provider, providerData] of Object.entries(snapshot.providers)) {
    for (const [model, modelData] of Object.entries(providerData.models)) {
      const labels = `provider="${escapeLabel(provider)}",model="${escapeLabel(model)}"`;
      lines.push(
        `openclaw_ai_model_latency_seconds{${labels},percentile="p50"} ${modelData.latency.p50 / 1000}`,
      );
      lines.push(
        `openclaw_ai_model_latency_seconds{${labels},percentile="p95"} ${modelData.latency.p95 / 1000}`,
      );
      lines.push(
        `openclaw_ai_model_latency_seconds{${labels},percentile="p99"} ${modelData.latency.p99 / 1000}`,
      );
    }
  }
  lines.push("");

  lines.push("# HELP openclaw_ai_model_tokens_total Tokens per model");
  lines.push("# TYPE openclaw_ai_model_tokens_total counter");
  for (const [provider, providerData] of Object.entries(snapshot.providers)) {
    for (const [model, modelData] of Object.entries(providerData.models)) {
      const labels = `provider="${escapeLabel(provider)}",model="${escapeLabel(model)}"`;
      lines.push(
        `openclaw_ai_model_tokens_total{${labels},type="input"} ${modelData.tokens.input}`,
      );
      lines.push(
        `openclaw_ai_model_tokens_total{${labels},type="output"} ${modelData.tokens.output}`,
      );
      lines.push(
        `openclaw_ai_model_tokens_total{${labels},type="total"} ${modelData.tokens.total}`,
      );
    }
  }
  lines.push("");

  lines.push("# HELP openclaw_ai_model_cost_usd_total Estimated cost per model (USD)");
  lines.push("# TYPE openclaw_ai_model_cost_usd_total counter");
  for (const [provider, providerData] of Object.entries(snapshot.providers)) {
    for (const [model, modelData] of Object.entries(providerData.models)) {
      const labels = `provider="${escapeLabel(provider)}",model="${escapeLabel(model)}"`;
      lines.push(`openclaw_ai_model_cost_usd_total{${labels}} ${modelData.cost.estimated}`);
    }
  }
  lines.push("");

  return lines.join("\n");
}
