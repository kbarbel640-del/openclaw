import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Regression test for https://github.com/openclaw/openclaw/issues/19854
//
// monitorNextcloudTalkProvider() must block (keep its returned Promise
// pending) while the webhook server is running, and only resolve once the
// server has closed. Previously the function returned immediately after
// server.listen() resolved, causing the gateway to treat the provider as
// "exited" and schedule an auto-restart 5 s later. The restart attempt tried
// to bind the same port while the original server was still listening,
// crashing the gateway with EADDRINUSE in an infinite loop.
// ---------------------------------------------------------------------------

function makeMockServer() {
  const emitter = new EventEmitter();
  const server = {
    listen: vi.fn((_port: unknown, _host: unknown, cb: () => void) => {
      cb(); // resolve the listen Promise immediately
    }),
    close: vi.fn(() => {
      emitter.emit("close");
    }),
    on: emitter.on.bind(emitter),
  };
  return server;
}

vi.mock("node:http", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:http")>();
  return {
    ...actual,
    createServer: vi.fn(() => makeMockServer()),
  };
});

vi.mock("./runtime.js", () => ({
  getNextcloudTalkRuntime: vi.fn(() => ({
    config: { loadConfig: vi.fn(() => ({})) },
    logging: {
      getChildLogger: vi.fn(() => ({
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      })),
    },
    channel: {
      activity: { record: vi.fn() },
    },
  })),
}));

vi.mock("./accounts.js", () => ({
  resolveNextcloudTalkAccount: vi.fn(() => ({
    accountId: "default",
    secret: "test-secret",
    baseUrl: "https://cloud.example.com",
    config: {
      webhookPort: 8788,
      webhookHost: "0.0.0.0",
      webhookPath: "/nextcloud-talk-webhook",
    },
    enabled: true,
    name: "test",
    secretSource: "config",
  })),
}));

vi.mock("./inbound.js", () => ({
  handleNextcloudTalkInbound: vi.fn(),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("monitorNextcloudTalkProvider – lifecycle blocking", () => {
  it("keeps the returned Promise pending while the server is running", async () => {
    const { monitorNextcloudTalkProvider } = await import("./monitor.js");
    const controller = new AbortController();

    const settled = { value: false };
    const done = monitorNextcloudTalkProvider({
      abortSignal: controller.signal,
    }).then(() => {
      settled.value = true;
    });

    // Give the microtask queue a chance to flush — Promise must still be pending.
    await Promise.resolve();
    await Promise.resolve();
    expect(settled.value).toBe(false);

    // Aborting triggers shutdown → server.close() → "close" event → resolve.
    controller.abort();
    await done;
    expect(settled.value).toBe(true);
  });

  it("resolves immediately if abortSignal is already aborted before server starts", async () => {
    const { monitorNextcloudTalkProvider } = await import("./monitor.js");
    const controller = new AbortController();
    controller.abort(); // pre-aborted

    // Should not hang — resolves because the race-guard fires stop() inline.
    await expect(
      monitorNextcloudTalkProvider({ abortSignal: controller.signal }),
    ).resolves.toBeUndefined();
  });
});
