import { describe, expect, it, vi } from "vitest";
import { createReplyDispatcher, createReplyDispatcherWithTyping } from "./reply-dispatcher.js";

describe("createReplyDispatcher", () => {
  it("delivers replies in order", async () => {
    const delivered: string[] = [];
    const dispatcher = createReplyDispatcher({
      deliver: async (payload) => {
        delivered.push(`${payload.text}`);
      },
    });

    dispatcher.sendBlockReply({ text: "block1" });
    dispatcher.sendBlockReply({ text: "block2" });
    dispatcher.sendFinalReply({ text: "final" });
    await dispatcher.waitForIdle();

    expect(delivered).toEqual(["block1", "block2", "final"]);
  });

  it("calls onIdle when all deliveries complete", async () => {
    const onIdle = vi.fn();
    const dispatcher = createReplyDispatcher({
      deliver: async () => {},
      onIdle,
    });

    dispatcher.sendFinalReply({ text: "done" });
    await dispatcher.waitForIdle();

    expect(onIdle).toHaveBeenCalled();
  });

  it("tracks queued counts by kind", async () => {
    const dispatcher = createReplyDispatcher({
      deliver: async () => {},
    });

    dispatcher.sendToolResult({ text: "tool" });
    dispatcher.sendBlockReply({ text: "block" });
    dispatcher.sendFinalReply({ text: "final" });
    await dispatcher.waitForIdle();

    expect(dispatcher.getQueuedCounts()).toEqual({ tool: 1, block: 1, final: 1 });
  });

  it("calls onError when delivery throws", async () => {
    const onError = vi.fn();
    const dispatcher = createReplyDispatcher({
      deliver: async () => {
        throw new Error("delivery failed");
      },
      onError,
    });

    dispatcher.sendFinalReply({ text: "fail" });
    await dispatcher.waitForIdle();

    expect(onError).toHaveBeenCalledWith(expect.any(Error), { kind: "final" });
  });
});

describe("createReplyDispatcherWithTyping", () => {
  it("markDispatchIdle works when no typing controller is registered", () => {
    // Simulates the FULL smart ack path: createReplyDispatcherWithTyping is called
    // but dispatchInboundMessage (which registers the typing controller via
    // onTypingController) is never invoked. markDispatchIdle should not throw.
    const { markDispatchIdle } = createReplyDispatcherWithTyping({
      deliver: async () => {},
    });

    expect(() => markDispatchIdle()).not.toThrow();
  });

  it("markDispatchIdle notifies typing controller when registered", async () => {
    const { replyOptions, markDispatchIdle } = createReplyDispatcherWithTyping({
      deliver: async () => {},
    });

    // Simulate what get-reply.ts does: register the typing controller.
    const mockTyping = {
      onReplyStart: vi.fn(async () => {}),
      startTypingLoop: vi.fn(async () => {}),
      startTypingOnText: vi.fn(async () => {}),
      refreshTypingTtl: vi.fn(),
      isActive: vi.fn(() => true),
      markRunComplete: vi.fn(),
      markDispatchIdle: vi.fn(),
      cleanup: vi.fn(),
    };
    replyOptions.onTypingController?.(mockTyping);

    markDispatchIdle();

    expect(mockTyping.markDispatchIdle).toHaveBeenCalled();
  });

  it("dispatcher onIdle triggers typing controller markDispatchIdle", async () => {
    const { dispatcher, replyOptions } = createReplyDispatcherWithTyping({
      deliver: async () => {},
    });

    const mockTyping = {
      onReplyStart: vi.fn(async () => {}),
      startTypingLoop: vi.fn(async () => {}),
      startTypingOnText: vi.fn(async () => {}),
      refreshTypingTtl: vi.fn(),
      isActive: vi.fn(() => true),
      markRunComplete: vi.fn(),
      markDispatchIdle: vi.fn(),
      cleanup: vi.fn(),
    };
    replyOptions.onTypingController?.(mockTyping);

    dispatcher.sendFinalReply({ text: "done" });
    await dispatcher.waitForIdle();

    // The dispatcher's internal onIdle calls typingController.markDispatchIdle.
    expect(mockTyping.markDispatchIdle).toHaveBeenCalled();
  });
});
