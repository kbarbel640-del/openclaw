import type { AddressInfo } from "node:net";
import type { OpenClawConfig, PluginRuntime } from "openclaw/plugin-sdk";
import { createServer } from "node:http";
import { describe, expect, it } from "vitest";
import type { ResolvedZaloAccount } from "./types.js";
import { handleZaloWebhookRequest, registerZaloWebhookTarget } from "./monitor.js";

async function withServer(
  handler: Parameters<typeof createServer>[0],
  fn: (baseUrl: string) => Promise<void>,
) {
  const server = createServer(handler);
  await new Promise<void>((resolve) => {
    // Avoid binding explicitly to 127.0.0.1 in restricted environments where loopback listen can be denied.
    server.listen(0, () => resolve());
  });
  const address = server.address() as AddressInfo | null;
  if (!address) {
    throw new Error("missing server address");
  }
  const host = address.family === "IPv6" ? "[::1]" : "127.0.0.1";
  try {
    await fn(`http://${host}:${address.port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe("handleZaloWebhookRequest", () => {
  it("returns 400 for non-object payloads", async () => {
    const core = {} as PluginRuntime;
    const account: ResolvedZaloAccount = {
      accountId: "default",
      enabled: true,
      token: "tok",
      tokenSource: "config",
      config: {},
    };
    const unregister = registerZaloWebhookTarget({
      token: "tok",
      account,
      config: {} as OpenClawConfig,
      runtime: {},
      core,
      secret: "secret",
      path: "/hook",
      mediaMaxMb: 5,
    });

    try {
      await withServer(
        async (req, res) => {
          const handled = await handleZaloWebhookRequest(req, res);
          if (!handled) {
            res.statusCode = 404;
            res.end("not found");
          }
        },
        async (baseUrl) => {
          const response = await fetch(`${baseUrl}/hook`, {
            method: "POST",
            headers: {
              "x-bot-api-secret-token": "secret",
            },
            body: "null",
          });

          expect(response.status).toBe(400);
        },
      );
    } finally {
      unregister();
    }
  });
});
