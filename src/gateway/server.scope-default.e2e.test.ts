import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { WebSocket } from "ws";
import {
  connectReq,
  getFreePort,
  installGatewayTestHooks,
  rpcReq,
  startGatewayServer,
} from "./test-helpers.js";

installGatewayTestHooks({ scope: "suite" });

describe("VULN-188: default operator scope must not be admin", () => {
  let server: Awaited<ReturnType<typeof startGatewayServer>>;
  let port: number;

  beforeAll(async () => {
    port = await getFreePort();
    server = await startGatewayServer(port);
  });

  afterAll(async () => {
    await server.close();
  });

  async function openWs(): Promise<WebSocket> {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timeout")), 5_000);
      ws.once("open", () => {
        clearTimeout(timer);
        resolve();
      });
      ws.once("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
    return ws;
  }

  test("operator connecting without scopes does not receive admin access", async () => {
    const ws = await openWs();
    try {
      // Connect without specifying scopes (scopes: undefined → omitted from JSON).
      // Before the fix this would default to ["operator.admin"].
      const res = await connectReq(ws, { scopes: [] });
      expect(res.ok).toBe(true);

      // Attempt an admin-only method. It should be denied because the
      // connection should have received only read-level scopes.
      const adminRes = await rpcReq(ws, "config.get");
      expect(adminRes.ok).toBe(false);
      expect(adminRes.error?.message).toContain("missing scope: operator.admin");
    } finally {
      ws.close();
    }
  });

  test("operator connecting without scopes can still access read methods", async () => {
    const ws = await openWs();
    try {
      const res = await connectReq(ws, { scopes: [] });
      expect(res.ok).toBe(true);

      // Read-only methods should still work with the default scope.
      const healthRes = await rpcReq(ws, "health");
      expect(healthRes.ok).toBe(true);
    } finally {
      ws.close();
    }
  });

  test("operator connecting with explicit admin scopes retains admin access", async () => {
    const ws = await openWs();
    try {
      const res = await connectReq(ws, { scopes: ["operator.admin"] });
      expect(res.ok).toBe(true);

      // Admin method should succeed when admin scope is explicitly requested.
      const adminRes = await rpcReq(ws, "config.get");
      expect(adminRes.ok).toBe(true);
    } finally {
      ws.close();
    }
  });
});
