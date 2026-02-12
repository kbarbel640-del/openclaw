import type { Bot } from "grammy";
import { GrammyError } from "grammy";
import { describe, expect, test, vi } from "vitest";
import { RuntimeEnv } from "../../runtime";
import { deliverReplies } from "./delivery";

describe("deliverReplies error handling", () => {
  const runtime: RuntimeEnv = {
    log: vi.fn(),
    error: vi.fn(),
  } as unknown as RuntimeEnv;

  const sendMessage = vi.fn();
  const mockBot = {
    api: {
      sendMessage,
      sendPhoto: vi.fn(),
      sendVideo: vi.fn(),
      sendAnimation: vi.fn(),
      sendDocument: vi.fn(),
      sendVoice: vi.fn(),
      sendAudio: vi.fn(),
      setMessageReaction: vi.fn(),
    },
  } as unknown as Bot;

  test("retries without message_thread_id on 'message thread not found' error", async () => {
    const threadId = 123;
    const chatId = "123456";
    const text = "Hello world";

    // Mock failure on first call (with thread ID)
    sendMessage.mockRejectedValueOnce(
      new GrammyError(
        "Bad Request: message thread not found",
        { ok: false, error_code: 400, description: "Bad Request: message thread not found" },
        "sendMessage",
        { chat_id: chatId, text, message_thread_id: threadId },
      ),
    );

    // Mock success on second call (fallback)
    sendMessage.mockResolvedValueOnce({ message_id: 999 });

    await deliverReplies({
      replies: [{ text }],
      chatId,
      token: "fake-token",
      runtime,
      bot: mockBot,
      replyToMode: "off",
      textLimit: 4096,
      thread: { id: threadId, scope: "forum" },
    });

    // Should have called sendMessage twice
    expect(sendMessage).toHaveBeenCalledTimes(2);

    // First call should include thread ID in the params object
    expect(sendMessage).toHaveBeenNthCalledWith(
      1,
      chatId,
      expect.any(String),
      expect.objectContaining({ message_thread_id: threadId }),
    );

    // Second call (retry) should NOT include thread ID in the params object
    expect(sendMessage).toHaveBeenNthCalledWith(
      2,
      chatId,
      expect.any(String),
      expect.not.objectContaining({ message_thread_id: threadId }),
    );

    // Should log the retry action
    expect(runtime.log).toHaveBeenCalledWith(
      expect.stringContaining("telegram thread not found; retrying to main chat"),
    );
  });
});
