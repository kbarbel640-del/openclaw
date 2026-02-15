/**
 * CSRF Origin Guard as Elysia middleware.
 *
 * Validates Origin/Referer headers on state-changing HTTP requests (POST, PUT, DELETE, etc.).
 * Bearer-authenticated and loopback requests bypass this check.
 */

import { Elysia } from "elysia";
import { loadConfig } from "../config/config.js";
import { getNodeRequest, getWebBearerToken } from "./elysia-node-compat.js";
import { resolveGatewayClientIp } from "./net.js";
import { buildAllowedOrigins, checkRequestOrigin } from "./origin-guard.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function csrfGuard(params: { port: number }) {
  return new Elysia({ name: "csrf-guard" }).onBeforeHandle(({ request, set }) => {
    const method = request.method;
    if (SAFE_METHODS.has(method)) {
      return;
    }

    const configSnapshot = loadConfig();
    const trustedProxies = configSnapshot.gateway?.trustedProxies ?? [];
    const port = configSnapshot.gateway?.port ?? params.port;

    // Resolve client IP — prefer raw Node.js socket address when available.
    const nodeReq = getNodeRequest(request);
    const clientIp = resolveGatewayClientIp({
      remoteAddr: nodeReq?.socket?.remoteAddress,
      forwardedFor: request.headers.get("x-forwarded-for") ?? undefined,
      realIp: request.headers.get("x-real-ip") ?? undefined,
      trustedProxies,
    });

    const originResult = checkRequestOrigin({
      method,
      origin: request.headers.get("origin") ?? undefined,
      referer: request.headers.get("referer") ?? undefined,
      clientIp,
      hasBearerToken: !!getWebBearerToken(request),
      config: {
        allowLoopback: true,
        allowBearerBypass: true,
        allowedOrigins: buildAllowedOrigins(port),
      },
    });

    if (!originResult.allowed) {
      set.status = 403;
      set.headers["content-type"] = "application/json; charset=utf-8";
      return { error: "origin_rejected", reason: originResult.reason };
    }
  });
}
