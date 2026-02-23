import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Regression test for https://github.com/openclaw/openclaw/issues/24023
//
// startTelegramWebhook() must block (keep its returned Promise pending) while
// the webhook server is running, and only resolve once the server has been
// shut down.  Previously the function returned immediately after server.listen()
// resolved, causing the gateway to think the Telegram provider had exited,
// triggering an auto-restart that hit EADDRINUSE on the still-bound port.
// ---------------------------------------------------------------------------

// Minimal mock server that supports .listen(), .close(), and "close" events.
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

vi.mock("node:http", () => ({
  createServer: vi.fn((handler: unknown) => {
    void handler; // suppress unused-var warnings
    return makeMockServer();
  }),
}));

vi.mock("grammy", () => ({
  webhookCallback: vi.fn(() => vi.fn()),
}));

vi.mock("./bot.js", () => ({
  createTelegramBot: vi.fn(() => ({
    api: { setWebhook: vi.fn().mockResolvedValue(undefined) },
    stop: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock("./allowed-updates.js", () => ({
  resolveTelegramAllowedUpdates: vi.fn(() => []),
}));

vi.mock("./api-logging.js", () => ({
  withTelegramApiErrorLogging: vi.fn(({ fn }: { fn: () => unknown }) => fn()),
}));

vi.mock("../infra/diagnostic-events.js", () => ({
  isDiagnosticsEnabled: vi.fn(() => false),
}));

vi.mock("../infra/http-body.js", () => ({
  installRequestBodyLimitGuard: vi.fn(() => ({ isTripped: () => false, dispose: vi.fn() })),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("startTelegramWebhook – lifecycle blocking", () => {
  it("keeps the returned Promise pending while the server is running", async () => {
    const { startTelegramWebhook } = await import("./webhook.js");
    const controller = new AbortController();

    const settled = { value: false };
    const done = startTelegramWebhook({
      token: "test:token",
      secret: "test-secret",
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

  it("resolves immediately if abortSignal is already aborted before listen", async () => {
    const { startTelegramWebhook } = await import("./webhook.js");
    const controller = new AbortController();
    controller.abort(); // pre-aborted

    // Should not hang — resolves because shutdown fires in the race-guard.
    await expect(
      startTelegramWebhook({
        token: "test:token",
        secret: "test-secret",
        abortSignal: controller.signal,
      }),
    ).resolves.toBeUndefined();
  });
});
