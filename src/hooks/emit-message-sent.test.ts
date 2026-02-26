import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockRunMessageSent = vi.fn().mockResolvedValue(undefined);
const mockHasHooks = vi.fn().mockReturnValue(false);
const mockGetGlobalHookRunner = vi.fn().mockReturnValue(null);

vi.mock("../plugins/hook-runner-global.js", () => ({
  getGlobalHookRunner: () => mockGetGlobalHookRunner(),
}));

const mockTriggerInternalHook = vi.fn().mockResolvedValue(undefined);
const mockCreateInternalHookEvent = vi.fn().mockReturnValue({ type: "message", action: "sent" });

vi.mock("./internal-hooks.js", () => ({
  triggerInternalHook: (...args: unknown[]) => mockTriggerInternalHook(...args),
  createInternalHookEvent: (...args: unknown[]) => mockCreateInternalHookEvent(...args),
}));

import { emitMessageSentHook } from "./emit-message-sent.js";

describe("emitMessageSentHook", () => {
  const baseParams = {
    to: "chat-123",
    content: "Hello world",
    success: true,
    channelId: "telegram",
    accountId: "acct-1",
    sessionKey: "session-abc",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetGlobalHookRunner.mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("plugin hook", () => {
    it("fires with correct args when hookRunner has hooks", () => {
      mockGetGlobalHookRunner.mockReturnValue({
        hasHooks: mockHasHooks.mockReturnValue(true),
        runMessageSent: mockRunMessageSent,
      });

      emitMessageSentHook(baseParams);

      expect(mockRunMessageSent).toHaveBeenCalledWith(
        { to: "chat-123", content: "Hello world", success: true },
        { channelId: "telegram", accountId: "acct-1", conversationId: "chat-123" },
      );
    });

    it("includes error field when success is false", () => {
      mockGetGlobalHookRunner.mockReturnValue({
        hasHooks: mockHasHooks.mockReturnValue(true),
        runMessageSent: mockRunMessageSent,
      });

      emitMessageSentHook({ ...baseParams, success: false, error: "send failed" });

      expect(mockRunMessageSent).toHaveBeenCalledWith(
        { to: "chat-123", content: "Hello world", success: false, error: "send failed" },
        { channelId: "telegram", accountId: "acct-1", conversationId: "chat-123" },
      );
    });

    it("does not fire when hookRunner is null (plugins not loaded)", () => {
      mockGetGlobalHookRunner.mockReturnValue(null);

      emitMessageSentHook(baseParams);

      expect(mockRunMessageSent).not.toHaveBeenCalled();
    });

    it("does not fire when hookRunner.hasHooks returns false", () => {
      mockGetGlobalHookRunner.mockReturnValue({
        hasHooks: mockHasHooks.mockReturnValue(false),
        runMessageSent: mockRunMessageSent,
      });

      emitMessageSentHook(baseParams);

      expect(mockRunMessageSent).not.toHaveBeenCalled();
    });

    it("swallows errors from plugin hook (fire-and-forget)", () => {
      mockGetGlobalHookRunner.mockReturnValue({
        hasHooks: mockHasHooks.mockReturnValue(true),
        runMessageSent: mockRunMessageSent.mockRejectedValue(new Error("plugin crash")),
      });

      // Should not throw
      expect(() => emitMessageSentHook(baseParams)).not.toThrow();
    });
  });

  describe("internal hook", () => {
    it("fires with correct event shape when sessionKey is provided", () => {
      emitMessageSentHook(baseParams);

      expect(mockCreateInternalHookEvent).toHaveBeenCalledWith("message", "sent", "session-abc", {
        to: "chat-123",
        content: "Hello world",
        success: true,
        channelId: "telegram",
        accountId: "acct-1",
        conversationId: "chat-123",
        messageId: undefined,
      });
      expect(mockTriggerInternalHook).toHaveBeenCalled();
    });

    it("does not fire when sessionKey is undefined", () => {
      emitMessageSentHook({ ...baseParams, sessionKey: undefined });

      expect(mockCreateInternalHookEvent).not.toHaveBeenCalled();
      expect(mockTriggerInternalHook).not.toHaveBeenCalled();
    });

    it("includes messageId when provided", () => {
      emitMessageSentHook({ ...baseParams, messageId: "msg-42" });

      expect(mockCreateInternalHookEvent).toHaveBeenCalledWith(
        "message",
        "sent",
        "session-abc",
        expect.objectContaining({ messageId: "msg-42" }),
      );
    });

    it("includes error in context when success is false", () => {
      emitMessageSentHook({ ...baseParams, success: false, error: "timeout" });

      expect(mockCreateInternalHookEvent).toHaveBeenCalledWith(
        "message",
        "sent",
        "session-abc",
        expect.objectContaining({ success: false, error: "timeout" }),
      );
    });

    it("swallows errors from internal hook (fire-and-forget)", () => {
      mockTriggerInternalHook.mockRejectedValue(new Error("internal hook crash"));

      expect(() => emitMessageSentHook(baseParams)).not.toThrow();
    });
  });

  describe("independence", () => {
    it("fires internal hook even when plugin hook is not available", () => {
      mockGetGlobalHookRunner.mockReturnValue(null);

      emitMessageSentHook(baseParams);

      expect(mockRunMessageSent).not.toHaveBeenCalled();
      expect(mockTriggerInternalHook).toHaveBeenCalled();
    });

    it("fires plugin hook even when sessionKey is missing (internal hook skipped)", () => {
      mockGetGlobalHookRunner.mockReturnValue({
        hasHooks: mockHasHooks.mockReturnValue(true),
        runMessageSent: mockRunMessageSent,
      });

      emitMessageSentHook({ ...baseParams, sessionKey: undefined });

      expect(mockRunMessageSent).toHaveBeenCalled();
      expect(mockTriggerInternalHook).not.toHaveBeenCalled();
    });

    it("passes accountId as undefined when not provided", () => {
      mockGetGlobalHookRunner.mockReturnValue({
        hasHooks: mockHasHooks.mockReturnValue(true),
        runMessageSent: mockRunMessageSent,
      });

      emitMessageSentHook({ ...baseParams, accountId: undefined });

      expect(mockRunMessageSent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ accountId: undefined }),
      );
    });
  });
});
