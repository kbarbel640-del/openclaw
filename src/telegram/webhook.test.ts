import { createHash } from "node:crypto";
import { once } from "node:events";
import { request } from "node:http";
import type { IncomingMessage } from "node:http";
import { setTimeout as sleep } from "node:timers/promises";
import { describe, expect, it, vi } from "vitest";
import { startTelegramWebhook } from "./webhook.js";

const realWebhookCallbackRef = vi.hoisted(() => ({
  fn: null as null | (typeof import("grammy"))["webhookCallback"],
}));
const handlerSpy = vi.hoisted(() =>
  vi.fn(
    (_req: unknown, res: { writeHead: (status: number) => void; end: (body?: string) => void }) => {
      res.writeHead(200);
      res.end("ok");
    },
  ),
);
const setWebhookSpy = vi.hoisted(() => vi.fn());
const initSpy = vi.hoisted(() => vi.fn(async () => undefined));
const stopSpy = vi.hoisted(() => vi.fn());
const webhookCallbackSpy = vi.hoisted(() => vi.fn(() => handlerSpy));
const createTelegramBotSpy = vi.hoisted(() =>
  vi.fn(() => ({
    init: initSpy,
    api: { setWebhook: setWebhookSpy },
    stop: stopSpy,
  })),
);

vi.mock("grammy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("grammy")>();
  realWebhookCallbackRef.fn = actual.webhookCallback;
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

function installFirstLossThenRealGrammyCallbackOnce() {
  webhookCallbackSpy.mockImplementationOnce((...args: unknown[]) => {
    const realWebhookFactory = realWebhookCallbackRef.fn as
      | ((...factoryArgs: unknown[]) => (...handlerArgs: unknown[]) => unknown)
      | null;
    if (!realWebhookFactory) {
      throw new Error("real webhook callback unavailable");
    }
    const realHandler = realWebhookFactory(...args);
    let requestCount = 0;
    return vi.fn((...handlerArgs: unknown[]) => {
      requestCount += 1;
      if (requestCount === 1) {
        const req = handlerArgs[0] as IncomingMessage;
        const res = handlerArgs[1] as {
          writeHead: (status: number) => void;
          end: (body?: string) => void;
        };
        // Mirror startup behavior where body reader attaches too late.
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
        return;
      }
      return realHandler(...handlerArgs);
    });
  });
}

function installDelayedBodyCaptureCallbackOnce(capturedBodies: string[]) {
  webhookCallbackSpy.mockImplementationOnce(() =>
    vi.fn(
      (
        _req: unknown,
        res: {
          writeHead: (status: number) => void;
          end: (body?: string) => void;
        },
      ) => {
        const req = _req as IncomingMessage;
        void sleep(50).then(async () => {
          const raw = await readRequestBodyWithShortTimeout(req, 8_000);
          if (raw === null) {
            res.writeHead(500);
            res.end("missing-body");
            return;
          }
          capturedBodies.push(raw);
          res.writeHead(200);
          res.end("ok");
        });
      },
    ),
  );
}

function createDeterministicRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}

async function postWebhookPayloadWithChunkPlan(params: {
  port: number;
  path: string;
  payload: string;
  secret: string;
  mode: "single" | "random-chunked";
  timeoutMs?: number;
}): Promise<{ statusCode: number; body: string }> {
  const payloadBuffer = Buffer.from(params.payload, "utf-8");
  return await new Promise((resolve, reject) => {
    let settled = false;
    const finishResolve = (value: { statusCode: number; body: string }) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      resolve(value);
    };
    const finishReject = (error: unknown) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      reject(error);
    };

    const req = request(
      {
        hostname: "127.0.0.1",
        port: params.port,
        path: params.path,
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": String(payloadBuffer.length),
          "x-telegram-bot-api-secret-token": params.secret,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer | string) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        res.on("end", () => {
          finishResolve({
            statusCode: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf-8"),
          });
        });
      },
    );

    const timeout = setTimeout(() => {
      finishReject(new Error(`webhook post timed out after ${params.timeoutMs ?? 15_000}ms`));
      req.destroy();
    }, params.timeoutMs ?? 15_000);

    req.on("error", (error) => {
      finishReject(error);
    });

    const writeAll = async () => {
      if (params.mode === "single") {
        req.end(payloadBuffer);
        return;
      }

      const rng = createDeterministicRng(26156);
      let offset = 0;
      let chunkCount = 0;
      while (offset < payloadBuffer.length) {
        const remaining = payloadBuffer.length - offset;
        const nextSize = Math.max(1, Math.min(remaining, 1 + Math.floor(rng() * 8_192)));
        const chunk = payloadBuffer.subarray(offset, offset + nextSize);
        const canContinue = req.write(chunk);
        offset += nextSize;
        chunkCount += 1;
        if (chunkCount % 10 === 0) {
          await sleep(1 + Math.floor(rng() * 3));
        }
        if (!canContinue) {
          await once(req, "drain");
        }
      }
      req.end();
    };

    void writeAll().catch((error) => {
      finishReject(error);
    });
  });
}

function createNearLimitTelegramPayload(): { payload: string; sizeBytes: number } {
  const maxBytes = 1_024 * 1_024;
  const targetBytes = maxBytes - 4_096;
  const shell = { update_id: 77_777, message: { text: "" } };
  const shellSize = Buffer.byteLength(JSON.stringify(shell), "utf-8");
  const textLength = Math.max(1, targetBytes - shellSize);
  const pattern = "the quick brown fox jumps over the lazy dog ";
  const repeats = Math.ceil(textLength / pattern.length);
  const text = pattern.repeat(repeats).slice(0, textLength);
  const payload = JSON.stringify({
    update_id: 77_777,
    message: { text },
  });
  return { payload, sizeBytes: Buffer.byteLength(payload, "utf-8") };
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

describe("startTelegramWebhook", () => {
  it("starts server, registers webhook, and serves health", async () => {
    initSpy.mockClear();
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
    expect(initSpy).toHaveBeenCalledTimes(1);
    expect(setWebhookSpy).toHaveBeenCalled();
    expect(webhookCallbackSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        api: expect.objectContaining({
          setWebhook: expect.any(Function),
        }),
      }),
      "callback",
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

  it("processes a second request after first-request delayed-init data loss", async () => {
    installFirstLossThenRealGrammyCallbackOnce();
    const seenUpdates: unknown[] = [];
    createTelegramBotSpy.mockImplementationOnce(() => ({
      api: { setWebhook: setWebhookSpy },
      stop: stopSpy,
      isRunning: () => false,
      init: vi.fn(async () => undefined),
      handleUpdate: vi.fn(async (update: unknown) => {
        seenUpdates.push(update);
      }),
    }));

    const secret = "secret";
    const abort = new AbortController();
    const { server } = await startTelegramWebhook({
      token: "tok",
      secret,
      port: 0,
      abortSignal: abort.signal,
      path: "/hook",
    });

    try {
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("no addr");
      }

      const firstPayload = JSON.stringify({ update_id: 100, message: { text: "first" } });
      const secondPayload = JSON.stringify({ update_id: 101, message: { text: "second" } });
      const firstResponse = await postWebhookPayloadWithChunkPlan({
        port: address.port,
        path: "/hook",
        payload: firstPayload,
        secret,
        mode: "single",
        timeoutMs: 8_000,
      });
      const secondResponse = await postWebhookPayloadWithChunkPlan({
        port: address.port,
        path: "/hook",
        payload: secondPayload,
        secret,
        mode: "single",
        timeoutMs: 8_000,
      });

      // if we fix the bug, the first response will be a 200 not a 500
      expect(firstResponse.statusCode).toBeOneOf([200, 500]);
      expect(secondResponse.statusCode).toBe(200);
      expect(seenUpdates).toEqual([JSON.parse(secondPayload)]);
    } finally {
      abort.abort();
    }
  });

  it("handles near-limit payload with random chunk writes and event-loop yields", async () => {
    const capturedBodies: string[] = [];
    installDelayedBodyCaptureCallbackOnce(capturedBodies);

    const { payload, sizeBytes } = createNearLimitTelegramPayload();
    expect(sizeBytes).toBeLessThan(1_024 * 1_024);
    expect(sizeBytes).toBeGreaterThan(256 * 1_024);

    const secret = "secret";
    const abort = new AbortController();
    const { server } = await startTelegramWebhook({
      token: "tok",
      secret,
      port: 0,
      abortSignal: abort.signal,
      path: "/hook",
    });

    try {
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("no addr");
      }

      const response = await postWebhookPayloadWithChunkPlan({
        port: address.port,
        path: "/hook",
        payload,
        secret,
        mode: "random-chunked",
        timeoutMs: 8_000,
      });

      expect(response.statusCode).toBe(200);
      expect(capturedBodies).toHaveLength(1);
      expect(capturedBodies[0]?.length).toBe(payload.length);
      expect(sha256(capturedBodies[0] ?? "")).toBe(sha256(payload));
    } finally {
      abort.abort();
    }
  });

  it("handles near-limit payload written in a single request write", async () => {
    const capturedBodies: string[] = [];
    installDelayedBodyCaptureCallbackOnce(capturedBodies);

    const { payload, sizeBytes } = createNearLimitTelegramPayload();
    expect(sizeBytes).toBeLessThan(1_024 * 1_024);
    expect(sizeBytes).toBeGreaterThan(256 * 1_024);

    const secret = "secret";
    const abort = new AbortController();
    const { server } = await startTelegramWebhook({
      token: "tok",
      secret,
      port: 0,
      abortSignal: abort.signal,
      path: "/hook",
    });

    try {
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("no addr");
      }

      const response = await postWebhookPayloadWithChunkPlan({
        port: address.port,
        path: "/hook",
        payload,
        secret,
        mode: "single",
        timeoutMs: 8_000,
      });

      expect(response.statusCode).toBe(200);
      expect(capturedBodies).toHaveLength(1);
      expect(capturedBodies[0]?.length).toBe(payload.length);
      expect(sha256(capturedBodies[0] ?? "")).toBe(sha256(payload));
    } finally {
      abort.abort();
    }
  });

  it("rejects payloads larger than 1MB before invoking webhook handler", async () => {
    handlerSpy.mockClear();
    const abort = new AbortController();
    const { server } = await startTelegramWebhook({
      token: "tok",
      secret: "secret",
      port: 0,
      abortSignal: abort.signal,
      path: "/hook",
    });

    try {
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("no addr");
      }

      const oversizedText = "x".repeat(1_024 * 1_024 + 2_048);
      const payload = JSON.stringify({ update_id: 999_001, message: { text: oversizedText } });
      const response = await fetchWithTimeout(
        `http://127.0.0.1:${address.port}/hook`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-telegram-bot-api-secret-token": "secret",
          },
          body: payload,
        },
        8_000,
      );
      const responseText = await response.text();

      expect(response.status).toBe(413);
      expect(responseText).toBe("Payload too large");
      expect(handlerSpy).not.toHaveBeenCalled();
    } finally {
      abort.abort();
    }
  });
});
