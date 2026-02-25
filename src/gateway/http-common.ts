import type { IncomingMessage, ServerResponse } from "node:http";

import { readJsonBody } from "./hooks.js";

// -- Security headers --

/** Apply baseline security headers to every HTTP response. */
export function setSecurityHeaders(res: ServerResponse) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  // Disable legacy XSS auditor (can introduce side-channel attacks)
  res.setHeader("X-XSS-Protection", "0");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cache-Control", "no-store");
}

/** Add HSTS header for TLS connections. */
export function setHstsHeader(res: ServerResponse) {
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
}

// -- CORS --

export type CorsConfig = {
  allowedOrigins?: string[];
  allowedMethods?: string[];
  maxAge?: number;
};

/**
 * Handle CORS for a request.
 * Returns "preflight" if the request was an OPTIONS preflight (response already sent),
 * or "continue" if the handler chain should proceed.
 * When no allowedOrigins are configured, no CORS headers are set (deny cross-origin by default).
 */
export function handleCors(
  req: IncomingMessage,
  res: ServerResponse,
  config?: CorsConfig,
): "preflight" | "continue" {
  const origin = req.headers.origin;
  if (!origin || !config?.allowedOrigins || config.allowedOrigins.length === 0) {
    // No origin header or no allowed origins configured — deny cross-origin silently
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return "preflight";
    }
    return "continue";
  }

  const allowed = config.allowedOrigins.includes("*") || config.allowedOrigins.includes(origin);
  if (!allowed) {
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return "preflight";
    }
    return "continue";
  }

  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") {
    const methods = config.allowedMethods ?? ["GET", "POST", "OPTIONS"];
    res.setHeader("Access-Control-Allow-Methods", methods.join(", "));
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Moltbot-Token");
    res.setHeader("Access-Control-Max-Age", String(config.maxAge ?? 86400));
    res.statusCode = 204;
    res.end();
    return "preflight";
  }

  return "continue";
}

export function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export function sendText(res: ServerResponse, status: number, body: string) {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end(body);
}

export function sendMethodNotAllowed(res: ServerResponse, allow = "POST") {
  res.setHeader("Allow", allow);
  sendText(res, 405, "Method Not Allowed");
}

export function sendUnauthorized(res: ServerResponse) {
  sendJson(res, 401, {
    error: { message: "Unauthorized", type: "unauthorized" },
  });
}

export function sendInvalidRequest(res: ServerResponse, message: string) {
  sendJson(res, 400, {
    error: { message, type: "invalid_request_error" },
  });
}

export async function readJsonBodyOrError(
  req: IncomingMessage,
  res: ServerResponse,
  maxBytes: number,
): Promise<unknown> {
  const body = await readJsonBody(req, maxBytes);
  if (!body.ok) {
    sendInvalidRequest(res, body.error);
    return undefined;
  }
  return body.value;
}

export function writeDone(res: ServerResponse) {
  res.write("data: [DONE]\n\n");
}

export function setSseHeaders(res: ServerResponse) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
}
