import type { OpenClawConfig } from "openclaw/plugin-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendSmsViaAliyunMock, sendSmsViaTencentMock } = vi.hoisted(() => ({
  sendSmsViaAliyunMock: vi.fn(),
  sendSmsViaTencentMock: vi.fn(),
}));

vi.mock("./providers/aliyun.js", () => ({
  sendSmsViaAliyun: sendSmsViaAliyunMock,
}));

vi.mock("./providers/tencent.js", () => ({
  sendSmsViaTencent: sendSmsViaTencentMock,
}));

import { smsPlugin } from "./channel.js";

function createBaseConfig(): OpenClawConfig {
  return {
    channels: {
      sms: {
        signName: "OpenClaw",
        templateId: "SMS_123456789",
      },
    },
  } as OpenClawConfig;
}

describe("smsPlugin outbound", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("routes sendText to aliyun provider", async () => {
    sendSmsViaAliyunMock.mockResolvedValue({ messageId: "aliyun-msg-1", provider: "aliyun" });

    const cfg = {
      ...createBaseConfig(),
      channels: {
        sms: {
          provider: "aliyun",
          signName: "OpenClaw",
          templateId: "SMS_123456789",
          aliyun: {
            accessKeyId: "ak",
            accessKeySecret: "sk",
          },
        },
      },
    } as OpenClawConfig;

    const result = await smsPlugin.outbound!.sendText!({
      cfg,
      to: "+8613812345678",
      text: "hello",
    });

    expect(sendSmsViaAliyunMock).toHaveBeenCalledTimes(1);
    expect(sendSmsViaTencentMock).not.toHaveBeenCalled();
    expect(result.channel).toBe("sms");
    expect(result.messageId).toBe("aliyun-msg-1");
  });

  it("routes sendText to tencent provider", async () => {
    sendSmsViaTencentMock.mockResolvedValue({
      messageId: "tencent-msg-1",
      provider: "tencent",
    });

    const cfg = {
      ...createBaseConfig(),
      channels: {
        sms: {
          provider: "tencent",
          signName: "OpenClaw",
          templateId: "1234567",
          tencent: {
            secretId: "id",
            secretKey: "key",
            sdkAppId: "1400000001",
          },
        },
      },
    } as OpenClawConfig;

    const result = await smsPlugin.outbound!.sendText!({
      cfg,
      to: "+8613812345678",
      text: "hello",
    });

    expect(sendSmsViaTencentMock).toHaveBeenCalledTimes(1);
    expect(sendSmsViaAliyunMock).not.toHaveBeenCalled();
    expect(result.messageId).toBe("tencent-msg-1");
  });

  it("throws when account is not configured", async () => {
    const cfg = {
      channels: {
        sms: {
          provider: "aliyun",
        },
      },
    } as OpenClawConfig;

    await expect(
      smsPlugin.outbound!.sendText!({
        cfg,
        to: "+8613812345678",
        text: "hello",
      }),
    ).rejects.toThrow(/is not configured/);
  });

  it("sendMedia falls back to sendText with combined payload", async () => {
    sendSmsViaAliyunMock.mockResolvedValue({ messageId: "aliyun-msg-2", provider: "aliyun" });

    const cfg = {
      ...createBaseConfig(),
      channels: {
        sms: {
          provider: "aliyun",
          signName: "OpenClaw",
          templateId: "SMS_123456789",
          aliyun: {
            accessKeyId: "ak",
            accessKeySecret: "sk",
          },
        },
      },
    } as OpenClawConfig;

    await smsPlugin.outbound!.sendMedia!({
      cfg,
      to: "+8613812345678",
      text: "caption",
      mediaUrl: "https://example.com/file.png",
    });

    expect(sendSmsViaAliyunMock).toHaveBeenCalledTimes(1);
    expect(sendSmsViaAliyunMock.mock.calls[0]?.[0]?.text).toContain("caption");
    expect(sendSmsViaAliyunMock.mock.calls[0]?.[0]?.text).toContain("https://example.com/file.png");
  });
});
