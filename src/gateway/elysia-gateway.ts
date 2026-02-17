/**
 * Elysia Gateway — Pure Elysia HTTP server for the OpenClaw gateway.
 *
 * Replaces the old handler-chain pattern in server-http.ts with typed Elysia routes.
 * Each route group is composed as an Elysia plugin.
 */

import type { Server as HttpServer } from "node:http";
import type { TlsOptions } from "node:tls";
import { node } from "@elysiajs/node";
import { Elysia } from "elysia";
import type { CanvasHostHandler } from "../canvas-host/server.js";
import type { createSubsystemLogger } from "../logging/subsystem.js";
import type { PluginRegistry } from "../plugins/registry.js";
import type { ResolvedGatewayAuth } from "./auth.js";
import type { ControlUiRootState } from "./control-ui-shared.js";
import { csrfGuard } from "./elysia-csrf.js";
import type { HookMessageChannel, HooksConfigResolved } from "./hooks.js";
import { a2uiRoutes } from "./routes/a2ui.js";
import { controlUiRoutes } from "./routes/control-ui.js";
import { hooksRoutes } from "./routes/hooks.js";
import { modelsRoutes } from "./routes/models.js";
import { openAiRoutes } from "./routes/openai-compat.js";
import { openResponsesRoutes } from "./routes/openresponses.js";
import { slackPluginFallback } from "./routes/slack-plugins.js";
import { toolsInvokeRoutes } from "./routes/tools-invoke.js";
import { twitterRoutes } from "./routes/twitter.js";

type SubsystemLogger = ReturnType<typeof createSubsystemLogger>;

export type HookDispatchers = {
  dispatchWakeHook: (value: { text: string; mode: "now" | "next-heartbeat" }) => void;
  dispatchAgentHook: (value: {
    message: string;
    name: string;
    wakeMode: "now" | "next-heartbeat";
    sessionKey?: string;
    deliver: boolean;
    channel: HookMessageChannel;
    to?: string;
    model?: string;
    thinking?: string;
    timeoutSeconds?: number;
    allowUnsafeExternalContent?: boolean;
  }) => string;
};

export interface GatewayElysiaOptions {
  port: number;
  canvasHost: CanvasHostHandler | null;
  controlUiEnabled: boolean;
  controlUiBasePath: string;
  controlUiRoot?: ControlUiRootState;
  openAiChatCompletionsEnabled: boolean;
  openResponsesEnabled: boolean;
  openResponsesConfig?: import("../config/types.gateway.js").GatewayHttpResponsesConfig;
  resolvedAuth: ResolvedGatewayAuth;
  getHooksConfig: () => HooksConfigResolved | null;
  hookDispatchers: HookDispatchers;
  pluginRegistry: PluginRegistry;
  logHooks: SubsystemLogger;
  logPlugins: SubsystemLogger;
  tlsOptions?: TlsOptions;
}

/**
 * Create the main Elysia gateway app with all routes.
 *
 * Returns the Elysia app instance. Call `.listen()` for the primary bind host,
 * or use `getNodeHandler()` for additional bind hosts via Node http.createServer.
 */
export function createGatewayElysiaApp(opts: GatewayElysiaOptions) {
  const app = new Elysia({ adapter: node() })
    // CSRF origin guard for state-changing requests
    .use(csrfGuard({ port: opts.port }))
    // Route groups
    .use(
      hooksRoutes({
        getHooksConfig: opts.getHooksConfig,
        logHooks: opts.logHooks,
        dispatchers: opts.hookDispatchers,
      }),
    )
    .use(modelsRoutes())
    .use(twitterRoutes());

  // Auth-protected routes
  app.use(
    toolsInvokeRoutes({
      auth: opts.resolvedAuth,
    }),
  );

  // Slack + plugin fallback (legacy handler interop)
  app.use(
    slackPluginFallback({
      pluginRegistry: opts.pluginRegistry,
      logPlugins: opts.logPlugins,
    }),
  );

  // Conditionally enable OpenResponses
  if (opts.openResponsesEnabled) {
    app.use(
      openResponsesRoutes({
        auth: opts.resolvedAuth,
        config: opts.openResponsesConfig,
      }),
    );
  }

  // Conditionally enable OpenAI chat completions
  if (opts.openAiChatCompletionsEnabled) {
    app.use(
      openAiRoutes({
        auth: opts.resolvedAuth,
      }),
    );
  }

  // Canvas host / A2UI static serving
  if (opts.canvasHost) {
    app.use(a2uiRoutes());
    // Canvas host HTTP handled via srvx interop (has complex WS + static serving)
    app.use(canvasHostFallback({ canvasHost: opts.canvasHost }));
  }

  // Control UI SPA serving
  if (opts.controlUiEnabled) {
    app.use(
      controlUiRoutes({
        basePath: opts.controlUiBasePath,
        root: opts.controlUiRoot,
      }),
    );
  }

  return app;
}

/**
 * Canvas host fallback — delegates to the existing canvas host handler
 * via srvx Node interop for complex HTTP + WebSocket handling.
 */
function canvasHostFallback(params: { canvasHost: CanvasHostHandler }) {
  const { canvasHost } = params;
  return new Elysia({ name: "canvas-host-fallback" }).all(
    "/__openclaw__/canvas/*",
    async ({ request }) => {
      const { getNodeRequest, getNodeResponse } = await import("./elysia-node-compat.js");
      const req = getNodeRequest(request);
      const res = getNodeResponse(request);
      if (req && res) {
        const handled = await canvasHost.handleHttpRequest(req, res);
        if (handled) {
          // Response already written to Node ServerResponse.
          // srvx checks headersSent and skips its own response writing.
          return;
        }
      }
      return new Response("Not Found", { status: 404 });
    },
  );
}

/**
 * Listen the Elysia app on a specific host:port.
 * Returns the underlying Node.js HTTP server.
 */
export async function listenGatewayElysia(
  app: ReturnType<typeof createGatewayElysiaApp>,
  params: { port: number; hostname: string },
): Promise<HttpServer> {
  return new Promise((resolve, reject) => {
    app.listen({ port: params.port, hostname: params.hostname }, (serverInfo) => {
      const nodeServer = (serverInfo as { raw?: { node?: { server?: HttpServer } } }).raw?.node
        ?.server;
      if (nodeServer) {
        resolve(nodeServer);
      } else {
        reject(
          new Error(`Failed to create gateway HTTP server on ${params.hostname}:${params.port}`),
        );
      }
    });
  });
}
