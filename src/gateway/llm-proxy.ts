/**
 * Lightweight LLM proxy — forwards `/v1/proxy/chat/completions` directly to
 * the configured upstream provider without running an agent turn.
 *
 * This is ~50ms overhead vs ~2-3s for the full agentCommand path.
 * Designed for latency-sensitive clients like voice pipelines.
 *
 * Supports both streaming and non-streaming requests.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { ResolvedGatewayAuth } from "./auth.js";
import { loadConfig } from "../config/config.js";
import { authorizeGatewayConnect } from "./auth.js";
import {
  readJsonBodyOrError,
  sendJson,
  sendMethodNotAllowed,
  sendUnauthorized,
  setSseHeaders,
} from "./http-common.js";
import { getBearerToken } from "./http-utils.js";

type LlmProxyOptions = {
  auth: ResolvedGatewayAuth;
  maxBodyBytes?: number;
  trustedProxies?: string[];
};

/**
 * Resolve a model string like "cerebras/zai-glm-4.7" into provider config.
 * Returns { baseUrl, apiKey, modelId, api, headers } or null.
 */
function resolveProvider(model: string) {
  const cfg = loadConfig();
  const providers = cfg.models?.providers;
  if (!providers) {
    return null;
  }

  // Try "provider/model" format first
  const slashIdx = model.indexOf("/");
  if (slashIdx > 0) {
    const providerName = model.slice(0, slashIdx);
    const modelId = model.slice(slashIdx + 1);
    const provider = providers[providerName];
    if (provider) {
      return {
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        modelId,
        api: provider.api,
        headers: provider.headers,
        authHeader: provider.authHeader !== false,
      };
    }
  }

  // Fallback: search all providers for a matching model definition
  for (const [_name, provider] of Object.entries(providers)) {
    const modelDef = provider.models?.find((m) => m.id === model || m.name === model);
    if (modelDef) {
      return {
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        modelId: modelDef.id,
        api: provider.api,
        headers: provider.headers,
        authHeader: provider.authHeader !== false,
      };
    }
  }

  return null;
}

/**
 * Handle lightweight LLM proxy requests.
 * Routes: POST /v1/proxy/chat/completions
 *
 * Forwards the request body directly to the upstream provider's
 * /chat/completions endpoint with the resolved model and API key.
 * No agent turn, no session, no history — just a thin proxy.
 */
export async function handleLlmProxyRequest(
  req: IncomingMessage,
  res: ServerResponse,
  opts: LlmProxyOptions,
): Promise<boolean> {
  const url = new URL(req.url ?? "/", `http://${req.headers.host || "localhost"}`);
  if (url.pathname !== "/v1/proxy/chat/completions") {
    return false;
  }

  if (req.method !== "POST") {
    sendMethodNotAllowed(res);
    return true;
  }

  // Auth check
  const token = getBearerToken(req);
  const authResult = await authorizeGatewayConnect({
    auth: opts.auth,
    connectAuth: { token, password: token },
    req,
    trustedProxies: opts.trustedProxies,
  });
  if (!authResult.ok) {
    sendUnauthorized(res);
    return true;
  }

  // Parse request body
  const body = await readJsonBodyOrError(req, res, opts.maxBodyBytes ?? 1024 * 1024);
  if (body === undefined) {
    return true;
  }

  const payload = body as Record<string, unknown>;
  const model = typeof payload.model === "string" ? payload.model : "";
  const stream = Boolean(payload.stream);

  // Resolve provider
  const provider = resolveProvider(model);
  if (!provider) {
    sendJson(res, 400, {
      error: {
        message: `Unknown model or provider: "${model}". Configure it in models.providers.`,
        type: "invalid_request_error",
      },
    });
    return true;
  }

  // Build upstream URL
  const upstreamUrl = `${provider.baseUrl.replace(/\/$/, "")}/chat/completions`;

  // Build headers
  const upstreamHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...provider.headers,
  };
  if (provider.authHeader && provider.apiKey) {
    upstreamHeaders["Authorization"] = `Bearer ${provider.apiKey}`;
  }

  // Rewrite model to upstream model ID
  const upstreamBody = JSON.stringify({
    ...payload,
    model: provider.modelId,
  });

  try {
    // Forward to upstream provider
    const upstreamRes = await fetch(upstreamUrl, {
      method: "POST",
      headers: upstreamHeaders,
      body: upstreamBody,
      signal: AbortSignal.timeout(60_000),
    });

    if (!upstreamRes.ok) {
      const errorText = await upstreamRes.text();
      sendJson(res, upstreamRes.status, {
        error: {
          message: `Upstream error (${upstreamRes.status}): ${errorText.slice(0, 500)}`,
          type: "upstream_error",
        },
      });
      return true;
    }

    if (stream && upstreamRes.body) {
      // Stream SSE through
      setSseHeaders(res);
      const reader = upstreamRes.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          res.write(value);
        }
      } catch {
        // Client disconnected
      } finally {
        res.end();
      }
    } else {
      // Non-streaming: forward response as-is
      const responseBody = await upstreamRes.text();
      res.writeHead(upstreamRes.status, {
        "Content-Type": "application/json",
      });
      res.end(responseBody);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    sendJson(res, 502, {
      error: {
        message: `Proxy error: ${message}`,
        type: "proxy_error",
      },
    });
  }

  return true;
}
