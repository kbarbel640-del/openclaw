import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ollamaFetch } from "./ollama-retry.js";

function okResponse(body = "ok") {
  return new Response(body, { status: 200 });
}

function connRefusedError(): TypeError {
  const cause = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:11434"), {
    code: "ECONNREFUSED",
    errno: "ECONNREFUSED",
  });
  return new TypeError("fetch failed", { cause });
}

function timeoutError(): DOMException {
  return new DOMException("The operation was aborted due to timeout", "TimeoutError");
}

describe("ollamaFetch", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("succeeds on first try with no retries", async () => {
    const mock = vi.fn().mockResolvedValueOnce(okResponse());
    globalThis.fetch = mock as any;

    const res = await ollamaFetch("http://localhost:11434/api/chat", undefined, {
      retries: 3,
      retryDelayMs: 1,
    });
    expect(res.status).toBe(200);
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("retries on ECONNREFUSED then succeeds", async () => {
    const mock = vi
      .fn()
      .mockRejectedValueOnce(connRefusedError())
      .mockResolvedValueOnce(okResponse());
    globalThis.fetch = mock as any;

    const res = await ollamaFetch("http://localhost:11434/api/chat", undefined, {
      retries: 3,
      retryDelayMs: 1,
    });
    expect(res.status).toBe(200);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it("retries on 503 then succeeds", async () => {
    const mock = vi
      .fn()
      .mockResolvedValueOnce(new Response("model loading", { status: 503 }))
      .mockResolvedValueOnce(okResponse());
    globalThis.fetch = mock as any;

    const res = await ollamaFetch("http://localhost:11434/api/chat", undefined, {
      retries: 3,
      retryDelayMs: 1,
    });
    expect(res.status).toBe(200);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it("throws after all retries exhausted", async () => {
    const mock = vi
      .fn()
      .mockRejectedValueOnce(connRefusedError())
      .mockRejectedValueOnce(connRefusedError())
      .mockRejectedValueOnce(connRefusedError())
      .mockRejectedValueOnce(connRefusedError());
    globalThis.fetch = mock as any;

    await expect(
      ollamaFetch("http://localhost:11434/api/chat", undefined, {
        retries: 3,
        retryDelayMs: 1,
      }),
    ).rejects.toThrow("ECONNREFUSED");
    expect(mock).toHaveBeenCalledTimes(4);
  });

  it("does not retry on 400 error", async () => {
    const mock = vi.fn().mockResolvedValueOnce(new Response("bad request", { status: 400 }));
    globalThis.fetch = mock as any;

    await expect(
      ollamaFetch("http://localhost:11434/api/chat", undefined, {
        retries: 3,
        retryDelayMs: 1,
      }),
    ).rejects.toThrow("Ollama API error 400");
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("does not retry on timeout", async () => {
    const mock = vi.fn().mockRejectedValueOnce(timeoutError());
    globalThis.fetch = mock as any;

    await expect(
      ollamaFetch("http://localhost:11434/api/chat", undefined, {
        retries: 3,
        retryDelayMs: 1,
        timeoutMs: 100,
      }),
    ).rejects.toThrow("timeout");
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("calls onRetry with correct attempt number", async () => {
    const onRetry = vi.fn();
    const mock = vi
      .fn()
      .mockRejectedValueOnce(connRefusedError())
      .mockRejectedValueOnce(connRefusedError())
      .mockResolvedValueOnce(okResponse());
    globalThis.fetch = mock as any;

    await ollamaFetch("http://localhost:11434/api/chat", undefined, {
      retries: 3,
      retryDelayMs: 1,
      onRetry,
    });

    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenNthCalledWith(1, 1, expect.any(Error));
    expect(onRetry).toHaveBeenNthCalledWith(2, 2, expect.any(Error));
  });

  it("respects max retries config", async () => {
    const mock = vi
      .fn()
      .mockRejectedValueOnce(connRefusedError())
      .mockRejectedValueOnce(connRefusedError());
    globalThis.fetch = mock as any;

    await expect(
      ollamaFetch("http://localhost:11434/api/chat", undefined, {
        retries: 1,
        retryDelayMs: 1,
      }),
    ).rejects.toThrow("ECONNREFUSED");
    expect(mock).toHaveBeenCalledTimes(2);
  });
});
