import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTelegramApprovalNotifier, type ApprovalRecord } from "../approval-notifier";

describe("TelegramApprovalNotifier", () => {
  const fakeCfg = {
    channels: {
      telegram: {
        token: "123:ABC",
        approvalChatId: "6759594496",
      },
    },
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return null if no token configured", () => {
    const cfg = { channels: {} } as any;
    const notifier = createTelegramApprovalNotifier(cfg);
    expect(notifier).toBeNull();
  });

  it("should send approval message with inline buttons", async () => {
    const notifier = createTelegramApprovalNotifier(fakeCfg, {
      log: vi.fn(),
      error: vi.fn(),
    });
    expect(notifier).not.toBeNull();

    const mockSendMessage = vi.fn().mockResolvedValue({});
    notifier!.bot.api.sendMessage = mockSendMessage;

    const record: ApprovalRecord = {
      id: "test123",
      request: {
        command: "rm -rf model/",
        cwd: "C:\\Users\\User\\Desktop\\openclaw",
        resolvedPath: "C:\\Users\\User\\Desktop\\openclaw\\model",
        ask: "Dangerous operation",
      },
      createdAtMs: Date.now(),
      expiresAtMs: Date.now() + 120000,
    };

    await notifier!.sendApprovalRequest(record);

    expect(mockSendMessage).toHaveBeenCalledWith(
      "6759594496",
      expect.stringContaining("⚠️ *Approval Required*"),
      expect.objectContaining({
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Approve Once", callback_data: "approve_once:test123" },
              { text: "✅ Approve Always", callback_data: "approve_always:test123" },
              { text: "❌ Reject", callback_data: "reject:test123" },
            ],
          ],
        },
      })
    );
  });

  it("should include resolvedPath in message", async () => {
    const notifier = createTelegramApprovalNotifier(fakeCfg);
    const mockSendMessage = vi.fn().mockResolvedValue({});
    notifier!.bot.api.sendMessage = mockSendMessage;

    const record: ApprovalRecord = {
      id: "abc",
      request: {
        command: "del file.txt",
        resolvedPath: "C:\\some\\path\\file.txt",
      },
      createdAtMs: Date.now(),
      expiresAtMs: Date.now() + 120000,
    };

    await notifier!.sendApprovalRequest(record);

    const sentText = mockSendMessage.mock.calls[0][1];
    expect(sentText).toContain("C:\\some\\path\\file.txt");
  });
});
