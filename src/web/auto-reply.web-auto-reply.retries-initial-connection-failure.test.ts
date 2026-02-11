import "./test-helpers.js";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../agents/pi-embedded.js", () => ({
  abortEmbeddedPiRun: vi.fn().mockReturnValue(false),
  isEmbeddedPiRunActive: vi.fn().mockReturnValue(false),
  isEmbeddedPiRunStreaming: vi.fn().mockReturnValue(false),
  runEmbeddedPiAgent: vi.fn(),
  queueEmbeddedPiMessage: vi.fn().mockReturnValue(false),
  resolveEmbeddedSessionLane: (key: string) => `session:${key.trim() || "main"}`,
}));

import { resetInboundDedupe } from "../auto-reply/reply/inbound-dedupe.js";
import { resetLogger, setLoggerOverride } from "../logging.js";
import { monitorWebChannel } from "./auto-reply.js";
import { resetBaileysMocks, resetLoadConfigMock } from "./test-helpers.js";

let previousHome: string | undefined;
let tempHome: string | undefined;

beforeEach(async () => {
  resetInboundDedupe();
  previousHome = process.env.HOME;
  tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-web-home-"));
  process.env.HOME = tempHome;
});

afterEach(async () => {
  process.env.HOME = previousHome;
  if (tempHome) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        await fs.rm(tempHome, { recursive: true, force: true });
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    }
    tempHome = undefined;
  }
});

describe("web auto-reply", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBaileysMocks();
    resetLoadConfigMock();
  });

  afterEach(() => {
    resetLogger();
    setLoggerOverride(null);
    vi.useRealTimers();
  });

  it("retries when initial connection fails (e.g. DNS error)", async () => {
    let callCount = 0;
    const sleep = vi.fn(async () => {});
    const listenerFactory = vi.fn(async () => {
      callCount += 1;
      if (callCount <= 2) {
        throw new Error("getaddrinfo ENOTFOUND web.whatsapp.com");
      }
      // Third attempt succeeds
      const onClose = new Promise<void>(() => {});
      return { close: vi.fn(), onClose };
    });
    const runtime = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn(),
    };
    const controller = new AbortController();
    const run = monitorWebChannel(
      false,
      listenerFactory,
      true,
      async () => ({ text: "ok" }),
      runtime as never,
      controller.signal,
      {
        heartbeatSeconds: 1,
        reconnect: { initialMs: 5, maxMs: 5, maxAttempts: 5, factor: 1.1 },
        sleep,
      },
    );

    // Wait for retries to happen
    const waitForThirdCall = async () => {
      const started = Date.now();
      while (listenerFactory.mock.calls.length < 3 && Date.now() - started < 2000) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    };
    await waitForThirdCall();

    expect(listenerFactory).toHaveBeenCalledTimes(3);
    // sleep was called for the 2 failed attempts
    expect(sleep).toHaveBeenCalledTimes(2);
    // Error messages logged for failed attempts
    expect(runtime.error).toHaveBeenCalledWith(
      expect.stringContaining("initial connection failed"),
    );

    controller.abort();
    await new Promise((resolve) => setTimeout(resolve, 10));
    await run;
  });

  it("stops after max attempts on initial connection failure", { timeout: 30_000 }, async () => {
    const sleep = vi.fn(async () => {});
    const listenerFactory = vi.fn(async () => {
      throw new Error("getaddrinfo ENOTFOUND web.whatsapp.com");
    });
    const runtime = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn(),
    };

    const run = monitorWebChannel(
      false,
      listenerFactory,
      true,
      async () => ({ text: "ok" }),
      runtime as never,
      undefined,
      {
        heartbeatSeconds: 1,
        reconnect: { initialMs: 5, maxMs: 5, maxAttempts: 2, factor: 1.1 },
        sleep,
      },
    );

    await run;

    // Attempted 2 times then stopped
    expect(listenerFactory).toHaveBeenCalledTimes(2);
    expect(runtime.error).toHaveBeenCalledWith(
      expect.stringContaining("initial connection failed after"),
    );
  });
});
