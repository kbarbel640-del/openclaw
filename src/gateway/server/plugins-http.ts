import type { IncomingMessage, ServerResponse } from "node:http";
import type { createSubsystemLogger } from "../../logging/subsystem.js";
import type { CapabilityEnforcementMode } from "../../plugins/capability-enforcer.js";
import { createHttpRouteGuard } from "../../plugins/capability-enforcer.js";
import type { PluginRegistry } from "../../plugins/registry.js";

type SubsystemLogger = ReturnType<typeof createSubsystemLogger>;

export type PluginHttpRequestHandler = (
  req: IncomingMessage,
  res: ServerResponse,
) => Promise<boolean>;

export function createGatewayPluginRequestHandler(params: {
  registry: PluginRegistry;
  log: SubsystemLogger;
  enforcementMode?: CapabilityEnforcementMode;
}): PluginHttpRequestHandler {
  const { registry, log } = params;
  const enforcementMode = params.enforcementMode ?? "warn";

  // Build a map of pluginId → HTTP route guard for plugins with enforcers
  const routeGuards = new Map<string, ReturnType<typeof createHttpRouteGuard>>();
  for (const plugin of registry.plugins) {
    if (plugin.status === "loaded" && plugin.capabilityEnforcer) {
      routeGuards.set(
        plugin.id,
        createHttpRouteGuard(plugin.capabilityEnforcer, enforcementMode, plugin.id),
      );
    }
  }

  return async (req, res) => {
    const routes = registry.httpRoutes ?? [];
    const handlers = registry.httpHandlers ?? [];
    if (routes.length === 0 && handlers.length === 0) {
      return false;
    }

    if (routes.length > 0) {
      const url = new URL(req.url ?? "/", "http://localhost");
      const route = routes.find((entry) => entry.path === url.pathname);
      if (route) {
        // Check capability enforcement for this route's plugin
        const guard = route.pluginId ? routeGuards.get(route.pluginId) : undefined;
        if (guard) {
          const check = guard(req, res);
          if (check.blocked) {
            return true;
          }
        }
        try {
          await route.handler(req, res);
          return true;
        } catch (err) {
          log.warn(`plugin http route failed (${route.pluginId ?? "unknown"}): ${String(err)}`);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "text/plain; charset=utf-8");
            res.end("Internal Server Error");
          }
          return true;
        }
      }
    }

    for (const entry of handlers) {
      try {
        const handled = await entry.handler(req, res);
        if (handled) {
          return true;
        }
      } catch (err) {
        log.warn(`plugin http handler failed (${entry.pluginId}): ${String(err)}`);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.end("Internal Server Error");
        }
        return true;
      }
    }
    return false;
  };
}
