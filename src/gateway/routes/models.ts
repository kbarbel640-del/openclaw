/**
 * Model System HTTP routes — Elysia plugin.
 *
 * 9 REST endpoints for model catalog management under /api/models.
 */

import { Elysia } from "elysia";
import { getProviderMetrics } from "../../agents/provider-metrics.js";

// ============================================================================
// Helpers
// ============================================================================

function convertToPrometheus(
  snapshot: ReturnType<ReturnType<typeof getProviderMetrics>["getSnapshot"]>,
): string {
  const lines: string[] = [];
  const timestamp = Date.now();

  lines.push("# HELP openclaw_ai_requests_total Total number of AI requests");
  lines.push("# TYPE openclaw_ai_requests_total counter");
  lines.push(
    `openclaw_ai_requests_total{status="started"} ${snapshot.global.requests.started} ${timestamp}`,
  );
  lines.push(
    `openclaw_ai_requests_total{status="success"} ${snapshot.global.requests.success} ${timestamp}`,
  );
  lines.push(
    `openclaw_ai_requests_total{status="error"} ${snapshot.global.requests.error} ${timestamp}`,
  );

  lines.push("");
  lines.push("# HELP openclaw_ai_tokens_total Total number of tokens processed");
  lines.push("# TYPE openclaw_ai_tokens_total counter");
  lines.push(`openclaw_ai_tokens_total{type="input"} ${snapshot.global.tokens.input} ${timestamp}`);
  lines.push(
    `openclaw_ai_tokens_total{type="output"} ${snapshot.global.tokens.output} ${timestamp}`,
  );
  lines.push(`openclaw_ai_tokens_total{type="total"} ${snapshot.global.tokens.total} ${timestamp}`);

  lines.push("");
  lines.push("# HELP openclaw_ai_cost_estimated_total Estimated total cost in USD");
  lines.push("# TYPE openclaw_ai_cost_estimated_total counter");
  lines.push(`openclaw_ai_cost_estimated_total ${snapshot.global.cost.estimated} ${timestamp}`);

  for (const [provider, providerData] of Object.entries(snapshot.providers)) {
    for (const [model, modelData] of Object.entries(providerData.models)) {
      const labels = `provider="${provider}",model="${model}"`;

      lines.push("");
      lines.push(
        `openclaw_ai_model_requests_total{${labels},status="started"} ${modelData.requests.started} ${timestamp}`,
      );
      lines.push(
        `openclaw_ai_model_requests_total{${labels},status="success"} ${modelData.requests.success} ${timestamp}`,
      );
      lines.push(
        `openclaw_ai_model_requests_total{${labels},status="error"} ${modelData.requests.error} ${timestamp}`,
      );

      lines.push(`openclaw_ai_model_latency_p50{${labels}} ${modelData.latency.p50} ${timestamp}`);
      lines.push(`openclaw_ai_model_latency_p95{${labels}} ${modelData.latency.p95} ${timestamp}`);
      lines.push(`openclaw_ai_model_latency_p99{${labels}} ${modelData.latency.p99} ${timestamp}`);

      lines.push(
        `openclaw_ai_model_tokens_total{${labels},type="input"} ${modelData.tokens.input} ${timestamp}`,
      );
      lines.push(
        `openclaw_ai_model_tokens_total{${labels},type="output"} ${modelData.tokens.output} ${timestamp}`,
      );

      lines.push(
        `openclaw_ai_model_cost_estimated{${labels}} ${modelData.cost.estimated} ${timestamp}`,
      );

      lines.push(
        `openclaw_ai_model_fallbacks_total{${labels}} ${modelData.fallbacks.triggered} ${timestamp}`,
      );
      lines.push(
        `openclaw_ai_model_rate_limits_total{${labels}} ${modelData.rateLimits} ${timestamp}`,
      );
    }
  }

  return lines.join("\n") + "\n";
}

// ============================================================================
// Route Handlers
// ============================================================================

function handleGetMetrics(query: Record<string, string | undefined>) {
  const metrics = getProviderMetrics();
  const snapshot = metrics.getSnapshot();

  const { provider, model, format = "json" } = query;

  let filteredSnapshot = snapshot;
  if (provider?.trim()) {
    const providerKey = provider.trim().toLowerCase();
    const providerData = snapshot.providers[providerKey];

    if (!providerData) {
      return { status: 404, body: { error: "Provider not found", provider: providerKey } };
    }

    if (model?.trim()) {
      const modelKey = model.trim().toLowerCase();
      const modelData = providerData.models[modelKey];

      if (!modelData) {
        return {
          status: 404,
          body: { error: "Model not found", provider: providerKey, model: modelKey },
        };
      }

      filteredSnapshot = {
        providers: {
          [providerKey]: { models: { [modelKey]: modelData }, totals: providerData.totals },
        },
        global: snapshot.global,
        snapshotAt: snapshot.snapshotAt,
      };
    } else {
      filteredSnapshot = {
        providers: { [providerKey]: providerData },
        global: snapshot.global,
        snapshotAt: snapshot.snapshotAt,
      };
    }
  }

  if (format === "prometheus") {
    const prometheus = convertToPrometheus(filteredSnapshot);
    return {
      status: 200,
      body: prometheus,
      contentType: "text/plain; version=0.0.4; charset=utf-8",
    };
  }

  return { status: 200, body: filteredSnapshot };
}

function handleGetMetricsSummary() {
  const metrics = getProviderMetrics();
  const snapshot = metrics.getSnapshot();

  const topProviders = Object.entries(snapshot.providers)
    .map(([provider, data]) => ({
      provider,
      requests: data.totals.requests.started,
      successRate: data.totals.requests.successRate,
      tokens: data.totals.tokens.total,
      cost: data.totals.cost.estimated,
    }))
    .toSorted((a, b) => b.requests - a.requests)
    .slice(0, 10);

  const topModels: Array<{
    provider: string;
    model: string;
    requests: number;
    successRate: number;
    latencyP95: number;
    tokens: number;
    cost: number;
  }> = [];

  for (const [provider, providerData] of Object.entries(snapshot.providers)) {
    for (const [model, modelData] of Object.entries(providerData.models)) {
      topModels.push({
        provider,
        model,
        requests: modelData.requests.started,
        successRate: modelData.requests.successRate,
        latencyP95: modelData.latency.p95,
        tokens: modelData.tokens.total,
        cost: modelData.cost.estimated,
      });
    }
  }

  topModels.sort((a, b) => b.requests - a.requests);
  const topModelsSlice = topModels.slice(0, 10);

  const errors = topModels
    .filter((m) => Object.keys(m).length > 0)
    .map((m) => {
      const modelData = snapshot.providers[m.provider]?.models[m.model];
      if (!modelData) {
        return null;
      }
      const errorCount = modelData.requests.error;
      if (errorCount === 0) {
        return null;
      }
      return {
        provider: m.provider,
        model: m.model,
        errors: errorCount,
        errorRate: modelData.requests.errorRate,
        errorTypes: modelData.errors,
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .toSorted((a, b) => b.errors - a.errors)
    .slice(0, 10);

  return {
    global: snapshot.global,
    topProviders,
    topModels: topModelsSlice,
    errors,
    snapshotAt: snapshot.snapshotAt,
  };
}

function handleDeleteMetrics(query: Record<string, string | undefined>) {
  const metrics = getProviderMetrics();
  const { provider, model } = query;

  if (provider?.trim()) {
    const providerKey = provider.trim().toLowerCase();
    if (model?.trim()) {
      const modelKey = model.trim().toLowerCase();
      metrics.resetProvider(providerKey, modelKey);
      return { ok: true, message: `Metrics reset for ${providerKey}/${modelKey}` };
    }
    metrics.resetProvider(providerKey);
    return { ok: true, message: `Metrics reset for provider ${providerKey}` };
  }

  metrics.reset();
  return { ok: true, message: "All metrics reset" };
}

// ============================================================================
// Elysia Plugin
// ============================================================================

export function modelsRoutes() {
  return new Elysia({ name: "models-routes", prefix: "/api/models" })
    .get("/metrics/summary", ({ set }) => {
      try {
        return handleGetMetricsSummary();
      } catch (error) {
        set.status = 500;
        return {
          error: "Failed to fetch metrics summary",
          message: error instanceof Error ? error.message : String(error),
        };
      }
    })
    .get("/metrics", ({ query, set }) => {
      try {
        const result = handleGetMetrics(query as Record<string, string | undefined>);
        set.status = result.status;
        if (typeof result.body === "string") {
          set.headers["content-type"] =
            (result as { contentType?: string }).contentType ?? "text/plain; charset=utf-8";
          return result.body;
        }
        return result.body;
      } catch (error) {
        set.status = 500;
        return {
          error: "Failed to fetch metrics",
          message: error instanceof Error ? error.message : String(error),
        };
      }
    })
    .delete("/metrics", ({ query, set }) => {
      try {
        return handleDeleteMetrics(query as Record<string, string | undefined>);
      } catch (error) {
        set.status = 500;
        return {
          error: "Failed to reset metrics",
          message: error instanceof Error ? error.message : String(error),
        };
      }
    })
    .get("/health", () => {
      return { status: "healthy", message: "Model health check pending" };
    })
    .post("/test", () => {
      return { ok: true, message: "Model availability test pending" };
    })
    .get("/:id/quarantine", () => {
      // Not a real endpoint, but matches the pattern
      return { status: 404, error: "Not found" };
    })
    .put("/:id/quarantine", () => {
      return { ok: true, message: "Model quarantine pending" };
    })
    .delete("/:id/quarantine", () => {
      return { ok: true, message: "Model quarantine removal pending" };
    })
    .get("/:id", ({ params }) => {
      const _modelId = params.id;
      return { model: null, message: "Model catalog integration pending" };
    })
    .get("/", () => {
      return { models: [], message: "Model catalog integration pending" };
    });
}
