import { describe, expect, it, vi, beforeEach, type Mock } from "vitest";
import { createTelegramSendChatActionHandler } from "./sendchataction-401-backoff.js";

describe("Telegram sendChatAction 401 backoff", () => {
  let mockSendChatAction: Mock;
  let mockLogger: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSendChatAction = vi.fn();
    mockLogger = vi.fn();
  });

  it("should retry with exponential backoff on 401 errors", async () => {
    // Arrange: Mock API to always return 401
    const error401 = new Error("Call to 'sendChatAction' failed! (401: Unauthorized)");
    mockSendChatAction.mockRejectedValue(error401);

    const handler = createTelegramSendChatActionHandler({
      sendChatActionFn: mockSendChatAction,
      logger: mockLogger,
      chatId: 123,
      action: "typing",
      threadParams: undefined,
    });

    // Act & Assert: First few calls should retry with increasing delays
    const startTime = Date.now();

    // First call should fail immediately
    await expect(handler.sendChatAction()).rejects.toThrow();
    expect(mockSendChatAction).toHaveBeenCalledTimes(1);

    // Second call should have ~1 second backoff
    await expect(handler.sendChatAction()).rejects.toThrow();
    expect(mockSendChatAction).toHaveBeenCalledTimes(2);

    // Third call should have ~2 second backoff
    await expect(handler.sendChatAction()).rejects.toThrow();
    expect(mockSendChatAction).toHaveBeenCalledTimes(3);

    const elapsedTime = Date.now() - startTime;
    // Should have waited at least 3 seconds total (1s + 2s)
    expect(elapsedTime).toBeGreaterThan(2900);
  });

  it("should suspend channel after N consecutive 401 failures", async () => {
    const error401 = new Error("Call to 'sendChatAction' failed! (401: Unauthorized)");
    mockSendChatAction.mockRejectedValue(error401);

    const handler = createTelegramSendChatActionHandler({
      sendChatActionFn: mockSendChatAction,
      logger: mockLogger,
      chatId: 123,
      action: "typing",
      threadParams: undefined,
      maxRetries: 3,
    });

    // First 3 failures should still attempt the call
    await expect(handler.sendChatAction()).rejects.toThrow();
    await expect(handler.sendChatAction()).rejects.toThrow();
    await expect(handler.sendChatAction()).rejects.toThrow();
    expect(mockSendChatAction).toHaveBeenCalledTimes(3);

    // 4th call should be suspended (not call the API)
    await handler.sendChatAction();
    expect(mockSendChatAction).toHaveBeenCalledTimes(3); // Still 3, not 4
    expect(mockLogger).toHaveBeenCalledWith(
      expect.stringContaining("Telegram channel suspended due to repeated 401 errors"),
    );
  });

  it("should reset failure count on successful call", async () => {
    const error401 = new Error("Call to 'sendChatAction' failed! (401: Unauthorized)");

    const handler = createTelegramSendChatActionHandler({
      sendChatActionFn: mockSendChatAction,
      logger: mockLogger,
      chatId: 123,
      action: "typing",
      threadParams: undefined,
      maxRetries: 3,
    });

    // Fail twice
    mockSendChatAction.mockRejectedValueOnce(error401);
    mockSendChatAction.mockRejectedValueOnce(error401);
    await expect(handler.sendChatAction()).rejects.toThrow();
    await expect(handler.sendChatAction()).rejects.toThrow();

    // Then succeed
    mockSendChatAction.mockResolvedValueOnce(undefined);
    await handler.sendChatAction();
    expect(mockSendChatAction).toHaveBeenCalledTimes(3);

    // Should be able to make more attempts (failure count reset)
    mockSendChatAction.mockRejectedValue(error401);
    await expect(handler.sendChatAction()).rejects.toThrow();
    expect(mockSendChatAction).toHaveBeenCalledTimes(4);
  });

  it("should not apply backoff to non-401 errors", async () => {
    const error429 = new Error("Rate limited");
    mockSendChatAction.mockRejectedValue(error429);

    const handler = createTelegramSendChatActionHandler({
      sendChatActionFn: mockSendChatAction,
      logger: mockLogger,
      chatId: 123,
      action: "typing",
      threadParams: undefined,
    });

    const startTime = Date.now();

    // Should fail immediately without backoff
    await expect(handler.sendChatAction()).rejects.toThrow("Rate limited");
    await expect(handler.sendChatAction()).rejects.toThrow("Rate limited");

    const elapsedTime = Date.now() - startTime;
    // Should complete quickly (no backoff)
    expect(elapsedTime).toBeLessThan(500);
  });
});
