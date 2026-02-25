import type { IncomingMessage } from "node:http";
import { setTimeout as sleep } from "node:timers/promises";
import { describe, expect, it, vi } from "vitest";
import { startTelegramWebhook } from "./webhook.js";

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

async function readRequestBodyWithShortTimeout(
  req: IncomingMessage,
  timeoutMs: number,
): Promise<string | null> {
  return await new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let settled = false;

    const cleanup = () => {
      req.removeListener("data", onData);
      req.removeListener("end", onEnd);
      req.removeListener("error", onError);
      req.removeListener("close", onClose);
      clearTimeout(timer);
    };

    const finish = (value: string | null) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(value);
    };

    const onData = (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    };

    const onEnd = () => {
      finish(Buffer.concat(chunks).toString("utf-8"));
    };

    const onError = () => {
      finish(null);
    };

    const onClose = () => {
      finish(null);
    };

    const timer = setTimeout(() => {
      finish(null);
    }, timeoutMs);

    req.on("data", onData);
    req.on("end", onEnd);
    req.on("error", onError);
    req.on("close", onClose);
  });
}

async function fetchWithTimeout(
  input: string,
  init: Omit<RequestInit, "signal">,
  timeoutMs: number,
): Promise<Response> {
  const abort = new AbortController();
  const timer = setTimeout(() => {
    abort.abort();
  }, timeoutMs);
  try {
    return await fetch(input, { ...init, signal: abort.signal });
  } finally {
    clearTimeout(timer);
  }
}

describe("startTelegramWebhook", () => {
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

  it("keeps webhook payload readable when callback delays body read", async () => {
    webhookCallbackSpy.mockImplementationOnce(() =>
      vi.fn(
        (
          _req: unknown,
          res: { writeHead: (status: number) => void; end: (body?: string) => void },
        ) => {
          const req = _req as IncomingMessage;
          // Simulates grammy startup work before it subscribes to req data events.
          void sleep(50).then(async () => {
            const raw = await readRequestBodyWithShortTimeout(req, 75);
            if (raw === null) {
              res.writeHead(500);
              res.end("missing-body");
              return;
            }
            res.writeHead(200);
            res.end(raw);
          });
        },
      ),
    );

    const abort = new AbortController();
    const { server } = await startTelegramWebhook({
      token: "tok",
      secret: "secret",
      port: 0,
      abortSignal: abort.signal,
      path: "/hook",
    });
    try {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        throw new Error("no addr");
      }

      const payload = JSON.stringify({ update_id: 1, message: { text: "hello" } });
      const res = await fetchWithTimeout(
        `http://127.0.0.1:${addr.port}/hook`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
        },
        5_000,
      );

      expect(res.status).toBe(200);
      await expect(res.text()).resolves.toBe(payload);
    } finally {
      abort.abort();
    }
  });

  it("keeps webhook payload readable across multiple delayed reads", async () => {
    const seenPayloads: string[] = [];
    webhookCallbackSpy.mockImplementationOnce(() =>
      vi.fn(
        (
          _req: unknown,
          res: { writeHead: (status: number) => void; end: (body?: string) => void },
        ) => {
          const req = _req as IncomingMessage;
          void sleep(50).then(async () => {
            const raw = await readRequestBodyWithShortTimeout(req, 75);
            if (raw === null) {
              res.writeHead(500);
              res.end("missing-body");
              return;
            }
            seenPayloads.push(raw);
            res.writeHead(200);
            res.end("ok");
          });
        },
      ),
    );

    const abort = new AbortController();
    const { server } = await startTelegramWebhook({
      token: "tok",
      secret: "secret",
      port: 0,
      abortSignal: abort.signal,
      path: "/hook",
    });
    try {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        throw new Error("no addr");
      }

      const payloads = [
        JSON.stringify({ update_id: 1, message: { text: "first" } }),
        JSON.stringify({ update_id: 2, message: { text: "second" } }),
      ];

      for (const payload of payloads) {
        const res = await fetchWithTimeout(
          `http://127.0.0.1:${addr.port}/hook`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
          },
          5_000,
        );
        expect(res.status).toBe(200);
      }

      expect(seenPayloads).toEqual(payloads);
    } finally {
      abort.abort();
    }
  });
});
