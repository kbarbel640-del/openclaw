import { describe, expect, it, vi } from "vitest";
import {
  clearTelegramWebhookRateLimits,
  getTelegramWebhookRateLimitStateSize,
  isTelegramWebhookRateLimited,
  startTelegramWebhook,
} from "./webhook.js";

const handlerSpy = vi.hoisted(() =>
  vi.fn(
    (_req: unknown, res: { writeHead: (status: number) => void; end: (body?: string) => void }) => {
      res.writeHead(200);
      res.end("ok");
    },
  ),
);
const setWebhookSpy = vi.hoisted(() => vi.fn());
const stopSpy = vi.hoisted(() => vi.fn());
const webhookCallbackSpy = vi.hoisted(() => vi.fn(() => handlerSpy));
const createTelegramBotSpy = vi.hoisted(() =>
  vi.fn(() => ({
    api: { setWebhook: setWebhookSpy },
    stop: stopSpy,
  })),
);

vi.mock("grammy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("grammy")>();
  return {
    ...actual,
    webhookCallback: webhookCallbackSpy,
  };
});

vi.mock("./bot.js", () => ({
  createTelegramBot: createTelegramBotSpy,
}));

describe("startTelegramWebhook", () => {
  it("rate limits webhook burst traffic with 429", async () => {
    handlerSpy.mockClear();
    createTelegramBotSpy.mockClear();
    clearTelegramWebhookRateLimits();

    const abort = new AbortController();
    const cfg = { bindings: [] };
    const { server } = await startTelegramWebhook({
      token: "tok",
      secret: "secret",
      accountId: "opie",
      config: cfg,
      port: 0,
      abortSignal: abort.signal,
      path: "/hook",
    });
    const addr = server.address();
    if (!addr || typeof addr === "string") {
      throw new Error("no addr");
    }

    let saw429 = false;
    for (let i = 0; i < 130; i += 1) {
      const res = await fetch(`http://127.0.0.1:${addr.port}/hook`, { method: "POST" });
      if (res.status === 429) {
        saw429 = true;
        expect(await res.text()).toBe("Too Many Requests");
        break;
      }
      expect(res.status).toBe(200);
    }

    expect(saw429).toBe(true);
    abort.abort();
  });

  it("bounds tracked webhook rate-limit keys", () => {
    clearTelegramWebhookRateLimits();
    const now = 1_000_000;
    for (let i = 0; i < 4_500; i += 1) {
      isTelegramWebhookRateLimited(`/telegram-webhook:key-${i}`, now);
    }
    expect(getTelegramWebhookRateLimitStateSize()).toBeLessThanOrEqual(4_096);
  });

  it("starts server, registers webhook, and serves health", async () => {
    createTelegramBotSpy.mockClear();
    webhookCallbackSpy.mockClear();
    const abort = new AbortController();
    const cfg = { bindings: [] };
    const { server } = await startTelegramWebhook({
      token: "tok",
      secret: "secret",
      accountId: "opie",
      config: cfg,
      port: 0, // random free port
      abortSignal: abort.signal,
    });
    expect(createTelegramBotSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "opie",
        config: expect.objectContaining({ bindings: [] }),
      }),
    );
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("no address");
    }
    const url = `http://127.0.0.1:${address.port}`;

    const health = await fetch(`${url}/healthz`);
    expect(health.status).toBe(200);
    expect(setWebhookSpy).toHaveBeenCalled();
    expect(webhookCallbackSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        api: expect.objectContaining({
          setWebhook: expect.any(Function),
        }),
      }),
      "http",
      {
        secretToken: "secret",
        onTimeout: "return",
        timeoutMilliseconds: 10_000,
      },
    );

    abort.abort();
  });

  it("invokes webhook handler on matching path", async () => {
    handlerSpy.mockClear();
    createTelegramBotSpy.mockClear();
    const abort = new AbortController();
    const cfg = { bindings: [] };
    const { server } = await startTelegramWebhook({
      token: "tok",
      secret: "secret",
      accountId: "opie",
      config: cfg,
      port: 0,
      abortSignal: abort.signal,
      path: "/hook",
    });
    expect(createTelegramBotSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "opie",
        config: expect.objectContaining({ bindings: [] }),
      }),
    );
    const addr = server.address();
    if (!addr || typeof addr === "string") {
      throw new Error("no addr");
    }
    await fetch(`http://127.0.0.1:${addr.port}/hook`, { method: "POST" });
    expect(handlerSpy).toHaveBeenCalled();
    abort.abort();
  });

  it("rejects startup when webhook secret is missing", async () => {
    await expect(
      startTelegramWebhook({
        token: "tok",
      }),
    ).rejects.toThrow(/requires a non-empty secret token/i);
  });
});
