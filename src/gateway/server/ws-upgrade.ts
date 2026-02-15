import type { Server as HttpServer } from "node:http";
import type { WebSocketServer } from "ws";
import type { CanvasHostHandler } from "../../canvas-host/server.js";
import { isLoopbackAddress } from "../net.js";
import { buildAllowedOrigins, isOriginAllowed } from "../origin-guard.js";

export function attachGatewayUpgradeHandler(opts: {
  httpServer: HttpServer;
  wss: WebSocketServer;
  canvasHost: CanvasHostHandler | null;
  port: number;
}) {
  const { httpServer, wss, canvasHost, port } = opts;
  const allowedWsOrigins = buildAllowedOrigins(port);

  httpServer.on("upgrade", (req, socket, head) => {
    if (canvasHost?.handleUpgrade(req, socket, head)) {
      return;
    }

    // WebSocket origin validation: reject cross-origin connections from browsers.
    // Programmatic clients (CLI, SDKs) typically don't send Origin headers — they're
    // authenticated via the connect handshake. Browsers always send Origin, so if present
    // and mismatched, this is a cross-site WebSocket hijacking attempt.
    const origin = req.headers.origin;
    const clientIp = req.socket?.remoteAddress;
    if (typeof origin === "string" && origin.length > 0 && !isLoopbackAddress(clientIp)) {
      if (!isOriginAllowed(origin, allowedWsOrigins)) {
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
      }
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });
}
