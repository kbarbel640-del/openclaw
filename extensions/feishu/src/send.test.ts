import { beforeEach, describe, expect, it, vi } from "vitest";

const messageCreateMock = vi.hoisted(() => vi.fn());
const messageReplyMock = vi.hoisted(() => vi.fn());
const resolveFeishuSendTargetMock = vi.hoisted(() => vi.fn());

vi.mock("./send-target.js", () => ({
  resolveFeishuSendTarget: resolveFeishuSendTargetMock,
}));

vi.mock("./runtime.js", () => ({
  getFeishuRuntime: () => ({
    channel: {
      text: {
        resolveMarkdownTableMode: () => "plain",
        convertMarkdownTables: (t: string) => t,
      },
    },
  }),
}));

import { sendMessageFeishu, sendCardFeishu } from "./send.js";

describe("reply fallback on withdrawn/deleted message", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    resolveFeishuSendTargetMock.mockReturnValue({
      client: {
        im: {
          message: {
            create: messageCreateMock,
            reply: messageReplyMock,
          },
        },
      },
      receiveId: "ou_target",
      receiveIdType: "open_id",
    });

    messageCreateMock.mockResolvedValue({
      code: 0,
      data: { message_id: "msg_fallback" },
    });
  });

  describe("sendMessageFeishu", () => {
    it("falls back to direct send when reply target is withdrawn (230011)", async () => {
      messageReplyMock.mockResolvedValue({
        code: 230011,
        msg: "message has been withdrawn",
      });

      const result = await sendMessageFeishu({
        cfg: {} as any,
        to: "user:ou_target",
        text: "hello",
        replyToMessageId: "om_withdrawn",
      });

      expect(messageReplyMock).toHaveBeenCalledOnce();
      expect(messageCreateMock).toHaveBeenCalledOnce();
      expect(result.messageId).toBe("msg_fallback");
    });

    it("falls back to direct send when reply target is deleted (231003)", async () => {
      messageReplyMock.mockResolvedValue({
        code: 231003,
        msg: "message not found",
      });

      const result = await sendMessageFeishu({
        cfg: {} as any,
        to: "user:ou_target",
        text: "hello",
        replyToMessageId: "om_deleted",
      });

      expect(messageReplyMock).toHaveBeenCalledOnce();
      expect(messageCreateMock).toHaveBeenCalledOnce();
      expect(result.messageId).toBe("msg_fallback");
    });

    it("throws when reply fails with a non-gone error", async () => {
      messageReplyMock.mockResolvedValue({
        code: 99999,
        msg: "other error",
      });

      await expect(
        sendMessageFeishu({
          cfg: {} as any,
          to: "user:ou_target",
          text: "hello",
          replyToMessageId: "om_other",
        }),
      ).rejects.toThrow("Feishu reply failed: other error");

      expect(messageCreateMock).not.toHaveBeenCalled();
    });

    it("replies normally when the target message exists", async () => {
      messageReplyMock.mockResolvedValue({
        code: 0,
        data: { message_id: "msg_reply" },
      });

      const result = await sendMessageFeishu({
        cfg: {} as any,
        to: "user:ou_target",
        text: "hello",
        replyToMessageId: "om_valid",
      });

      expect(messageReplyMock).toHaveBeenCalledOnce();
      expect(messageCreateMock).not.toHaveBeenCalled();
      expect(result.messageId).toBe("msg_reply");
    });

    it("sends directly when no replyToMessageId is given", async () => {
      const result = await sendMessageFeishu({
        cfg: {} as any,
        to: "user:ou_target",
        text: "hello",
      });

      expect(messageReplyMock).not.toHaveBeenCalled();
      expect(messageCreateMock).toHaveBeenCalledOnce();
      expect(result.messageId).toBe("msg_fallback");
    });
  });

  describe("sendCardFeishu", () => {
    it("falls back to direct send when reply target is withdrawn (230011)", async () => {
      messageReplyMock.mockResolvedValue({
        code: 230011,
        msg: "message has been withdrawn",
      });

      const result = await sendCardFeishu({
        cfg: {} as any,
        to: "user:ou_target",
        card: { schema: "2.0" },
        replyToMessageId: "om_withdrawn",
      });

      expect(messageReplyMock).toHaveBeenCalledOnce();
      expect(messageCreateMock).toHaveBeenCalledOnce();
      expect(messageCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ msg_type: "interactive" }),
        }),
      );
      expect(result.messageId).toBe("msg_fallback");
    });

    it("falls back to direct send when reply target is deleted (231003)", async () => {
      messageReplyMock.mockResolvedValue({
        code: 231003,
        msg: "message not found",
      });

      const result = await sendCardFeishu({
        cfg: {} as any,
        to: "user:ou_target",
        card: { schema: "2.0" },
        replyToMessageId: "om_deleted",
      });

      expect(messageReplyMock).toHaveBeenCalledOnce();
      expect(messageCreateMock).toHaveBeenCalledOnce();
      expect(result.messageId).toBe("msg_fallback");
    });

    it("throws when reply fails with a non-gone error", async () => {
      messageReplyMock.mockResolvedValue({
        code: 99999,
        msg: "other error",
      });

      await expect(
        sendCardFeishu({
          cfg: {} as any,
          to: "user:ou_target",
          card: { schema: "2.0" },
          replyToMessageId: "om_other",
        }),
      ).rejects.toThrow("Feishu card reply failed: other error");

      expect(messageCreateMock).not.toHaveBeenCalled();
    });

    it("replies normally when the target message exists", async () => {
      messageReplyMock.mockResolvedValue({
        code: 0,
        data: { message_id: "msg_reply" },
      });

      const result = await sendCardFeishu({
        cfg: {} as any,
        to: "user:ou_target",
        card: { schema: "2.0" },
        replyToMessageId: "om_valid",
      });

      expect(messageReplyMock).toHaveBeenCalledOnce();
      expect(messageCreateMock).not.toHaveBeenCalled();
      expect(result.messageId).toBe("msg_reply");
    });
  });
});
