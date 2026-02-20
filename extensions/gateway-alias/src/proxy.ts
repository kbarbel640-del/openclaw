import { createServer, request as httpRequest, type Server } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import net from "node:net";

type ProxyLogger = {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
};

export type AliasProxyHandle = {
  start: () => void;
  stop: () => void;
};

/**
 * Create an HTTP reverse proxy that routes requests by Host header
 * to the appropriate gateway port.
 *
 * Supports both regular HTTP requests and WebSocket upgrades.
 */
export function createAliasProxy(params: {
  aliases: Record<string, number>;
  port: number;
  bind: string;
  log: ProxyLogger;
}): AliasProxyHandle {
  const { aliases, port, bind, log } = params;

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const host = resolveHostFromHeader(req.headers.host);
    const targetPort = aliases[host];

    if (!targetPort) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end(`Unknown host: ${host}\nConfigured aliases: ${Object.keys(aliases).join(", ")}`);
      return;
    }

    const proxyReq = httpRequest(
      {
        hostname: "127.0.0.1",
        port: targetPort,
        path: req.url,
        method: req.method,
        headers: {
          ...req.headers,
          // Preserve original Host header so the gateway sees the alias name.
          // Some setups may need the real host; this can be tuned later.
          "x-forwarded-host": req.headers.host ?? "",
        },
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
      },
    );

    proxyReq.on("error", (err) => {
      log.warn(`proxy: ${host} → 127.0.0.1:${targetPort} failed: ${err.message}`);
      if (!res.headersSent) {
        res.writeHead(502, { "Content-Type": "text/plain" });
        res.end(`Bad Gateway: ${host} → port ${targetPort} (${err.message})`);
      }
    });

    req.pipe(proxyReq, { end: true });
  });

  // WebSocket upgrade support — required for the OpenClaw control UI.
  server.on(
    "upgrade",
    (req: IncomingMessage, socket: import("node:stream").Duplex, head: Buffer) => {
      const host = resolveHostFromHeader(req.headers.host);
      const targetPort = aliases[host];

      if (!targetPort) {
        socket.end("HTTP/1.1 404 Not Found\r\n\r\n");
        return;
      }

      const upstream = net.connect({ host: "127.0.0.1", port: targetPort }, () => {
        // Reconstruct the raw HTTP upgrade request for the upstream gateway.
        const lines: string[] = [`${req.method} ${req.url} HTTP/1.1`];
        const headers = { ...req.headers, "x-forwarded-host": req.headers.host ?? "" };
        for (const [key, value] of Object.entries(headers)) {
          if (value === undefined) continue;
          const values = Array.isArray(value) ? value : [value];
          for (const v of values) {
            lines.push(`${key}: ${v}`);
          }
        }
        upstream.write(lines.join("\r\n") + "\r\n\r\n");
        if (head.length > 0) upstream.write(head);

        upstream.pipe(socket, { end: true });
        socket.pipe(upstream, { end: true });
      });

      upstream.on("error", (err) => {
        log.warn(`proxy ws: ${host} → 127.0.0.1:${targetPort} failed: ${err.message}`);
        socket.end();
      });

      socket.on("error", () => upstream.destroy());
    },
  );

  return {
    start: () => {
      server.listen(port, bind, () => {
        log.info(`gateway-alias: proxy listening on ${bind}:${port}`);
      });

      server.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EACCES") {
          log.error(
            `gateway-alias: permission denied binding to ${bind}:${port}. ` +
              `Ports below 1024 require elevated privileges.\n` +
              `  Option 1: Run 'openclaw gateway-alias setup' (configures port forwarding)\n` +
              `  Option 2: Set a higher port in plugins.entries.gateway-alias.config.port`,
          );
        } else if (err.code === "EADDRINUSE") {
          log.error(`gateway-alias: ${bind}:${port} already in use`);
        } else {
          log.error(`gateway-alias: proxy error: ${err.message}`);
        }
      });
    },
    stop: () => {
      server.close();
    },
  };
}

/**
 * Extract the hostname from a Host header, stripping port if present.
 */
function resolveHostFromHeader(hostHeader?: string): string {
  const raw = (hostHeader ?? "").trim().toLowerCase();
  if (!raw) return "";
  // Handle IPv6 bracket notation.
  if (raw.startsWith("[")) {
    const end = raw.indexOf("]");
    return end !== -1 ? raw.slice(1, end) : raw;
  }
  // Strip port suffix for regular hostnames.
  const [name] = raw.split(":");
  return name ?? "";
}
