import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";
import type { ReplyPayload } from "../types.js";
import type { ReplyDispatcher } from "./reply-dispatcher.js";
import { SessionStoreLockTimeoutError } from "../../config/sessions/store.js";
import { buildTestCtx } from "./test-ctx.js";

const mocks = vi.hoisted(() => ({
  routeReply: vi.fn(async () => ({ ok: true, messageId: "mock" })),
  tryFastAbortFromMessage: vi.fn(async () => ({
    handled: false,
    aborted: false,
  })),
}));
const diagnosticMocks = vi.hoisted(() => ({
  logMessageQueued: vi.fn(),
  logMessageProcessed: vi.fn(),
  logSessionStateChange: vi.fn(),
}));
const hookMocks = vi.hoisted(() => ({
  runner: {
    hasHooks: vi.fn(() => false),
    runMessageReceived: vi.fn(async () => {}),
  },
}));

vi.mock("./route-reply.js", () => ({
  isRoutableChannel: (channel: string | undefined) =>
    Boolean(
      channel &&
      ["telegram", "slack", "discord", "signal", "imessage", "whatsapp"].includes(channel),
    ),
  routeReply: mocks.routeReply,
}));

vi.mock("./abort.js", () => ({
  tryFastAbortFromMessage: mocks.tryFastAbortFromMessage,
  formatAbortReplyText: () => "⚙️ Agent was aborted.",
}));

vi.mock("../../logging/diagnostic.js", () => ({
  logMessageQueued: diagnosticMocks.logMessageQueued,
  logMessageProcessed: diagnosticMocks.logMessageProcessed,
  logSessionStateChange: diagnosticMocks.logSessionStateChange,
}));

vi.mock("../../plugins/hook-runner-global.js", () => ({
  getGlobalHookRunner: () => hookMocks.runner,
}));

const { dispatchReplyFromConfig } = await import("./dispatch-from-config.js");
const { resetInboundDedupe } = await import("./inbound-dedupe.js");

function createDispatcher(): ReplyDispatcher & {
  sendFinalReply: ReturnType<typeof vi.fn>;
  waitForIdle: ReturnType<typeof vi.fn>;
  getQueuedCounts: ReturnType<typeof vi.fn>;
} {
  return {
    sendToolResult: vi.fn(() => true),
    sendBlockReply: vi.fn(() => true),
    sendFinalReply: vi.fn(() => true),
    waitForIdle: vi.fn(async () => {}),
    getQueuedCounts: vi.fn(() => ({ tool: 0, block: 0, final: 0 })),
  };
}

describe("dispatchReplyFromConfig - SessionStoreLockTimeoutError handling", () => {
  beforeEach(() => {
    resetInboundDedupe();
    diagnosticMocks.logMessageQueued.mockReset();
    diagnosticMocks.logMessageProcessed.mockReset();
    diagnosticMocks.logSessionStateChange.mockReset();
    hookMocks.runner.hasHooks.mockReset();
    hookMocks.runner.hasHooks.mockReturnValue(false);
    hookMocks.runner.runMessageReceived.mockReset();
    mocks.routeReply.mockReset();
    mocks.routeReply.mockResolvedValue({ ok: true, messageId: "mock" });
    mocks.tryFastAbortFromMessage.mockReset();
    mocks.tryFastAbortFromMessage.mockResolvedValue({ handled: false, aborted: false });
  });

  it("sends error reply via dispatcher when SessionStoreLockTimeoutError is thrown", async () => {
    const ctx = buildTestCtx({
      Body: "hello",
      From: "telegram:123",
      To: "telegram:bot",
      Provider: "telegram",
      Surface: "telegram",
      MessageSid: "msg-lock-1",
    });
    const cfg = {} as OpenClawConfig;
    const dispatcher = createDispatcher();

    // Simulate the reply resolver throwing a SessionStoreLockTimeoutError
    const replyResolver = vi.fn(async () => {
      throw new SessionStoreLockTimeoutError("/tmp/sessions.json.lock", 30000);
    });

    const result = await dispatchReplyFromConfig({
      ctx,
      cfg,
      dispatcher,
      replyResolver,
    });

    // Should have sent a final reply with the contention error message
    expect(dispatcher.sendFinalReply).toHaveBeenCalledTimes(1);
    const sentPayload = dispatcher.sendFinalReply.mock.calls[0][0] as ReplyPayload;
    expect(sentPayload.text).toContain("could not be processed");
    expect(sentPayload.text).toContain("contention");
    expect(result.queuedFinal).toBe(true);
  });

  it("does not re-throw SessionStoreLockTimeoutError after sending error reply", async () => {
    const ctx = buildTestCtx({
      Body: "hello",
      From: "telegram:123",
      To: "telegram:bot",
      Provider: "telegram",
      Surface: "telegram",
      MessageSid: "msg-lock-2",
    });
    const cfg = {} as OpenClawConfig;
    const dispatcher = createDispatcher();
    const replyResolver = vi.fn(async () => {
      throw new SessionStoreLockTimeoutError("/tmp/sessions.json.lock", 30000);
    });

    // Should NOT throw — the error is caught and a reply is sent instead
    await expect(
      dispatchReplyFromConfig({ ctx, cfg, dispatcher, replyResolver }),
    ).resolves.toBeDefined();
  });

  it("still throws non-lock-timeout errors", async () => {
    const ctx = buildTestCtx({
      Body: "hello",
      From: "telegram:123",
      To: "telegram:bot",
      Provider: "telegram",
      Surface: "telegram",
      MessageSid: "msg-lock-3",
    });
    const cfg = {} as OpenClawConfig;
    const dispatcher = createDispatcher();
    const replyResolver = vi.fn(async () => {
      throw new Error("some other error");
    });

    await expect(dispatchReplyFromConfig({ ctx, cfg, dispatcher, replyResolver })).rejects.toThrow(
      "some other error",
    );
  });

  it("routes error reply to originating channel when cross-provider", async () => {
    const ctx = buildTestCtx({
      Body: "hello",
      From: "user@slack",
      To: "bot@slack",
      Provider: "whatsapp",
      Surface: "whatsapp",
      OriginatingChannel: "telegram",
      OriginatingTo: "telegram:chatid",
      MessageSid: "msg-lock-4",
    });
    const cfg = {} as OpenClawConfig;
    const dispatcher = createDispatcher();
    const replyResolver = vi.fn(async () => {
      throw new SessionStoreLockTimeoutError("/tmp/sessions.json.lock", 30000);
    });

    await dispatchReplyFromConfig({ ctx, cfg, dispatcher, replyResolver });

    // Should route via routeReply, not dispatcher.sendFinalReply
    expect(mocks.routeReply).toHaveBeenCalledTimes(1);
    const routeCall = mocks.routeReply.mock.calls[0][0] as { payload: ReplyPayload };
    expect(routeCall.payload.text).toContain("could not be processed");
  });

  it("records diagnostic event as error", async () => {
    const ctx = buildTestCtx({
      Body: "hello",
      From: "telegram:123",
      To: "telegram:bot",
      Provider: "telegram",
      Surface: "telegram",
      MessageSid: "msg-lock-5",
    });
    const cfg = { diagnostics: { enabled: true } } as unknown as OpenClawConfig;
    const dispatcher = createDispatcher();
    const replyResolver = vi.fn(async () => {
      throw new SessionStoreLockTimeoutError("/tmp/sessions.json.lock", 30000);
    });

    await dispatchReplyFromConfig({ ctx, cfg, dispatcher, replyResolver });

    expect(diagnosticMocks.logMessageProcessed).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "error",
      }),
    );
  });
});
