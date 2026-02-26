import type { IncomingMessage, ServerResponse } from "node:http";
import { loadConfig, validateConfigObjectWithPlugins } from "../config/config.js";
import type { AuthRateLimiter } from "./auth-rate-limit.js";
import type { ResolvedGatewayAuth } from "./auth.js";
import { loadConfigSchemaWithPlugins } from "./config-schema-loader.js";
import { authorizeGatewayBearerRequestOrReply } from "./http-auth-helpers.js";
import {
  readJsonBodyOrError,
  sendInvalidRequest,
  sendJson,
  sendMethodNotAllowed,
} from "./http-common.js";

const DEFAULT_BODY_BYTES = 2 * 1024 * 1024;

type ConfigHttpOptions = {
  auth: ResolvedGatewayAuth;
  maxBodyBytes?: number;
  trustedProxies?: string[];
  allowRealIpFallback?: boolean;
  rateLimiter?: AuthRateLimiter;
};

function collectSchemaPaths(schema: unknown): Set<string> {
  const paths = new Set<string>();

  const walk = (node: unknown, prefix = "") => {
    if (!node || typeof node !== "object" || Array.isArray(node)) {
      return;
    }
    const schemaNode = node as {
      properties?: Record<string, unknown>;
      items?: unknown;
      additionalProperties?: unknown;
    };

    const properties =
      schemaNode.properties && typeof schemaNode.properties === "object"
        ? schemaNode.properties
        : null;
    if (properties) {
      for (const [key, value] of Object.entries(properties)) {
        const nextPath = prefix ? `${prefix}.${key}` : key;
        paths.add(nextPath);
        walk(value, nextPath);
      }
    }

    if (
      schemaNode.items &&
      typeof schemaNode.items === "object" &&
      !Array.isArray(schemaNode.items)
    ) {
      const nextPath = prefix ? `${prefix}[]` : "[]";
      paths.add(nextPath);
      walk(schemaNode.items, nextPath);
    }

    if (
      schemaNode.additionalProperties &&
      typeof schemaNode.additionalProperties === "object" &&
      !Array.isArray(schemaNode.additionalProperties)
    ) {
      const nextPath = prefix ? `${prefix}.*` : "*";
      paths.add(nextPath);
      walk(schemaNode.additionalProperties, nextPath);
    }
  };

  walk(schema);
  return paths;
}

function resolveValidationInput(body: unknown): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return body;
  }
  const record = body as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(record, "config")) {
    return record.config;
  }
  return body;
}

export async function handleConfigHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  opts: ConfigHttpOptions,
): Promise<boolean> {
  const cfg = loadConfig();
  const trustedProxies = opts.trustedProxies ?? cfg.gateway?.trustedProxies;
  const allowRealIpFallback = opts.allowRealIpFallback ?? cfg.gateway?.allowRealIpFallback;
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (url.pathname === "/v1/config/schema") {
    if (req.method !== "GET") {
      sendMethodNotAllowed(res, "GET");
      return true;
    }
    const authorized = await authorizeGatewayBearerRequestOrReply({
      req,
      res,
      auth: opts.auth,
      trustedProxies,
      allowRealIpFallback,
      rateLimiter: opts.rateLimiter,
    });
    if (!authorized) {
      return true;
    }
    sendJson(res, 200, loadConfigSchemaWithPlugins());
    return true;
  }

  if (url.pathname === "/v1/config/keys") {
    if (req.method !== "GET") {
      sendMethodNotAllowed(res, "GET");
      return true;
    }
    const authorized = await authorizeGatewayBearerRequestOrReply({
      req,
      res,
      auth: opts.auth,
      trustedProxies,
      allowRealIpFallback,
      rateLimiter: opts.rateLimiter,
    });
    if (!authorized) {
      return true;
    }
    const schemaResponse = loadConfigSchemaWithPlugins();
    const keys = new Set<string>(Object.keys(schemaResponse.uiHints));
    for (const path of collectSchemaPaths(schemaResponse.schema)) {
      keys.add(path);
    }
    sendJson(res, 200, { keys: [...keys].toSorted((a, b) => a.localeCompare(b)) });
    return true;
  }

  if (url.pathname === "/v1/config/validate") {
    if (req.method !== "POST") {
      sendMethodNotAllowed(res, "POST");
      return true;
    }
    const authorized = await authorizeGatewayBearerRequestOrReply({
      req,
      res,
      auth: opts.auth,
      trustedProxies,
      allowRealIpFallback,
      rateLimiter: opts.rateLimiter,
    });
    if (!authorized) {
      return true;
    }
    const body = await readJsonBodyOrError(req, res, opts.maxBodyBytes ?? DEFAULT_BODY_BYTES);
    if (body === undefined) {
      return true;
    }
    const validateInput = resolveValidationInput(body);
    if (!validateInput || typeof validateInput !== "object" || Array.isArray(validateInput)) {
      sendInvalidRequest(res, "config.validate expects a JSON object or { config: {...} }");
      return true;
    }

    const result = validateConfigObjectWithPlugins(validateInput);
    if (!result.ok) {
      sendJson(res, 200, {
        valid: false,
        issues: result.issues,
        warnings: result.warnings,
      });
      return true;
    }
    sendJson(res, 200, {
      valid: true,
      issues: [],
      warnings: result.warnings,
    });
    return true;
  }

  return false;
}
