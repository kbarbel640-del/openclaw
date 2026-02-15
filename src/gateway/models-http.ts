/**
 * Model System HTTP routes - Node HTTP handlers (no Express)
 *
 * Provides 9 REST endpoints for model catalog management:
 * 1. GET /api/models - List available models
 * 2. GET /api/models/:id - Get model details
 * 3. GET /api/models/metrics - Get provider metrics
 * 4. GET /api/models/metrics/summary - Quick metrics summary
 * 5. DELETE /api/models/metrics - Reset metrics
 * 6. POST /api/models/test - Test model availability
 * 7. GET /api/models/health - Health check for all models
 * 8. PUT /api/models/:id/quarantine - Quarantine a model
 * 9. DELETE /api/models/:id/quarantine - Remove from quarantine
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { getProviderMetrics } from "../agents/provider-metrics.js";

// ============================================================================
// Utilities
// ============================================================================

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function sendText(
  res: ServerResponse,
  status: number,
  text: string,
  contentType = "text/plain",
): void {
  res.statusCode = status;
  res.setHeader("Content-Type", `${contentType}; charset=utf-8`);
  res.end(text);
}

function parseQueryParams(url: URL): Record<string, string> {
  const params: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return params;
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

// ============================================================================
// Metrics Helpers
// ============================================================================

function convertToPrometheus(
  snapshot: ReturnType<ReturnType<typeof getProviderMetrics>["getSnapshot"]>,
): string {
  const lines: string[] = [];
  const timestamp = Date.now();

  // Global metrics
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

  // Per-provider, per-model metrics
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

/**
 * GET /api/models/metrics
 * Get current provider metrics snapshot.
 *
 * Query params:
 * - provider: Filter by provider (optional)
 * - model: Filter by model (optional, requires provider)
 * - format: "json" (default) or "prometheus"
 */
function handleGetMetrics(req: IncomingMessage, res: ServerResponse, url: URL): void {
  try {
    const metrics = getProviderMetrics();
    const snapshot = metrics.getSnapshot();

    const params = parseQueryParams(url);
    const { provider, model, format = "json" } = params;

    // Filter by provider/model if requested
    let filteredSnapshot = snapshot;
    if (provider?.trim()) {
      const providerKey = provider.trim().toLowerCase();
      const providerData = snapshot.providers[providerKey];

      if (!providerData) {
        return sendJson(res, 404, {
          error: "Provider not found",
          provider: providerKey,
        });
      }

      if (model?.trim()) {
        const modelKey = model.trim().toLowerCase();
        const modelData = providerData.models[modelKey];

        if (!modelData) {
          return sendJson(res, 404, {
            error: "Model not found",
            provider: providerKey,
            model: modelKey,
          });
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
      return sendText(res, 200, prometheus, "text/plain; version=0.0.4");
    }

    // Default: JSON
    sendJson(res, 200, filteredSnapshot);
  } catch (error) {
    console.error("[models-http] Error fetching metrics:", error);
    sendJson(res, 500, {
      error: "Failed to fetch metrics",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * GET /api/models/metrics/summary
 * Quick summary of top providers/models.
 */
function handleGetMetricsSummary(_req: IncomingMessage, res: ServerResponse): void {
  try {
    const metrics = getProviderMetrics();
    const snapshot = metrics.getSnapshot();

    // Build summary
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

    sendJson(res, 200, {
      global: snapshot.global,
      topProviders,
      topModels: topModelsSlice,
      errors,
      snapshotAt: snapshot.snapshotAt,
    });
  } catch (error) {
    console.error("[models-http] Error fetching metrics summary:", error);
    sendJson(res, 500, {
      error: "Failed to fetch metrics summary",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * DELETE /api/models/metrics
 * Reset metrics (admin only).
 *
 * Query params:
 * - provider: Reset specific provider (optional)
 * - model: Reset specific model (optional, requires provider)
 */
function handleDeleteMetrics(_req: IncomingMessage, res: ServerResponse, url: URL): void {
  try {
    const metrics = getProviderMetrics();
    const params = parseQueryParams(url);
    const { provider, model } = params;

    if (provider?.trim()) {
      const providerKey = provider.trim().toLowerCase();

      if (model?.trim()) {
        const modelKey = model.trim().toLowerCase();
        metrics.resetProvider(providerKey, modelKey);
        return sendJson(res, 200, {
          ok: true,
          message: `Metrics reset for ${providerKey}/${modelKey}`,
        });
      }

      metrics.resetProvider(providerKey);
      return sendJson(res, 200, {
        ok: true,
        message: `Metrics reset for provider ${providerKey}`,
      });
    }

    // Reset all
    metrics.reset();
    sendJson(res, 200, {
      ok: true,
      message: "All metrics reset",
    });
  } catch (error) {
    console.error("[models-http] Error resetting metrics:", error);
    sendJson(res, 500, {
      error: "Failed to reset metrics",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * GET /api/models
 * List available models (stub for now).
 */
function handleListModels(_req: IncomingMessage, res: ServerResponse): void {
  // TODO: Integrate with model-catalog.ts
  sendJson(res, 200, {
    models: [],
    message: "Model catalog integration pending",
  });
}

/**
 * GET /api/models/:id
 * Get model details (stub for now).
 */
function handleGetModel(_req: IncomingMessage, res: ServerResponse, _modelId: string): void {
  // TODO: Integrate with model-catalog.ts
  sendJson(res, 200, {
    model: null,
    message: "Model catalog integration pending",
  });
}

/**
 * POST /api/models/test
 * Test model availability (stub for now).
 */
async function handleTestModel(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    await readJsonBody(req);
    // TODO: Integrate with model-availability.ts
    sendJson(res, 200, {
      ok: true,
      message: "Model availability test pending",
    });
  } catch (error) {
    sendJson(res, 400, {
      error: "Invalid request body",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * GET /api/models/health
 * Health check for all models (stub for now).
 */
function handleModelsHealth(_req: IncomingMessage, res: ServerResponse): void {
  // TODO: Integrate with model-availability.ts
  sendJson(res, 200, {
    status: "healthy",
    message: "Model health check pending",
  });
}

/**
 * PUT /api/models/:id/quarantine
 * Quarantine a model (stub for now).
 */
async function handleQuarantineModel(
  req: IncomingMessage,
  res: ServerResponse,
  _modelId: string,
): Promise<void> {
  try {
    await readJsonBody(req);
    // TODO: Integrate with model-availability.ts
    sendJson(res, 200, {
      ok: true,
      message: "Model quarantine pending",
    });
  } catch (error) {
    sendJson(res, 400, {
      error: "Invalid request body",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * DELETE /api/models/:id/quarantine
 * Remove model from quarantine (stub for now).
 */
function handleRemoveQuarantine(
  _req: IncomingMessage,
  res: ServerResponse,
  _modelId: string,
): void {
  // TODO: Integrate with model-availability.ts
  sendJson(res, 200, {
    ok: true,
    message: "Model quarantine removal pending",
  });
}

// ============================================================================
// Main HTTP Handler
// ============================================================================

/**
 * Main HTTP request handler for /api/models/* routes.
 * Returns true if request was handled, false otherwise.
 */
export async function handleModelsHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://localhost");

  // Only handle /api/models/* routes
  if (!url.pathname.startsWith("/api/models")) {
    return false;
  }

  const method = req.method?.toUpperCase();
  const path = url.pathname;

  try {
    // GET /api/models/metrics/summary
    if (method === "GET" && path === "/api/models/metrics/summary") {
      handleGetMetricsSummary(req, res);
      return true;
    }

    // GET /api/models/metrics
    if (method === "GET" && path === "/api/models/metrics") {
      handleGetMetrics(req, res, url);
      return true;
    }

    // DELETE /api/models/metrics
    if (method === "DELETE" && path === "/api/models/metrics") {
      handleDeleteMetrics(req, res, url);
      return true;
    }

    // GET /api/models/health
    if (method === "GET" && path === "/api/models/health") {
      handleModelsHealth(req, res);
      return true;
    }

    // POST /api/models/test
    if (method === "POST" && path === "/api/models/test") {
      await handleTestModel(req, res);
      return true;
    }

    // GET /api/models/:id
    const getModelMatch = path.match(/^\/api\/models\/([^/]+)$/);
    if (method === "GET" && getModelMatch) {
      const modelId = getModelMatch[1];
      if (modelId && modelId !== "metrics" && modelId !== "health" && modelId !== "test") {
        handleGetModel(req, res, modelId);
        return true;
      }
    }

    // PUT /api/models/:id/quarantine
    const putQuarantineMatch = path.match(/^\/api\/models\/([^/]+)\/quarantine$/);
    if (method === "PUT" && putQuarantineMatch) {
      await handleQuarantineModel(req, res, putQuarantineMatch[1] ?? "");
      return true;
    }

    // DELETE /api/models/:id/quarantine
    const deleteQuarantineMatch = path.match(/^\/api\/models\/([^/]+)\/quarantine$/);
    if (method === "DELETE" && deleteQuarantineMatch) {
      handleRemoveQuarantine(req, res, deleteQuarantineMatch[1] ?? "");
      return true;
    }

    // GET /api/models (list)
    if (method === "GET" && path === "/api/models") {
      handleListModels(req, res);
      return true;
    }

    // Route not found under /api/models
    sendJson(res, 404, {
      error: "Not found",
      path,
    });
    return true;
  } catch (error) {
    console.error("[models-http] Unhandled error:", error);
    sendJson(res, 500, {
      error: "Internal server error",
      message: error instanceof Error ? error.message : String(error),
    });
    return true;
  }
}
