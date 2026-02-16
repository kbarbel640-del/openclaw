/**
 * Morpheus proxy bridge — session-aware proxy to the Morpheus proxy-router.
 *
 * Absorbed from the standalone morpheus-proxy.mjs (everclaw-fork) into
 * Smart Agent Neo core. Runs as an in-process HTTP server on a random port,
 * transparently handling:
 *
 * 1. Model name → blockchain hex ID resolution
 * 2. Lazy session management (open on first request, auto-renew before expiry)
 * 3. session_id + model_id header injection into proxy-router requests
 * 4. Cookie-based Basic auth to the proxy-router
 * 5. OpenAI-compatible error classification (server_error, never "billing")
 * 6. Two-attempt inference with automatic session recovery
 *
 * CRITICAL BUG FIXES baked in (from Everclaw experiment):
 * - session_id and model_id MUST be HTTP headers, not body fields
 * - Use "sessionDuration" field name (not "duration") to avoid nil pointer panic
 * - Sessions are NOT persisted across router restarts — auto-reopen on demand
 * - All infrastructure errors return type "server_error" to prevent cooldown cascades
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { resolveBlockchainModelId, MORPHEUS_MODEL_MAP } from "./morpheus-models.js";

// ── Types ────────────────────────────────────────────────────────────

interface MorpheusSession {
  sessionId: string;
  expiresAt: number;
}

interface MorpheusProxyConfig {
  /** URL of the Morpheus proxy-router (default: http://localhost:8082) */
  routerUrl: string;
  /** Path to the .cookie file for Basic auth (default: ~/morpheus/.cookie) */
  cookiePath: string;
  /** Session duration in seconds (default: 604800 = 7 days) */
  sessionDuration?: number;
  /** Seconds before expiry to renew (default: 3600 = 1 hour) */
  renewBeforeSec?: number;
}

export interface MorpheusProxyHandle {
  /** Port the proxy is listening on */
  port: number;
  /** Full base URL for OpenAI-compatible requests (http://127.0.0.1:{port}/v1) */
  baseUrl: string;
  /** Shut down the proxy server */
  close: () => Promise<void>;
}

const DEFAULT_SESSION_DURATION = 604800; // 7 days
const DEFAULT_RENEW_BEFORE = 3600; // 1 hour before expiry
const INFERENCE_TIMEOUT_MS = 180000; // 3 minutes

// ── Session Management ───────────────────────────────────────────────

const sessions = new Map<string, MorpheusSession>();

function readCookieAuth(cookiePath: string): string | null {
  try {
    const cookie = fs.readFileSync(cookiePath, "utf-8").trim();
    return "Basic " + Buffer.from(cookie).toString("base64");
  } catch {
    return null;
  }
}

function routerFetch(
  config: MorpheusProxyConfig,
  method: string,
  urlPath: string,
  body: unknown = null,
  extraHeaders: Record<string, string> = {},
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, config.routerUrl);
    const auth = readCookieAuth(config.cookiePath);
    const headers: Record<string, string> = { ...extraHeaders };
    if (auth) {
      headers["Authorization"] = auth;
    }
    if (body) {
      headers["Content-Type"] = "application/json";
    }

    const req = http.request(url, { method, headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => {
        resolve({
          status: res.statusCode ?? 500,
          headers: res.headers,
          body: Buffer.concat(chunks),
        });
      });
    });
    req.on("error", reject);
    if (body) {
      req.write(typeof body === "string" ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function openSession(
  config: MorpheusProxyConfig,
  modelId: string,
): Promise<string> {
  const duration = config.sessionDuration ?? DEFAULT_SESSION_DURATION;
  const renewBefore = config.renewBeforeSec ?? DEFAULT_RENEW_BEFORE;

  console.log(
    `[morpheus-proxy] Opening session for model ${modelId.substring(0, 10)}... (duration: ${duration}s)`,
  );

  // CRITICAL: field name MUST be "sessionDuration", not "duration"
  // Using "duration" causes a nil pointer panic in the proxy-router.
  const res = await routerFetch(
    config,
    "POST",
    `/blockchain/models/${modelId}/session`,
    { sessionDuration: duration },
  );

  if (res.status !== 200) {
    const text = res.body.toString();
    throw new Error(`Failed to open session (${res.status}): ${text}`);
  }

  const data = JSON.parse(res.body.toString()) as { sessionID: string };
  const sessionId = data.sessionID;
  const expiresAt = Date.now() + (duration - renewBefore) * 1000;

  sessions.set(modelId, { sessionId, expiresAt });
  console.log(`[morpheus-proxy] Session opened: ${sessionId.substring(0, 14)}...`);
  return sessionId;
}

async function getOrCreateSession(
  config: MorpheusProxyConfig,
  modelId: string,
): Promise<string> {
  const existing = sessions.get(modelId);
  if (existing && Date.now() < existing.expiresAt) {
    return existing.sessionId;
  }
  if (existing) {
    console.log(`[morpheus-proxy] Session expired, opening new one`);
  }
  return openSession(config, modelId);
}

// ── Error Handling ───────────────────────────────────────────────────

/**
 * Return errors in OpenAI format so Smart Agent Neo's failover engine
 * classifies them correctly. CRITICAL: never use type "billing" for
 * infrastructure errors — that triggers extended cooldown.
 */
function oaiError(
  res: http.ServerResponse,
  status: number,
  message: string,
  type = "server_error",
  code: string | null = null,
): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      error: { message, type, code, param: null },
    }),
  );
}

/** Detect expired/invalid sessions from router response. */
function isSessionError(status: number, bodyStr: string): boolean {
  if (status >= 400 && status < 500) {
    const lower = bodyStr.toLowerCase();
    return (
      lower.includes("session") &&
      (lower.includes("not found") ||
        lower.includes("expired") ||
        lower.includes("invalid") ||
        lower.includes("closed"))
    );
  }
  return false;
}

// ── Inference Forwarding ─────────────────────────────────────────────

function forwardToRouter(
  config: MorpheusProxyConfig,
  body: string,
  sessionId: string,
  modelId: string,
  isStreaming: boolean,
): Promise<{
  status: number;
  body?: Buffer;
  stream?: http.IncomingMessage;
  headers: http.IncomingHttpHeaders;
}> {
  return new Promise((resolve, reject) => {
    const upstreamUrl = new URL("/v1/chat/completions", config.routerUrl);
    const auth = readCookieAuth(config.cookiePath);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      // CRITICAL: session_id and model_id are HTTP headers, NOT body fields.
      // Putting them in the body silently fails.
      session_id: sessionId,
      model_id: modelId,
    };
    if (auth) {
      headers["Authorization"] = auth;
    }

    const upstreamReq = http.request(
      upstreamUrl,
      { method: "POST", headers, timeout: INFERENCE_TIMEOUT_MS },
      (upstreamRes) => {
        if (
          isStreaming &&
          upstreamRes.headers["content-type"]?.includes("text/event-stream")
        ) {
          resolve({
            status: upstreamRes.statusCode ?? 500,
            stream: upstreamRes,
            headers: upstreamRes.headers,
          });
        } else {
          const chunks: Buffer[] = [];
          upstreamRes.on("data", (c: Buffer) => chunks.push(c));
          upstreamRes.on("end", () => {
            resolve({
              status: upstreamRes.statusCode ?? 500,
              body: Buffer.concat(chunks),
              headers: upstreamRes.headers,
            });
          });
          upstreamRes.on("error", (e) => reject(e));
        }
      },
    );

    upstreamReq.on("error", (e) =>
      reject(new Error(`upstream_connect: ${e.message}`)),
    );
    upstreamReq.on("timeout", () => {
      upstreamReq.destroy();
      reject(new Error("upstream_timeout"));
    });

    upstreamReq.write(body);
    upstreamReq.end();
  });
}

// ── Request Handlers ─────────────────────────────────────────────────

async function handleChatCompletions(
  config: MorpheusProxyConfig,
  req: http.IncomingMessage,
  res: http.ServerResponse,
  body: string,
): Promise<void> {
  let parsed: { model?: string; stream?: boolean };
  try {
    parsed = JSON.parse(body);
  } catch {
    oaiError(res, 400, "Invalid JSON body", "invalid_request_error");
    return;
  }

  const requestedModel = parsed.model || "kimi-k2.5";
  const modelId = resolveBlockchainModelId(requestedModel);
  if (!modelId) {
    oaiError(
      res,
      400,
      `Unknown model: ${requestedModel}. Available: ${Object.keys(MORPHEUS_MODEL_MAP).join(", ")}`,
      "invalid_request_error",
      "model_not_found",
    );
    return;
  }

  // ── Attempt 1: use existing/new session ──
  let sessionId: string;
  try {
    sessionId = await getOrCreateSession(config, modelId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[morpheus-proxy] Session open error: ${msg}`);
    oaiError(res, 502, `Morpheus session unavailable: ${msg}`, "server_error", "morpheus_session_error");
    return;
  }

  const isStreaming = parsed.stream === true;
  let attempt1Error: string | null = null;

  try {
    const result = await forwardToRouter(config, body, sessionId, modelId, isStreaming);

    // Streaming response — pipe through
    if (result.stream) {
      res.writeHead(result.status, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      result.stream.on("data", (chunk: Buffer) => res.write(chunk));
      result.stream.on("end", () => res.end());
      result.stream.on("error", () => res.end());
      return;
    }

    const bodyStr = result.body?.toString() ?? "";

    // Success — pass through
    if (result.status >= 200 && result.status < 300) {
      res.writeHead(result.status, {
        "Content-Type": result.headers["content-type"] ?? "application/json",
      });
      res.end(result.body);
      return;
    }

    // Session error — invalidate and retry below
    if (isSessionError(result.status, bodyStr)) {
      console.log(`[morpheus-proxy] Session error (${result.status}), retrying with new session`);
      sessions.delete(modelId);
      attempt1Error = `session_invalid (${result.status})`;
    } else {
      // Non-session upstream error
      console.error(`[morpheus-proxy] Router error (${result.status}): ${bodyStr.substring(0, 200)}`);
      oaiError(
        res,
        result.status >= 500 ? 502 : result.status,
        `Morpheus inference error: ${bodyStr.substring(0, 500)}`,
        "server_error",
        "morpheus_inference_error",
      );
      return;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "upstream_timeout") {
      oaiError(res, 504, "Morpheus inference timed out", "server_error", "timeout");
      return;
    }
    console.error(`[morpheus-proxy] Attempt 1 failed: ${msg}`);
    sessions.delete(modelId);
    attempt1Error = msg;
  }

  // ── Attempt 2: open fresh session and retry once ──
  if (attempt1Error) {
    console.log(`[morpheus-proxy] Retrying with fresh session (attempt 1: ${attempt1Error})`);
    let newSessionId: string;
    try {
      newSessionId = await openSession(config, modelId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      oaiError(res, 502, `Morpheus session unavailable after retry: ${msg}`, "server_error", "morpheus_session_error");
      return;
    }

    try {
      const result = await forwardToRouter(config, body, newSessionId, modelId, isStreaming);

      if (result.stream) {
        res.writeHead(result.status, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        result.stream.on("data", (chunk: Buffer) => res.write(chunk));
        result.stream.on("end", () => res.end());
        result.stream.on("error", () => res.end());
        return;
      }

      const bodyStr = result.body?.toString() ?? "";
      if (result.status >= 200 && result.status < 300) {
        res.writeHead(result.status, {
          "Content-Type": result.headers["content-type"] ?? "application/json",
        });
        res.end(result.body);
        return;
      }

      console.error(`[morpheus-proxy] Retry failed (${result.status}): ${bodyStr.substring(0, 200)}`);
      oaiError(
        res,
        502,
        `Morpheus inference failed after retry: ${bodyStr.substring(0, 500)}`,
        "server_error",
        "morpheus_inference_error",
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "upstream_timeout") {
        oaiError(res, 504, "Morpheus inference timed out (retry)", "server_error", "timeout");
        return;
      }
      oaiError(res, 502, `Morpheus upstream error after retry: ${msg}`, "server_error", "morpheus_upstream_error");
    }
  }
}

function handleModels(res: http.ServerResponse): void {
  const models = Object.keys(MORPHEUS_MODEL_MAP).map((name) => ({
    id: name,
    object: "model",
    created: Math.floor(Date.now() / 1000),
    owned_by: "morpheus",
  }));
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ object: "list", data: models }));
}

function handleHealth(config: MorpheusProxyConfig, res: http.ServerResponse): void {
  const activeSessions: Array<{
    model: string;
    sessionId: string;
    expiresAt: string;
    active: boolean;
  }> = [];
  for (const [modelId, sess] of sessions) {
    const modelName =
      Object.entries(MORPHEUS_MODEL_MAP).find(([, v]) => v === modelId)?.[0] ?? modelId;
    activeSessions.push({
      model: modelName,
      sessionId: sess.sessionId,
      expiresAt: new Date(sess.expiresAt).toISOString(),
      active: Date.now() < sess.expiresAt,
    });
  }
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      status: "ok",
      routerUrl: config.routerUrl,
      activeSessions,
      availableModels: Object.keys(MORPHEUS_MODEL_MAP),
    }),
  );
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Start an in-process Morpheus proxy server.
 *
 * Listens on 127.0.0.1 with a random port. Returns a handle with
 * the base URL to use as the provider's baseUrl in Smart Agent Neo.
 *
 * The proxy intercepts OpenAI-compatible requests and transparently
 * handles session management + blockchain model ID resolution when
 * forwarding to the Morpheus proxy-router.
 */
export function startMorpheusProxy(config: MorpheusProxyConfig): Promise<MorpheusProxyHandle> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://127.0.0.1`);

      if (req.method === "GET" && url.pathname === "/health") {
        handleHealth(config, res);
        return;
      }

      if (req.method === "GET" && url.pathname === "/v1/models") {
        handleModels(res);
        return;
      }

      if (req.method === "POST" && url.pathname === "/v1/chat/completions") {
        const chunks: Buffer[] = [];
        req.on("data", (c: Buffer) => chunks.push(c));
        req.on("end", () => {
          const body = Buffer.concat(chunks).toString();
          handleChatCompletions(config, req, res, body).catch((e) => {
            console.error(`[morpheus-proxy] Unhandled error: ${e}`);
            if (!res.headersSent) {
              oaiError(res, 500, String(e));
            }
          });
        });
        return;
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: "Not found" } }));
    });

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("Failed to bind proxy server"));
        return;
      }
      const port = addr.port;
      const baseUrl = `http://127.0.0.1:${port}/v1`;
      console.log(`[morpheus-proxy] Listening on ${baseUrl}`);
      console.log(`[morpheus-proxy] Router: ${config.routerUrl}`);

      resolve({
        port,
        baseUrl,
        close: () =>
          new Promise<void>((res) => {
            server.close(() => res());
          }),
      });
    });

    server.on("error", reject);
  });
}

/**
 * Resolve proxy configuration from environment variables.
 */
export function resolveMorpheusProxyConfig(): MorpheusProxyConfig | null {
  const routerUrl = process.env.MORPHEUS_ROUTER_URL;
  if (!routerUrl) {
    return null;
  }

  const home = process.env.HOME ?? "";
  return {
    routerUrl,
    cookiePath:
      process.env.MORPHEUS_COOKIE_PATH ?? path.join(home, "morpheus", ".cookie"),
    sessionDuration: process.env.MORPHEUS_SESSION_DURATION
      ? parseInt(process.env.MORPHEUS_SESSION_DURATION, 10)
      : DEFAULT_SESSION_DURATION,
    renewBeforeSec: process.env.MORPHEUS_RENEW_BEFORE
      ? parseInt(process.env.MORPHEUS_RENEW_BEFORE, 10)
      : DEFAULT_RENEW_BEFORE,
  };
}
