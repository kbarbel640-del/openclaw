import type { Context } from "grammy";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  askChoice,
  handleQuestionCallback,
  handleQuestionTextReply,
} from "../../src/telegram/interactive-question";
import { sendMessageTelegram, editMessageTelegram } from "../../src/telegram/send";

// Mock dependencies
vi.mock("../../src/telegram/config/config", () => ({
  loadConfig: vi.fn().mockReturnValue({}),
}));

vi.mock("../../src/telegram/send", () => ({
  sendMessageTelegram: vi.fn(),
  editMessageTelegram: vi.fn(),
  deleteMessageTelegram: vi.fn(),
}));

describe("tg-interactive-question", () => {
  const mockChatId = "123456";
  const mockQuestion = "What is your favorite color?";
  const mockChoices = [
    { label: "Red", value: "red" },
    { label: "Blue", value: "blue" },
  ];
  const mockSentMessageId = "999";
  const mockSendMessageTelegram = vi.mocked(sendMessageTelegram);
  const mockEditMessageTelegram = vi.mocked(editMessageTelegram);

  beforeEach(() => {
    vi.clearAllMocks();
    mockSendMessageTelegram.mockResolvedValue({
      messageId: mockSentMessageId,
      chatId: mockChatId,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should send a question with buttons", async () => {
    const promise = askChoice({
      chatId: mockChatId,
      question: mockQuestion,
      choices: mockChoices,
    });

    // Use waitFor or similar to ensure sendMessage was called before proceeding?
    // But sendMessageTelegram is mocked to resolve immediately.
    // So promise is pending.

    // Wait a tick to let askChoice execute until await
    await new Promise<void>((resolve) => process.nextTick(() => resolve()));

    expect(sendMessageTelegram).toHaveBeenCalledWith(
      mockChatId,
      mockQuestion,
      expect.objectContaining({
        buttons: expect.any(Array),
      }),
    );

    // ... rest of test ...
    // We need to answer the callback to resolve the promise.
    const callArgs = mockSendMessageTelegram.mock.calls[0];
    const buttons = callArgs[2].buttons[0];
    const callbackData = buttons[0].callback_data;
    const mockCtx = {
      callbackQuery: {
        data: callbackData,
        message: { chat: { id: mockChatId }, message_id: 999 },
      },
      answerCallbackQuery: vi.fn(),
    } as unknown as Context;

    mockEditMessageTelegram.mockResolvedValue({ ok: true }); // Ensure editMessageTelegram returns promise

    const handled = await handleQuestionCallback(mockCtx);
    expect(handled).toBe(true);

    const result = await promise;
    expect(result).toEqual({
      kind: "choice",
      value: "red",
      raw: "Red",
      messageId: "999",
    });
  });

  it("should handle text reply", async () => {
    const promise = askChoice({
      chatId: mockChatId,
      question: mockQuestion,
      choices: mockChoices,
      allowText: true,
    });

    await new Promise<void>((resolve) => process.nextTick(() => resolve()));

    const mockCtx = {
      message: {
        chat: { id: mockChatId },
        text: "My own answer",
        message_id: 1001,
      },
    } as unknown as Context;

    mockEditMessageTelegram.mockResolvedValue({ ok: true }); // Ensure editMessageTelegram returns promise

    const handled = await handleQuestionTextReply(mockCtx);
    expect(handled).toBe(true);

    const result = await promise;
    expect(result).toEqual({
      kind: "text",
      value: "My own answer",
      raw: "My own answer",
      messageId: "1001",
    });
  });

  it("should timeout correctly", async () => {
    vi.useFakeTimers();
    const promise = askChoice({
      chatId: mockChatId,
      question: mockQuestion,
      choices: mockChoices,
      timeoutMs: 5000,
    });

    await new Promise<void>((resolve) => process.nextTick(() => resolve()));

    vi.advanceTimersByTime(6000);

    const result = await promise;
    expect(result).toEqual({ kind: "timeout", value: null, raw: null });
  });
});
