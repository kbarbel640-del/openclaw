/**
 * Slack + Plugin fallback routes — Elysia plugin.
 *
 * These handlers use Node.js IncomingMessage/ServerResponse types for backward
 * compatibility with the plugin API and Slack webhook registry.
 *
 * Uses srvx interop to access raw Node.js objects from the Elysia context.
 * When a legacy handler writes to the Node ServerResponse directly,
 * srvx detects headersSent and skips its own response writing.
 */

import { Elysia } from "elysia";
import type { createSubsystemLogger } from "../../logging/subsystem.js";
import type { PluginRegistry } from "../../plugins/registry.js";
import { handleSlackHttpRequest } from "../../slack/http/index.js";
import { getNodeRequest, getNodeResponse } from "../elysia-node-compat.js";

type SubsystemLogger = ReturnType<typeof createSubsystemLogger>;

export function slackPluginFallback(params: {
  pluginRegistry: PluginRegistry;
  logPlugins: SubsystemLogger;
}) {
  const { pluginRegistry, logPlugins } = params;

  return new Elysia({ name: "slack-plugin-fallback" }).all("/*", async ({ request, set }) => {
    const nodeReq = getNodeRequest(request);
    const nodeRes = getNodeResponse(request);
    if (!nodeReq || !nodeRes) {
      // Not running under @elysiajs/node — skip
      return;
    }

    // Try Slack webhook handlers first
    const slackHandled = await handleSlackHttpRequest(nodeReq, nodeRes);
    if (slackHandled) {
      // Response already written by the Slack handler.
      // Return undefined — srvx will check headersSent and skip.
      return;
    }

    // Try plugin HTTP routes and handlers
    const routes = pluginRegistry.httpRoutes ?? [];
    const handlers = pluginRegistry.httpHandlers ?? [];
    if (routes.length === 0 && handlers.length === 0) {
      return;
    }

    const url = new URL(request.url);

    // Exact path match routes
    if (routes.length > 0) {
      const route = routes.find((entry) => entry.path === url.pathname);
      if (route) {
        try {
          await route.handler(nodeReq, nodeRes);
          return; // Response written by plugin
        } catch (err) {
          logPlugins.warn(
            `plugin http route failed (${route.pluginId ?? "unknown"}): ${String(err)}`,
          );
          if (!nodeRes.headersSent) {
            set.status = 500;
            set.headers["content-type"] = "text/plain; charset=utf-8";
            return "Internal Server Error";
          }
          return;
        }
      }
    }

    // Handler chain (each returns boolean)
    for (const entry of handlers) {
      try {
        const handled = await entry.handler(nodeReq, nodeRes);
        if (handled) {
          return; // Response written by plugin
        }
      } catch (err) {
        logPlugins.warn(`plugin http handler failed (${entry.pluginId}): ${String(err)}`);
        if (!nodeRes.headersSent) {
          set.status = 500;
          set.headers["content-type"] = "text/plain; charset=utf-8";
          return "Internal Server Error";
        }
        return;
      }
    }

    // No handler matched — pass through to let Elysia return 404
  });
}
