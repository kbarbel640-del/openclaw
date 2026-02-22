/**
 * REST endpoints for session management.
 *
 * Mirrors the WebSocket `sessions.*` methods so that HTTP-only clients
 * (e.g. Open WebUI pipes using `/v1/chat/completions`) can manage sessions
 * without a persistent WebSocket connection.
 *
 * @see https://github.com/openclaw/openclaw/issues/20934
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AuthRateLimiter } from "./auth-rate-limit.js";
import type { ResolvedGatewayAuth } from "./auth.js";
import { sendInvalidRequest, sendJson, sendMethodNotAllowed } from "./http-common.js";
import { authorizeGatewayBearerRequestOrReply } from "./http-auth-helpers.js";
import { handleGatewayPostJsonEndpoint } from "./http-endpoint-helpers.js";
import { getHeader, resolveAgentIdFromHeader } from "./http-utils.js";
import type { ErrorShape } from "./protocol/index.js";
import { sessionsHandlers } from "./server-methods/sessions.js";

type SessionsHttpOptions = {
  auth: ResolvedGatewayAuth;
  maxBodyBytes?: number;
  trustedProxies?: string[];
  rateLimiter?: AuthRateLimiter;
};

const MAX_BODY_BYTES = 64 * 1024; // 64 KiB – session payloads are small

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolves the session key from the JSON body or the
 * `X-OpenClaw-Session-Key` header (header takes precedence).
 */
function resolveKeyFromBodyOrHeader(
  req: IncomingMessage,
  body: Record<string, unknown> | undefined,
): string | undefined {
  const fromHeader = getHeader(req, "x-openclaw-session-key")?.trim();
  if (fromHeader) {
    return fromHeader;
  }
  if (body && typeof body.key === "string" && body.key.trim()) {
    return body.key.trim();
  }
  return undefined;
}

/**
 * Invokes a WebSocket-style session handler and converts the callback-based
 * response into a `{ ok, payload, error }` tuple we can serialise as JSON.
 */
async function invokeSessionHandler(
  method: string,
  params: Record<string, unknown>,
): Promise<{ ok: boolean; payload?: unknown; error?: ErrorShape }> {
  const handler = sessionsHandlers[method];
  if (!handler) {
    return { ok: false, error: { code: -1, message: `Unknown method: ${method}` } };
  }

  return new Promise<{ ok: boolean; payload?: unknown; error?: ErrorShape }>((resolve) => {
    let settled = false;

    const respond = (ok: boolean, payload?: unknown, error?: ErrorShape) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve({ ok, payload, error });
    };

    // The session handlers don't require a real GatewayRequestContext or
    // GatewayClient — they interact only with the on-disk session store and
    // the config singleton. We pass `null`/stubs for the context-dependent
    // fields that session handlers never read.
    const result = handler({
      req: { type: "req", id: `http:${method}:${Date.now()}`, method },
      params,
      context: null as never, // session handlers don't use context
      client: null,
      isWebchatConnect: () => false,
      respond,
    });

    // If the handler is async, wait for it.
    if (result && typeof (result as Promise<void>).then === "function") {
      void (result as Promise<void>).catch((err: unknown) => {
        if (!settled) {
          settled = true;
          resolve({
            ok: false,
            error: {
              code: -1,
              message: err instanceof Error ? err.message : "internal error",
            },
          });
        }
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Public handler
// ---------------------------------------------------------------------------

/**
 * Handles REST requests under the `/v1/sessions/*` path prefix.
 *
 * Returns `true` if the request was handled (even if an error was sent),
 * `false` if the path did not match any session route.
 */
export async function handleSessionsHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  opts: SessionsHttpOptions,
): Promise<boolean> {
  const url = new URL(req.url ?? "/", `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;

  // Fast exit – only handle /v1/sessions paths
  if (!pathname.startsWith("/v1/sessions")) {
    return false;
  }

  // ── POST /v1/sessions/reset ──────────────────────────────────────────
  if (pathname === "/v1/sessions/reset") {
    const handled = await handleGatewayPostJsonEndpoint(req, res, {
      pathname: "/v1/sessions/reset",
      auth: opts.auth,
      maxBodyBytes: opts.maxBodyBytes ?? MAX_BODY_BYTES,
      trustedProxies: opts.trustedProxies,
      rateLimiter: opts.rateLimiter,
    });
    if (handled === false) {
      return false; // path didn't match (shouldn't happen)
    }
    if (handled === undefined) {
      return true; // auth failed or body parse error – response already sent
    }

    const body = handled.body as Record<string, unknown> | undefined;
    const key = resolveKeyFromBodyOrHeader(req, body);
    if (!key) {
      sendInvalidRequest(res, "key is required (body.key or X-OpenClaw-Session-Key header)");
      return true;
    }

    const reason =
      body && typeof body.reason === "string" ? body.reason : "reset";

    const result = await invokeSessionHandler("sessions.reset", { key, reason });
    sendJson(res, result.ok ? 200 : 400, result.payload ?? { error: result.error });
    return true;
  }

  // ── POST /v1/sessions/compact ────────────────────────────────────────
  if (pathname === "/v1/sessions/compact") {
    const handled = await handleGatewayPostJsonEndpoint(req, res, {
      pathname: "/v1/sessions/compact",
      auth: opts.auth,
      maxBodyBytes: opts.maxBodyBytes ?? MAX_BODY_BYTES,
      trustedProxies: opts.trustedProxies,
      rateLimiter: opts.rateLimiter,
    });
    if (handled === false) {
      return false;
    }
    if (handled === undefined) {
      return true;
    }

    const body = handled.body as Record<string, unknown> | undefined;
    const key = resolveKeyFromBodyOrHeader(req, body);
    if (!key) {
      sendInvalidRequest(res, "key is required (body.key or X-OpenClaw-Session-Key header)");
      return true;
    }

    const maxLines =
      body && typeof body.maxLines === "number" && Number.isFinite(body.maxLines)
        ? body.maxLines
        : undefined;

    const params: Record<string, unknown> = { key };
    if (maxLines !== undefined) {
      params.maxLines = maxLines;
    }

    const result = await invokeSessionHandler("sessions.compact", params);
    sendJson(res, result.ok ? 200 : 400, result.payload ?? { error: result.error });
    return true;
  }

  // ── GET /v1/sessions/status ──────────────────────────────────────────
  if (pathname === "/v1/sessions/status") {
    if (req.method !== "GET" && req.method !== "HEAD") {
      sendMethodNotAllowed(res, "GET");
      return true;
    }

    const authorized = await authorizeGatewayBearerRequestOrReply({
      req,
      res,
      auth: opts.auth,
      trustedProxies: opts.trustedProxies,
      rateLimiter: opts.rateLimiter,
    });
    if (!authorized) {
      return true; // 401 already sent
    }

    const key = getHeader(req, "x-openclaw-session-key")?.trim() ?? url.searchParams.get("key")?.trim();
    if (!key) {
      sendInvalidRequest(res, "key is required (X-OpenClaw-Session-Key header or ?key= query param)");
      return true;
    }

    const agentId = resolveAgentIdFromHeader(req) ?? "main";

    const result = await invokeSessionHandler("sessions.list", {
      agentId,
      key,
    });
    sendJson(res, result.ok ? 200 : 400, result.payload ?? { error: result.error });
    return true;
  }

  // Path starts with /v1/sessions but doesn't match any known route
  sendJson(res, 404, {
    error: {
      message: `Unknown sessions endpoint: ${pathname}`,
      type: "not_found",
    },
  });
  return true;
}
