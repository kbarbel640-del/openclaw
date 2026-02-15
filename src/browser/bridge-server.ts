import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { node } from "@elysiajs/node";
import { Elysia } from "elysia";
import type { ResolvedBrowserConfig } from "./config.js";
import { registerBrowserRoutes } from "./routes/index.js";
import { createBrowserRouteAdapter } from "./routes/types.js";
import {
  type BrowserServerState,
  createBrowserRouteContext,
  type ProfileContext,
} from "./server-context.js";

export type BrowserBridge = {
  server: Server;
  port: number;
  baseUrl: string;
  state: BrowserServerState;
};

export async function startBrowserBridgeServer(params: {
  resolved: ResolvedBrowserConfig;
  host?: string;
  port?: number;
  authToken?: string;
  onEnsureAttachTarget?: (profile: ProfileContext["profile"]) => Promise<void>;
}): Promise<BrowserBridge> {
  const host = params.host ?? "127.0.0.1";
  const port = params.port ?? 0;

  const app = new Elysia({ adapter: node() });

  const authToken = params.authToken?.trim();
  if (authToken) {
    app.onBeforeHandle(({ request, set }) => {
      const auth = request.headers.get("authorization")?.trim() ?? "";
      if (auth !== `Bearer ${authToken}`) {
        set.status = 401;
        return "Unauthorized";
      }
    });
  }

  const registrar = createBrowserRouteAdapter(app);

  const state: BrowserServerState = {
    server: null as unknown as Server,
    port,
    resolved: params.resolved,
    profiles: new Map(),
  };

  const ctx = createBrowserRouteContext({
    getState: () => state,
    onEnsureAttachTarget: params.onEnsureAttachTarget,
  });
  registerBrowserRoutes(registrar, ctx);

  const server = await new Promise<Server>((resolve, reject) => {
    const instance = app.listen({ port, hostname: host }) as unknown as { server?: Server };
    if (instance.server) {
      instance.server.once("listening", () => {
        if (instance.server) {
          resolve(instance.server);
        }
      });
      instance.server.once("error", reject);
    } else {
      reject(new Error("Failed to create HTTP server"));
    }
  });

  const address = server.address() as AddressInfo | null;
  const resolvedPort = address?.port ?? port;
  state.server = server;
  state.port = resolvedPort;
  state.resolved.controlPort = resolvedPort;

  const baseUrl = `http://${host}:${resolvedPort}`;
  return { server, port: resolvedPort, baseUrl, state };
}

export async function stopBrowserBridgeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
}
