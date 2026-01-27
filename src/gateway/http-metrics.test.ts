import { describe, expect, it, afterEach } from "vitest";
import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { createMetricsEndpointsHandler } from "./http-metrics.js";
import type { ResolvedGatewayAuth } from "./auth.js";

const mockAuth: ResolvedGatewayAuth = {
  mode: "token",
  token: "test-token-123",
  allowTailscale: false,
};

function createTestServer(
  handler: (req: IncomingMessage, res: ServerResponse) => Promise<boolean>,
) {
  const server = createServer(async (req, res) => {
    const handled = await handler(req, res);
    if (!handled) {
      res.statusCode = 404;
      res.end("Not Found");
    }
  });
  return server;
}

async function startServer(server: Server): Promise<string> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as AddressInfo;
      resolve(`http://127.0.0.1:${addr.port}`);
    });
  });
}

async function stopServer(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}

describe("http-metrics", () => {
  let server: Server;
  let baseUrl: string;

  afterEach(async () => {
    if (server) {
      await stopServer(server);
    }
  });

  describe("GET /metrics", () => {
    it("returns 404 when metrics are disabled (default)", async () => {
      const handler = createMetricsEndpointsHandler({
        config: { enabled: false },
        resolvedAuth: mockAuth,
      });
      server = createTestServer(handler);
      baseUrl = await startServer(server);

      const res = await fetch(`${baseUrl}/metrics`);
      expect(res.status).toBe(404);
    });

    it("returns 401 without auth when enabled and authRequired is true", async () => {
      const handler = createMetricsEndpointsHandler({
        config: { enabled: true, authRequired: true },
        resolvedAuth: mockAuth,
      });
      server = createTestServer(handler);
      baseUrl = await startServer(server);

      const res = await fetch(`${baseUrl}/metrics`);
      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body.error).toBe("Unauthorized");
    });

    it("returns 200 with valid auth when enabled", async () => {
      const handler = createMetricsEndpointsHandler({
        config: { enabled: true, authRequired: true },
        resolvedAuth: mockAuth,
      });
      server = createTestServer(handler);
      baseUrl = await startServer(server);

      const res = await fetch(`${baseUrl}/metrics`, {
        headers: {
          Authorization: `Bearer ${mockAuth.token}`,
        },
      });
      expect(res.status).toBe(200);

      const body = await res.text();
      // Should contain Prometheus metrics format
      expect(body).toContain("# HELP");
      expect(body).toContain("# TYPE");
    });

    it("returns 200 without auth when authRequired is false", async () => {
      const handler = createMetricsEndpointsHandler({
        config: { enabled: true, authRequired: false },
        resolvedAuth: mockAuth,
      });
      server = createTestServer(handler);
      baseUrl = await startServer(server);

      const res = await fetch(`${baseUrl}/metrics`);
      expect(res.status).toBe(200);
    });

    it("respects custom path", async () => {
      const handler = createMetricsEndpointsHandler({
        config: { enabled: true, authRequired: false, path: "/custom/metrics" },
        resolvedAuth: mockAuth,
      });
      server = createTestServer(handler);
      baseUrl = await startServer(server);

      // Default path should 404
      const res1 = await fetch(`${baseUrl}/metrics`);
      expect(res1.status).toBe(404);

      // Custom path should work
      const res2 = await fetch(`${baseUrl}/custom/metrics`);
      expect(res2.status).toBe(200);
    });
  });

  describe("response format", () => {
    it("includes correct Content-Type header", async () => {
      const handler = createMetricsEndpointsHandler({
        config: { enabled: true, authRequired: false },
        resolvedAuth: mockAuth,
      });
      server = createTestServer(handler);
      baseUrl = await startServer(server);

      const res = await fetch(`${baseUrl}/metrics`);
      const contentType = res.headers.get("Content-Type");
      // Prometheus text format
      expect(contentType).toMatch(/text\/plain|application\/openmetrics-text/);
    });

    it("includes clawdbot metrics", async () => {
      const handler = createMetricsEndpointsHandler({
        config: { enabled: true, authRequired: false },
        resolvedAuth: mockAuth,
      });
      server = createTestServer(handler);
      baseUrl = await startServer(server);

      const res = await fetch(`${baseUrl}/metrics`);
      const body = await res.text();

      // Check for clawdbot-specific metrics
      expect(body).toContain("clawdbot_gateway_uptime_seconds");
    });

    it("includes default Node.js metrics", async () => {
      const handler = createMetricsEndpointsHandler({
        config: { enabled: true, authRequired: false },
        resolvedAuth: mockAuth,
      });
      server = createTestServer(handler);
      baseUrl = await startServer(server);

      const res = await fetch(`${baseUrl}/metrics`);
      const body = await res.text();

      // Check for default Node.js metrics
      expect(body).toContain("nodejs_");
      expect(body).toContain("process_");
    });
  });
});
