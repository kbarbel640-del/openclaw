/**
 * Regression test for #14920: message tool send action drops replyToId
 *
 * The executeSendAction → sendMessage → deliverOutboundPayloads chain
 * must forward replyToId so thread replies work for channels that
 * support threading (e.g. Mattermost, Slack, Discord).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMessageSpy = vi.fn(async () => ({
  channel: "mattermost",
  to: "channel-123",
  via: "direct" as const,
  mediaUrl: null,
}));

vi.mock("./message.js", async () => {
  const actual = await vi.importActual<typeof import("./message.js")>("./message.js");
  return {
    ...actual,
    sendMessage: (...args: unknown[]) => sendMessageSpy(...args),
  };
});

vi.mock("../../channels/plugins/message-actions.js", () => ({
  dispatchChannelMessageAction: async () => null,
}));

vi.mock("../../config/sessions.js", () => ({
  appendAssistantMessageToSessionTranscript: async () => {},
}));

describe("executeSendAction replyToId passthrough (#14920)", () => {
  beforeEach(() => {
    sendMessageSpy.mockClear();
  });

  it("passes replyToId to sendMessage for thread replies", async () => {
    const { executeSendAction } = await import("./outbound-send-service.js");

    await executeSendAction({
      ctx: {
        cfg: {} as never,
        channel: "mattermost",
        params: {},
        dryRun: false,
      },
      to: "channel-123",
      message: "Hello thread",
      replyToId: "post-abc-123",
    });

    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    const callArgs = sendMessageSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(callArgs?.replyToId).toBe("post-abc-123");
  });

  it("omits replyToId when not provided", async () => {
    const { executeSendAction } = await import("./outbound-send-service.js");

    await executeSendAction({
      ctx: {
        cfg: {} as never,
        channel: "mattermost",
        params: {},
        dryRun: false,
      },
      to: "channel-123",
      message: "Hello root",
    });

    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    const callArgs = sendMessageSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(callArgs?.replyToId).toBeUndefined();
  });
});
