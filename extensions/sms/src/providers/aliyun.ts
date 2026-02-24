import { createHmac, randomUUID } from "node:crypto";
import type { SmsResolvedAccount } from "../types.js";

function percentEncode(value: string): string {
  return encodeURIComponent(value).replace(/\+/g, "%20").replace(/\*/g, "%2A").replace(/%7E/g, "~");
}

function buildAliyunSignature(params: Record<string, string>, accessKeySecret: string): string {
  const canonicalized = Object.keys(params)
    .sort((a, b) => a.localeCompare(b))
    .map((key) => `${percentEncode(key)}=${percentEncode(params[key] ?? "")}`)
    .join("&");
  const stringToSign = `POST&%2F&${percentEncode(canonicalized)}`;
  return createHmac("sha1", `${accessKeySecret}&`).update(stringToSign).digest("base64");
}

export async function sendSmsViaAliyun(params: {
  account: SmsResolvedAccount;
  to: string;
  text: string;
}): Promise<{ messageId: string; provider: "aliyun" }> {
  const { account, to, text } = params;
  if (!account.aliyun.accessKeyId || !account.aliyun.accessKeySecret) {
    throw new Error("Aliyun SMS credentials are missing (accessKeyId/accessKeySecret)");
  }
  if (!account.signName || !account.templateId) {
    throw new Error("Aliyun SMS requires signName and templateId");
  }

  const templateParam = JSON.stringify({
    [account.aliyun.templateParamName]: text,
  });

  const query: Record<string, string> = {
    Action: "SendSms",
    Version: "2017-05-25",
    Format: "JSON",
    SignatureMethod: "HMAC-SHA1",
    SignatureNonce: randomUUID(),
    SignatureVersion: "1.0",
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    AccessKeyId: account.aliyun.accessKeyId,
    PhoneNumbers: to,
    SignName: account.signName,
    TemplateCode: account.templateId,
    TemplateParam: templateParam,
  };

  query.Signature = buildAliyunSignature(query, account.aliyun.accessKeySecret);

  const body = new URLSearchParams(query).toString();
  const response = await fetch(account.aliyun.endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const payload = (await response.json().catch(() => ({}))) as {
    Code?: string;
    Message?: string;
    RequestId?: string;
    BizId?: string;
  };

  if (!response.ok) {
    throw new Error(`Aliyun SMS HTTP ${response.status}: ${payload.Message ?? "request failed"}`);
  }
  if (payload.Code !== "OK") {
    throw new Error(
      `Aliyun SMS error ${payload.Code ?? "Unknown"}: ${payload.Message ?? "request failed"}`,
    );
  }

  return {
    messageId: payload.BizId ?? payload.RequestId ?? `aliyun-${Date.now()}`,
    provider: "aliyun",
  };
}
