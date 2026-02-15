/**
 * Hooks webhook routes — Elysia plugin.
 *
 * POST /<basePath>/* — Webhook hook endpoints (wake, agent, custom mappings).
 * The basePath is dynamic (from hooks config), so we use a wildcard route.
 */

import { Elysia } from "elysia";
import type { createSubsystemLogger } from "../../logging/subsystem.js";
import type { HookDispatchers } from "../elysia-gateway.js";
import { getNodeRequest, getWebBearerToken } from "../elysia-node-compat.js";
import { applyHookMappings } from "../hooks-mapping.js";
import {
  type HooksConfigResolved,
  normalizeAgentPayload,
  normalizeHookHeaders,
  normalizeWakePayload,
  resolveHookChannel,
  resolveHookDeliver,
  getHookChannelError,
} from "../hooks.js";

type SubsystemLogger = ReturnType<typeof createSubsystemLogger>;

function extractHookTokenFromRequest(
  request: Request,
  url: URL,
): { token: string | undefined; fromQuery: boolean } {
  // Check Authorization: Bearer <token>
  const bearer = getWebBearerToken(request);
  if (bearer) {
    return { token: bearer, fromQuery: false };
  }

  // Check X-OpenClaw-Token header
  const headerToken = request.headers.get("x-openclaw-token")?.trim();
  if (headerToken) {
    return { token: headerToken, fromQuery: false };
  }

  // Check query parameter (deprecated)
  const queryToken = url.searchParams.get("token")?.trim();
  if (queryToken) {
    return { token: queryToken, fromQuery: true };
  }

  return { token: undefined, fromQuery: false };
}

export function hooksRoutes(params: {
  getHooksConfig: () => HooksConfigResolved | null;
  logHooks: SubsystemLogger;
  dispatchers: HookDispatchers;
}) {
  const { getHooksConfig, logHooks, dispatchers } = params;

  // Use a wildcard route that checks if the path matches the hooks basePath.
  // This is necessary because the basePath is dynamic (configured at runtime).
  return new Elysia({ name: "hooks-routes" }).all("/*", async ({ request, set, body: rawBody }) => {
    const hooksConfig = getHooksConfig();
    if (!hooksConfig) {
      // Not configured — pass through (return undefined to let Elysia try next route)
      return;
    }

    const url = new URL(request.url);
    const basePath = hooksConfig.basePath;
    if (url.pathname !== basePath && !url.pathname.startsWith(`${basePath}/`)) {
      return; // Not a hooks path — pass through
    }

    // Extract and verify token
    const { token, fromQuery } = extractHookTokenFromRequest(request, url);
    if (!token || token !== hooksConfig.token) {
      set.status = 401;
      set.headers["content-type"] = "text/plain; charset=utf-8";
      return "Unauthorized";
    }
    if (fromQuery) {
      logHooks.warn(
        "Hook token provided via query parameter is deprecated for security reasons. " +
          "Tokens in URLs appear in logs, browser history, and referrer headers. " +
          "Use Authorization: Bearer <token> or X-OpenClaw-Token header instead.",
      );
    }

    if (request.method !== "POST") {
      set.status = 405;
      set.headers["allow"] = "POST";
      set.headers["content-type"] = "text/plain; charset=utf-8";
      return "Method Not Allowed";
    }

    const subPath = url.pathname.slice(basePath.length).replace(/^\/+/, "");
    if (!subPath) {
      set.status = 404;
      set.headers["content-type"] = "text/plain; charset=utf-8";
      return "Not Found";
    }

    // Body is auto-parsed by Elysia
    const payload =
      rawBody && typeof rawBody === "object" && !Array.isArray(rawBody)
        ? (rawBody as Record<string, unknown>)
        : {};

    // Build normalized headers from the raw Node request (for hook mapping compatibility)
    const nodeReq = getNodeRequest(request);
    const headers = nodeReq
      ? normalizeHookHeaders(nodeReq)
      : Object.fromEntries(request.headers.entries());

    if (subPath === "wake") {
      const normalized = normalizeWakePayload(payload);
      if (!normalized.ok) {
        set.status = 400;
        return { ok: false, error: normalized.error };
      }
      dispatchers.dispatchWakeHook(normalized.value);
      return { ok: true, mode: normalized.value.mode };
    }

    if (subPath === "agent") {
      const normalized = normalizeAgentPayload(payload);
      if (!normalized.ok) {
        set.status = 400;
        return { ok: false, error: normalized.error };
      }
      const runId = dispatchers.dispatchAgentHook(normalized.value);
      set.status = 202;
      return { ok: true, runId };
    }

    // Custom hook mappings
    if (hooksConfig.mappings.length > 0) {
      try {
        const mapped = await applyHookMappings(hooksConfig.mappings, {
          payload,
          headers,
          url,
          path: subPath,
        });
        if (mapped) {
          if (!mapped.ok) {
            set.status = 400;
            return { ok: false, error: mapped.error };
          }
          if (mapped.action === null) {
            set.status = 204;
            return;
          }
          if (mapped.action.kind === "wake") {
            dispatchers.dispatchWakeHook({
              text: mapped.action.text,
              mode: mapped.action.mode,
            });
            return { ok: true, mode: mapped.action.mode };
          }
          const channel = resolveHookChannel(mapped.action.channel);
          if (!channel) {
            set.status = 400;
            return { ok: false, error: getHookChannelError() };
          }
          const runId = dispatchers.dispatchAgentHook({
            message: mapped.action.message,
            name: mapped.action.name ?? "Hook",
            wakeMode: mapped.action.wakeMode,
            sessionKey: mapped.action.sessionKey ?? "",
            deliver: resolveHookDeliver(mapped.action.deliver),
            channel,
            to: mapped.action.to,
            model: mapped.action.model,
            thinking: mapped.action.thinking,
            timeoutSeconds: mapped.action.timeoutSeconds,
            allowUnsafeExternalContent: mapped.action.allowUnsafeExternalContent,
          });
          set.status = 202;
          return { ok: true, runId };
        }
      } catch (err) {
        logHooks.warn(`hook mapping failed: ${String(err)}`);
        set.status = 500;
        return { ok: false, error: "hook mapping failed" };
      }
    }

    set.status = 404;
    set.headers["content-type"] = "text/plain; charset=utf-8";
    return "Not Found";
  });
}
