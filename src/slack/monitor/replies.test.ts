import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeEnv } from "../../runtime.js";

const emitMessageSentHookMock = vi.hoisted(() => vi.fn());
vi.mock("../../hooks/emit-message-sent.js", () => ({
  emitMessageSentHook: (...args: unknown[]) => emitMessageSentHookMock(...args),
}));

const sendMessageSlackMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("../send.js", () => ({
  sendMessageSlack: (...args: unknown[]) => sendMessageSlackMock(...args),
}));

import { deliverReplies } from "./replies.js";

describe("deliverReplies", () => {
  const runtime = { log: vi.fn(), error: vi.fn() } as unknown as RuntimeEnv;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("emits message:sent hook on successful text delivery", async () => {
    await deliverReplies({
      replies: [{ text: "hello slack" }],
      target: "C12345",
      token: "xoxb-test",
      accountId: "acct-1",
      runtime,
      textLimit: 4000,
      replyToMode: "off",
      sessionKey: "agent:main:main",
    });

    expect(sendMessageSlackMock).toHaveBeenCalledTimes(1);
    expect(emitMessageSentHookMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "C12345",
        content: "hello slack",
        success: true,
        channelId: "slack",
        accountId: "acct-1",
        sessionKey: "agent:main:main",
      }),
    );
  });

  it("emits message:sent failure hook when send throws", async () => {
    sendMessageSlackMock.mockRejectedValueOnce(new Error("slack_api_error"));

    await expect(
      deliverReplies({
        replies: [{ text: "will fail" }],
        target: "C99999",
        token: "xoxb-test",
        runtime,
        textLimit: 4000,
        replyToMode: "off",
        sessionKey: "sess-fail",
      }),
    ).rejects.toThrow("slack_api_error");

    expect(emitMessageSentHookMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "C99999",
        success: false,
        error: "slack_api_error",
        channelId: "slack",
      }),
    );
  });

  it("emits hook per media item on successful delivery", async () => {
    await deliverReplies({
      replies: [
        {
          text: "caption",
          mediaUrls: ["https://example.com/a.jpg", "https://example.com/b.jpg"],
        },
      ],
      target: "C12345",
      token: "xoxb-test",
      runtime,
      textLimit: 4000,
      replyToMode: "off",
      sessionKey: "sess-media",
    });

    expect(sendMessageSlackMock).toHaveBeenCalledTimes(2);
    expect(emitMessageSentHookMock).toHaveBeenCalledTimes(2);
    expect(emitMessageSentHookMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ content: "caption", success: true }),
    );
    expect(emitMessageSentHookMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ content: "https://example.com/b.jpg", success: true }),
    );
  });
});
