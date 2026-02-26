import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getFreePort, installGatewayTestHooks, startGatewayServer } from "./test-helpers.js";

installGatewayTestHooks({ scope: "suite" });

let server: Awaited<ReturnType<typeof startGatewayServer>>;
let port: number;

beforeAll(async () => {
  port = await getFreePort();
  server = await startGatewayServer(port, {
    host: "127.0.0.1",
    auth: { mode: "token", token: "secret" },
    controlUiEnabled: false,
  });
});

afterAll(async () => {
  await server.close({ reason: "config http tests done" });
});

async function request(
  pathname: string,
  params?: { method?: string; body?: unknown; auth?: boolean },
) {
  return await fetch(`http://127.0.0.1:${port}${pathname}`, {
    method: params?.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(params?.auth === false ? {} : { authorization: "Bearer secret" }),
    },
    body: params?.body === undefined ? undefined : JSON.stringify(params.body),
  });
}

describe("Config HTTP API", () => {
  it("serves full schema with auth", async () => {
    const res = await request("/v1/config/schema");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      schema?: { type?: string; properties?: Record<string, unknown> };
      uiHints?: Record<string, unknown>;
    };
    expect(body.schema?.type).toBe("object");
    expect(body.schema?.properties).toBeDefined();
    expect(body.uiHints?.["gateway.auth.mode"]).toBeDefined();
  });

  it("rejects unauthenticated schema request", async () => {
    const res = await request("/v1/config/schema", { auth: false });
    expect(res.status).toBe(401);
  });

  it("lists config keys", async () => {
    const res = await request("/v1/config/keys");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { keys?: string[] };
    expect(Array.isArray(body.keys)).toBe(true);
    expect(body.keys).toContain("gateway.auth.mode");
    expect(body.keys).toContain("channels.defaults.groupPolicy");
  });

  it("validates config objects", async () => {
    const validRes = await request("/v1/config/validate", {
      method: "POST",
      body: { config: { gateway: { mode: "local" } } },
    });
    expect(validRes.status).toBe(200);
    const validBody = (await validRes.json()) as { valid?: boolean; issues?: unknown[] };
    expect(validBody.valid).toBe(true);
    expect(validBody.issues).toEqual([]);

    const invalidRes = await request("/v1/config/validate", {
      method: "POST",
      body: { config: { gateway: { mode: "invalid-mode" } } },
    });
    expect(invalidRes.status).toBe(200);
    const invalidBody = (await invalidRes.json()) as { valid?: boolean; issues?: unknown[] };
    expect(invalidBody.valid).toBe(false);
    expect((invalidBody.issues ?? []).length).toBeGreaterThan(0);
  });

  it("returns 405 on wrong methods", async () => {
    const resSchema = await request("/v1/config/schema", { method: "POST", body: {} });
    expect(resSchema.status).toBe(405);

    const resValidate = await request("/v1/config/validate");
    expect(resValidate.status).toBe(405);
  });
});
