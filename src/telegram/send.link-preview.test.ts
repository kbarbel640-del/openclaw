import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendMessageTelegram } from "./send.js";

// Mock dependencies
vi.mock("./accounts.js", () => ({
  resolveTelegramAccount: vi.fn().mockReturnValue({ 
    accountId: "default", 
    config: { linkPreview: true } // Default enabled
  }),
}));
vi.mock("./targets.js", () => ({
  parseTelegramTarget: vi.fn().mockReturnValue({ chatId: "123" }),
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
};

vi.mock("grammy", () => ({
  Bot: vi.fn(() => ({
    api: mockApi,
  })),
  InputFile: vi.fn(),
  HttpError: class extends Error {},
}));

describe("sendMessageTelegram link preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.sendMessage.mockResolvedValue({ message_id: 1, chat: { id: 123 } });
  });

  it("sends link_preview_options={is_disabled: true} when linkPreview=false", async () => {
    await sendMessageTelegram("123", "http://example.com", {
      token: "mock",
      linkPreview: false,
    });

    expect(mockApi.sendMessage).toHaveBeenCalledWith(
      "123", 
      expect.stringContaining("example.com"), 
      expect.objectContaining({
        link_preview_options: { is_disabled: true },
      })
    );
  });

  it("does NOT send link_preview_options when linkPreview=true (default behavior)", async () => {
    await sendMessageTelegram("123", "http://example.com", {
      token: "mock",
      linkPreview: true,
    });

    // When enabled, we omit the option (Telegram default)
    // Actually, my code omits it if enabled.
    const call = mockApi.sendMessage.mock.calls[0];
    const params = call[2];
    expect(params.link_preview_options).toBeUndefined();
  });
});
