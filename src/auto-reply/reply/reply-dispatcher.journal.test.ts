import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../infra/message-journal/outbound.js", () => ({
  enqueueDelivery: vi.fn(async () => "queue-1"),
  ackDelivery: vi.fn(async () => {}),
  failDelivery: vi.fn(async () => {}),
}));

const { createReplyDispatcher } = await import("./reply-dispatcher.js");
const { enqueueDelivery, ackDelivery, failDelivery } =
  await import("../../infra/message-journal/outbound.js");

describe("createReplyDispatcher journaling", () => {
  beforeEach(() => {
    vi.mocked(enqueueDelivery).mockClear().mockResolvedValue("queue-1");
    vi.mocked(ackDelivery).mockClear().mockResolvedValue();
    vi.mocked(failDelivery).mockClear().mockResolvedValue();
  });

  it("enqueues and acknowledges outbound rows when journal context is set", async () => {
    const deliver = vi.fn(async () => {});
    const dispatcher = createReplyDispatcher({ deliver });
    dispatcher.setDeliveryJournalContext?.({
      channel: "slack",
      to: "channel:C123",
      accountId: "work",
      threadId: "1739142736.000100",
      replyToId: "fallback-reply",
      inboundId: "turn-001",
    });

    dispatcher.sendFinalReply({ text: "hello world" });
    await dispatcher.waitForIdle();

    expect(enqueueDelivery).toHaveBeenCalledTimes(1);
    expect(enqueueDelivery).toHaveBeenCalledWith({
      channel: "slack",
      to: "channel:C123",
      accountId: "work",
      payloads: [{ text: "hello world" }],
      threadId: "1739142736.000100",
      replyToId: "fallback-reply",
      bestEffort: undefined,
      gifPlayback: undefined,
      silent: undefined,
      inboundId: "turn-001",
    });
    expect(ackDelivery).toHaveBeenCalledWith("queue-1");
    expect(failDelivery).not.toHaveBeenCalled();
  });

  it("fails queued outbound row when provider delivery throws", async () => {
    const onError = vi.fn();
    const dispatcher = createReplyDispatcher({
      deliver: async () => {
        throw new Error("send exploded");
      },
      onError,
    });
    dispatcher.setDeliveryJournalContext?.({
      channel: "discord",
      to: "channel:123",
      inboundId: "turn-002",
    });

    dispatcher.sendFinalReply({ text: "boom" });
    await dispatcher.waitForIdle();

    expect(enqueueDelivery).toHaveBeenCalledTimes(1);
    expect(failDelivery).toHaveBeenCalledWith("queue-1", "send exploded");
    expect(ackDelivery).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("prefers payload replyToId over fallback replyToId in journal rows", async () => {
    const dispatcher = createReplyDispatcher({
      deliver: async () => {},
    });
    dispatcher.setDeliveryJournalContext?.({
      channel: "telegram",
      to: "123456",
      replyToId: "fallback-reply",
      inboundId: "turn-003",
    });

    dispatcher.sendFinalReply({
      text: "reply",
      replyToId: "payload-reply",
    });
    await dispatcher.waitForIdle();

    expect(enqueueDelivery).toHaveBeenCalledTimes(1);
    expect(vi.mocked(enqueueDelivery).mock.calls[0]?.[0]?.replyToId).toBe("payload-reply");
  });
});
