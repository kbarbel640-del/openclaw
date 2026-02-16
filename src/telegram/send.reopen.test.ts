import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendMessageTelegram } from "./send.js";
import { resolveTelegramAccount } from "./accounts.js";

// Mock dependencies
vi.mock("./accounts.js", () => ({
  resolveTelegramAccount: vi.fn().mockReturnValue({ accountId: "default" }),
}));
vi.mock("./targets.js", () => ({
  parseTelegramTarget: vi.fn().mockReturnValue({ chatId: "123", messageThreadId: 456 }),
  stripTelegramInternalPrefixes: vi.fn((s) => s),
}));
vi.mock("../config/config.js", () => ({
  loadConfig: vi.fn().mockReturnValue({}),
}));
vi.mock("./fetch.js", () => ({
  resolveTelegramFetch: vi.fn().mockReturnValue(undefined),
}));

// Mock grammy Bot
const mockApi = {
  sendMessage: vi.fn(),
  reopenForumTopic: vi.fn(),
};

vi.mock("grammy", () => ({
  Bot: vi.fn(() => ({
    api: mockApi,
  })),
  InputFile: vi.fn(),
  HttpError: class extends Error {
    constructor(msg: string) {
      super(msg);
    }
  },
}));

describe("sendMessageTelegram topic reopening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("attempts to reopen topic and retry if sendMessage fails with TOPIC_CLOSED", async () => {
    // First call fails with TOPIC_CLOSED
    mockApi.sendMessage.mockRejectedValueOnce(new Error("400: Bad Request: topic closed"));
    // Reopen succeeds
    mockApi.reopenForumTopic.mockResolvedValueOnce(true);
    // Retry succeeds
    mockApi.sendMessage.mockResolvedValueOnce({ message_id: 999, chat: { id: 123 } });

    await sendMessageTelegram("123", "test", {
      messageThreadId: 456,
      token: "mock-token",
    });

    expect(mockApi.reopenForumTopic).toHaveBeenCalledWith("123", 456);
    expect(mockApi.sendMessage).toHaveBeenCalledTimes(2);
  });

  it("falls back to throwing if reopen fails", async () => {
    mockApi.sendMessage.mockRejectedValueOnce(new Error("400: Bad Request: topic closed"));
    mockApi.reopenForumTopic.mockRejectedValueOnce(new Error("400: Bad Request: topic closed")); // Reopen fails too

    await expect(
      sendMessageTelegram("123", "test", {
        messageThreadId: 456,
        token: "mock-token",
      }),
    ).rejects.toThrow("topic closed");

    expect(mockApi.reopenForumTopic).toHaveBeenCalledWith("123", 456);
  });

  it("does not attempt reopen for other errors", async () => {
    mockApi.sendMessage.mockRejectedValueOnce(new Error("400: Bad Request: other error"));

    await expect(
      sendMessageTelegram("123", "test", {
        messageThreadId: 456,
        token: "mock-token",
      }),
    ).rejects.toThrow("other error");

    expect(mockApi.reopenForumTopic).not.toHaveBeenCalled();
  });
});
