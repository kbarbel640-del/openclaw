/**
 * Compatibility layer for accessing raw Node.js request/response objects
 * from Elysia handlers when using @elysiajs/node adapter (via srvx).
 *
 * srvx wraps Node.js IncomingMessage/ServerResponse into a Web Standard
 * Request/Response. The raw objects are stored at request.runtime.node.{req, res}.
 */

import type { IncomingMessage, ServerResponse } from "node:http";

type SrvxRuntime = {
  name: string;
  node?: { req: IncomingMessage; res: ServerResponse };
};

type SrvxRequest = Request & {
  runtime?: SrvxRuntime;
  ip?: string;
};

/**
 * Extract the raw Node.js IncomingMessage from an Elysia/srvx request.
 * Returns undefined if not running under @elysiajs/node adapter.
 */
export function getNodeRequest(request: Request): IncomingMessage | undefined {
  return (request as SrvxRequest).runtime?.node?.req;
}

/**
 * Extract the raw Node.js ServerResponse from an Elysia/srvx request.
 * Returns undefined if not running under @elysiajs/node adapter.
 */
export function getNodeResponse(request: Request): ServerResponse | undefined {
  return (request as SrvxRequest).runtime?.node?.res;
}

/**
 * Get the client IP address from a srvx request.
 * Falls back to x-forwarded-for header if srvx .ip is unavailable.
 */
export function getRequestIp(request: Request): string | undefined {
  const srvxIp = (request as SrvxRequest).ip;
  if (srvxIp) {
    return srvxIp;
  }
  const nodeReq = getNodeRequest(request);
  return nodeReq?.socket?.remoteAddress;
}

/**
 * Get a single header value from a Web Standard Request.
 * Equivalent to getHeader(req, name) from http-utils.ts.
 */
export function getWebHeader(request: Request, name: string): string | undefined {
  return request.headers.get(name) ?? undefined;
}

/**
 * Extract Bearer token from Authorization header.
 * Equivalent to getBearerToken(req) from http-utils.ts.
 */
export function getWebBearerToken(request: Request): string | undefined {
  const raw = request.headers.get("authorization")?.trim() ?? "";
  if (!raw.toLowerCase().startsWith("bearer ")) {
    return undefined;
  }
  const token = raw.slice(7).trim();
  return token || undefined;
}
