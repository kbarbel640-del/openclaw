import { EventEmitter } from "node:events";
import type { IncomingMessage } from "node:http";
import type { OpenClawConfig, PluginRuntime } from "openclaw/plugin-sdk";
import { describe, expect, it, vi } from "vitest";
import { createMockServerResponse } from "../../../src/test-utils/mock-http-response.js";
import type { ResolvedGoogleChatAccount } from "./accounts.js";
import { verifyGoogleChatRequest } from "./auth.js";
import {
  handleGoogleChatWebhookRequest,
  registerGoogleChatWebhookTarget,
  startGoogleChatMonitor,
} from "./monitor.js";
import { setGoogleChatRuntime } from "./runtime.js";

vi.mock("./auth.js", () => ({
  verifyGoogleChatRequest: vi.fn(),
}));

function createWebhookRequest(params: {
  authorization?: string;
  payload: unknown;
  path?: string;
}): IncomingMessage {
  const req = new EventEmitter() as IncomingMessage & {
    destroyed?: boolean;
    destroy: (error?: Error) => IncomingMessage;
  };
  req.method = "POST";
  req.url = params.path ?? "/googlechat";
  req.headers = {
    authorization: params.authorization ?? "",
    "content-type": "application/json",
  };
  req.destroyed = false;
  req.destroy = () => {
    req.destroyed = true;
    return req;
  };

  void Promise.resolve().then(() => {
    req.emit("data", Buffer.from(JSON.stringify(params.payload), "utf-8"));
    if (!req.destroyed) {
      req.emit("end");
    }
  });

  return req;
}

const baseAccount = (accountId: string) =>
  ({
    accountId,
    enabled: true,
    credentialSource: "none",
    config: {},
  }) as ResolvedGoogleChatAccount;

function registerTwoTargets() {
  const sinkA = vi.fn();
  const sinkB = vi.fn();
  const core = {} as PluginRuntime;
  const config = {} as OpenClawConfig;

  const unregisterA = registerGoogleChatWebhookTarget({
    account: baseAccount("A"),
    config,
    runtime: {},
    core,
    path: "/googlechat",
    statusSink: sinkA,
    mediaMaxMb: 5,
  });
  const unregisterB = registerGoogleChatWebhookTarget({
    account: baseAccount("B"),
    config,
    runtime: {},
    core,
    path: "/googlechat",
    statusSink: sinkB,
    mediaMaxMb: 5,
  });

  return {
    sinkA,
    sinkB,
    unregister: () => {
      unregisterA();
      unregisterB();
    },
  };
}

describe("Google Chat webhook routing", () => {
  it("keeps monitor registration alive until abort and unregisters on abort", async () => {
    vi.mocked(verifyGoogleChatRequest).mockResolvedValue({ ok: true });
    setGoogleChatRuntime({
      logging: { shouldLogVerbose: () => false },
    } as PluginRuntime);
    const abortController = new AbortController();
    let settled = false;

    const startPromise = startGoogleChatMonitor({
      account: baseAccount("A"),
      config: {} as OpenClawConfig,
      runtime: {},
      abortSignal: abortController.signal,
      webhookPath: "/googlechat",
    }).then(() => {
      settled = true;
    });

    await Promise.resolve();
    expect(settled).toBe(false);

    const beforeAbortRes = createMockServerResponse();
    const handledBeforeAbort = await handleGoogleChatWebhookRequest(
      createWebhookRequest({
        authorization: "Bearer test-token",
        payload: { type: "ADDED_TO_SPACE", space: { name: "spaces/AAA" } },
      }),
      beforeAbortRes,
    );

    expect(handledBeforeAbort).toBe(true);
    expect(beforeAbortRes.statusCode).toBe(200);

    abortController.abort();
    await startPromise;
    expect(settled).toBe(true);

    const afterAbortRes = createMockServerResponse();
    const handledAfterAbort = await handleGoogleChatWebhookRequest(
      createWebhookRequest({
        authorization: "Bearer test-token",
        payload: { type: "ADDED_TO_SPACE", space: { name: "spaces/AAA" } },
      }),
      afterAbortRes,
    );
    expect(handledAfterAbort).toBe(false);
  });

  it("rejects ambiguous routing when multiple targets on the same path verify successfully", async () => {
    vi.mocked(verifyGoogleChatRequest).mockResolvedValue({ ok: true });

    const { sinkA, sinkB, unregister } = registerTwoTargets();

    try {
      const res = createMockServerResponse();
      const handled = await handleGoogleChatWebhookRequest(
        createWebhookRequest({
          authorization: "Bearer test-token",
          payload: { type: "ADDED_TO_SPACE", space: { name: "spaces/AAA" } },
        }),
        res,
      );

      expect(handled).toBe(true);
      expect(res.statusCode).toBe(401);
      expect(sinkA).not.toHaveBeenCalled();
      expect(sinkB).not.toHaveBeenCalled();
    } finally {
      unregister();
    }
  });

  it("routes to the single verified target when earlier targets fail verification", async () => {
    vi.mocked(verifyGoogleChatRequest)
      .mockResolvedValueOnce({ ok: false, reason: "invalid" })
      .mockResolvedValueOnce({ ok: true });

    const { sinkA, sinkB, unregister } = registerTwoTargets();

    try {
      const res = createMockServerResponse();
      const handled = await handleGoogleChatWebhookRequest(
        createWebhookRequest({
          authorization: "Bearer test-token",
          payload: { type: "ADDED_TO_SPACE", space: { name: "spaces/BBB" } },
        }),
        res,
      );

      expect(handled).toBe(true);
      expect(res.statusCode).toBe(200);
      expect(sinkA).not.toHaveBeenCalled();
      expect(sinkB).toHaveBeenCalledTimes(1);
    } finally {
      unregister();
    }
  });

  it("logs verification reason when webhook auth fails", async () => {
    vi.mocked(verifyGoogleChatRequest).mockResolvedValue({
      ok: false,
      reason: "audience mismatch",
    });
    const error = vi.fn();
    const unregister = registerGoogleChatWebhookTarget({
      account: baseAccount("A"),
      config: {} as OpenClawConfig,
      runtime: { error },
      core: {} as PluginRuntime,
      path: "/googlechat",
      mediaMaxMb: 5,
    });

    try {
      const res = createMockServerResponse();
      const handled = await handleGoogleChatWebhookRequest(
        createWebhookRequest({
          authorization: "Bearer test-token",
          payload: { type: "ADDED_TO_SPACE", space: { name: "spaces/DDD" } },
        }),
        res,
      );
      expect(handled).toBe(true);
      expect(res.statusCode).toBe(401);
      expect(error).toHaveBeenCalledTimes(1);
      const logged = String(error.mock.calls[0]?.[0] ?? "");
      expect(logged).toContain("webhook auth failed");
      expect(logged).toContain("[A]");
      expect(logged).toContain("audience mismatch");
    } finally {
      unregister();
    }
  });

  it("replaces stale targets for the same account registration", async () => {
    vi.mocked(verifyGoogleChatRequest).mockResolvedValue({ ok: true });
    const sinkA = vi.fn();
    const sinkB = vi.fn();
    const core = {} as PluginRuntime;
    const config = {} as OpenClawConfig;

    const unregisterA = registerGoogleChatWebhookTarget({
      account: baseAccount("A"),
      config,
      runtime: {},
      core,
      path: "/googlechat",
      statusSink: sinkA,
      mediaMaxMb: 5,
    });
    const unregisterB = registerGoogleChatWebhookTarget({
      account: baseAccount("A"),
      config,
      runtime: {},
      core,
      path: "/googlechat",
      statusSink: sinkB,
      mediaMaxMb: 5,
    });

    try {
      const res = createMockServerResponse();
      const handled = await handleGoogleChatWebhookRequest(
        createWebhookRequest({
          authorization: "Bearer test-token",
          payload: { type: "ADDED_TO_SPACE", space: { name: "spaces/CCC" } },
        }),
        res,
      );
      expect(handled).toBe(true);
      expect(res.statusCode).toBe(200);
      expect(sinkA).not.toHaveBeenCalled();
      expect(sinkB).toHaveBeenCalledTimes(1);
    } finally {
      unregisterB();
      unregisterA();
    }
  });
});
