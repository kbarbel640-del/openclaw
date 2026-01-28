/**
 * Prometheus metrics endpoint for observability.
 *
 * - GET /metrics - Prometheus exposition format metrics
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { GatewayMetricsConfig } from "../config/types.gateway.js";
import { authorizeGatewayConnect, type ResolvedGatewayAuth } from "./auth.js";
import { getBearerToken } from "./http-utils.js";
import {
  getMetricsText,
  getMetricsContentType,
  startMetricsCollection,
} from "../observability/metrics-registry.js";

export type MetricsEndpointsHandler = (
  req: IncomingMessage,
  res: ServerResponse,
) => Promise<boolean>;

function sendText(res: ServerResponse, status: number, body: string, contentType: string) {
  res.statusCode = status;
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "no-store");
  res.end(body);
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

export function createMetricsEndpointsHandler(opts: {
  config?: GatewayMetricsConfig;
  resolvedAuth: ResolvedGatewayAuth;
  trustedProxies?: string[];
}): MetricsEndpointsHandler {
  const { config, resolvedAuth, trustedProxies } = opts;
  const metricsPath = config?.path ?? "/metrics";
  const authRequired = config?.authRequired !== false;

  // Start metrics collection only when explicitly enabled
  // Previously: `config?.enabled !== false` would start collection on undefined,
  // but the endpoint returns 404 unless `config?.enabled === true`.
  // Now both collection and endpoint require explicit enablement.
  if (config?.enabled === true) {
    startMetricsCollection();
  }

  return async (req, res) => {
    // Metrics disabled by default (must be explicitly enabled)
    if (config?.enabled !== true) return false;

    const url = new URL(req.url ?? "/", "http://localhost");
    const path = url.pathname;

    // GET /metrics - Prometheus exposition format
    if (path === metricsPath && req.method === "GET") {
      if (authRequired) {
        const token = getBearerToken(req);
        const authResult = await authorizeGatewayConnect({
          auth: resolvedAuth,
          connectAuth: token ? { token, password: token } : null,
          req,
          trustedProxies,
        });
        if (!authResult.ok) {
          sendJson(res, 401, {
            error: "Unauthorized",
            reason: authResult.reason ?? "Authentication required",
          });
          return true;
        }
      }

      try {
        const metricsText = await getMetricsText();
        sendText(res, 200, metricsText, getMetricsContentType());
      } catch (err) {
        sendJson(res, 500, {
          error: "Internal Server Error",
          message: err instanceof Error ? err.message : "Failed to collect metrics",
        });
      }
      return true;
    }

    return false;
  };
}
