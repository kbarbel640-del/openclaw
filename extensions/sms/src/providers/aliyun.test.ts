import { afterEach, describe, expect, it, vi } from "vitest";
import type { SmsResolvedAccount } from "../types.js";
import { sendSmsViaAliyun } from "./aliyun.js";

function createAliyunAccount(): SmsResolvedAccount {
  return {
    accountId: "default",
    enabled: true,
    configured: true,
    provider: "aliyun",
    signName: "OpenClaw",
    templateId: "SMS_123456789",
    aliyun: {
      accessKeyId: "ak-test",
      accessKeySecret: "sk-test",
      endpoint: "https://dysmsapi.aliyuncs.com/",
      templateParamName: "content",
    },
    tencent: {
      endpoint: "sms.tencentcloudapi.com",
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sendSmsViaAliyun", () => {
  it("sends signed form request and returns biz id", async () => {
    const mockFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = new URLSearchParams(String(init?.body ?? ""));
      expect(init?.method).toBe("POST");
      expect(init?.headers).toEqual({ "content-type": "application/x-www-form-urlencoded" });
      expect(body.get("Action")).toBe("SendSms");
      expect(body.get("Version")).toBe("2017-05-25");
      expect(body.get("PhoneNumbers")).toBe("+8613812345678");
      expect(body.get("SignName")).toBe("OpenClaw");
      expect(body.get("TemplateCode")).toBe("SMS_123456789");
      expect(body.get("Signature")).toBeTruthy();
      const templateParam = JSON.parse(body.get("TemplateParam") ?? "{}");
      expect(templateParam.content).toBe("hello world");

      return new Response(JSON.stringify({ Code: "OK", BizId: "biz-001", RequestId: "req-001" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    vi.stubGlobal("fetch", mockFetch);

    const result = await sendSmsViaAliyun({
      account: createAliyunAccount(),
      to: "+8613812345678",
      text: "hello world",
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ messageId: "biz-001", provider: "aliyun" });
  });

  it("throws when provider returns non-OK code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ Code: "isv.BUSINESS_LIMIT_CONTROL", Message: "rate" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      ),
    );

    await expect(
      sendSmsViaAliyun({
        account: createAliyunAccount(),
        to: "+8613812345678",
        text: "hello world",
      }),
    ).rejects.toThrow(/Aliyun SMS error isv\.BUSINESS_LIMIT_CONTROL/);
  });
});
