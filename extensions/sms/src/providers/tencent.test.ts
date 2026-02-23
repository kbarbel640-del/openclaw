import { afterEach, describe, expect, it, vi } from "vitest";
import type { SmsResolvedAccount } from "../types.js";
import { sendSmsViaTencent } from "./tencent.js";

function createTencentAccount(): SmsResolvedAccount {
  return {
    accountId: "default",
    enabled: true,
    configured: true,
    provider: "tencent",
    signName: "OpenClaw",
    templateId: "1234567",
    aliyun: {
      endpoint: "https://dysmsapi.aliyuncs.com/",
      templateParamName: "content",
    },
    tencent: {
      secretId: "secret-id",
      secretKey: "secret-key",
      sdkAppId: "1400000001",
      endpoint: "sms.tencentcloudapi.com",
      region: "ap-guangzhou",
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sendSmsViaTencent", () => {
  it("sends TC3 signed request and returns serial no", async () => {
    const mockFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(init?.method).toBe("POST");
      expect(headers.get("x-tc-action")).toBe("SendSms");
      expect(headers.get("x-tc-version")).toBe("2021-01-11");
      expect(headers.get("x-tc-region")).toBe("ap-guangzhou");
      expect(headers.get("authorization")).toContain("TC3-HMAC-SHA256 Credential=secret-id/");
      const payload = JSON.parse(String(init?.body ?? "{}")) as {
        PhoneNumberSet: string[];
        SignName: string;
        TemplateId: string;
        TemplateParamSet: string[];
        SmsSdkAppId: string;
      };
      expect(payload.PhoneNumberSet).toEqual(["+8613812345678"]);
      expect(payload.SignName).toBe("OpenClaw");
      expect(payload.TemplateId).toBe("1234567");
      expect(payload.TemplateParamSet).toEqual(["hello world"]);
      expect(payload.SmsSdkAppId).toBe("1400000001");

      return new Response(
        JSON.stringify({
          Response: {
            RequestId: "req-001",
            SendStatusSet: [{ SerialNo: "serial-001", Code: "Ok", Message: "send success" }],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    vi.stubGlobal("fetch", mockFetch);

    const result = await sendSmsViaTencent({
      account: createTencentAccount(),
      to: "+8613812345678",
      text: "hello world",
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ messageId: "serial-001", provider: "tencent" });
  });

  it("throws when provider returns error object", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              Response: {
                RequestId: "req-002",
                Error: { Code: "FailedOperation", Message: "bad template" },
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
      ),
    );

    await expect(
      sendSmsViaTencent({
        account: createTencentAccount(),
        to: "+8613812345678",
        text: "hello world",
      }),
    ).rejects.toThrow(/Tencent SMS error FailedOperation/);
  });
});
