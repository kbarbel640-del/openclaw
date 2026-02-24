import { createHash, createHmac } from "node:crypto";
import type { SmsResolvedAccount } from "../types.js";

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function hmac(key: string | Buffer, content: string): Buffer {
  return createHmac("sha256", key).update(content, "utf8").digest();
}

function buildTc3Authorization(params: {
  secretId: string;
  secretKey: string;
  host: string;
  payload: string;
  timestamp: number;
}) {
  const service = "sms";
  const date = new Date(params.timestamp * 1000).toISOString().slice(0, 10);
  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${params.host}\n`;
  const signedHeaders = "content-type;host";
  const hashedPayload = sha256(params.payload);
  const canonicalRequest = `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${hashedPayload}`;
  const credentialScope = `${date}/${service}/tc3_request`;
  const stringToSign = `TC3-HMAC-SHA256\n${params.timestamp}\n${credentialScope}\n${sha256(canonicalRequest)}`;

  const secretDate = hmac(`TC3${params.secretKey}`, date);
  const secretService = hmac(secretDate, service);
  const secretSigning = hmac(secretService, "tc3_request");
  const signature = createHmac("sha256", secretSigning).update(stringToSign, "utf8").digest("hex");

  return `TC3-HMAC-SHA256 Credential=${params.secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

export async function sendSmsViaTencent(params: {
  account: SmsResolvedAccount;
  to: string;
  text: string;
}): Promise<{ messageId: string; provider: "tencent" }> {
  const { account, to, text } = params;
  if (!account.tencent.secretId || !account.tencent.secretKey || !account.tencent.sdkAppId) {
    throw new Error("Tencent SMS credentials are missing (secretId/secretKey/sdkAppId)");
  }
  if (!account.signName || !account.templateId) {
    throw new Error("Tencent SMS requires signName and templateId");
  }

  const host = account.tencent.endpoint;
  const timestamp = Math.floor(Date.now() / 1000);

  const payloadObj: Record<string, unknown> = {
    PhoneNumberSet: [to],
    SmsSdkAppId: account.tencent.sdkAppId,
    SignName: account.signName,
    TemplateId: account.templateId,
    TemplateParamSet: [text],
  };
  if (account.tencent.senderId) {
    payloadObj.SenderId = account.tencent.senderId;
  }
  if (account.tencent.sessionContext) {
    payloadObj.SessionContext = account.tencent.sessionContext;
  }

  const payload = JSON.stringify(payloadObj);
  const authorization = buildTc3Authorization({
    secretId: account.tencent.secretId,
    secretKey: account.tencent.secretKey,
    host,
    payload,
    timestamp,
  });

  const response = await fetch(`https://${host}/`, {
    method: "POST",
    headers: {
      authorization,
      "content-type": "application/json; charset=utf-8",
      host,
      "x-tc-action": "SendSms",
      "x-tc-version": "2021-01-11",
      "x-tc-timestamp": String(timestamp),
      ...(account.tencent.region ? { "x-tc-region": account.tencent.region } : {}),
    },
    body: payload,
  });

  const body = (await response.json().catch(() => ({}))) as {
    Response?: {
      RequestId?: string;
      Error?: { Code?: string; Message?: string };
      SendStatusSet?: Array<{ SerialNo?: string; Code?: string; Message?: string }>;
    };
  };

  if (!response.ok) {
    throw new Error(`Tencent SMS HTTP ${response.status}: request failed`);
  }

  const error = body.Response?.Error;
  if (error?.Code) {
    throw new Error(`Tencent SMS error ${error.Code}: ${error.Message ?? "request failed"}`);
  }

  const firstStatus = body.Response?.SendStatusSet?.[0];
  if (firstStatus?.Code && firstStatus.Code !== "Ok") {
    throw new Error(
      `Tencent SMS send failed ${firstStatus.Code}: ${firstStatus.Message ?? "request failed"}`,
    );
  }

  return {
    messageId: firstStatus?.SerialNo ?? body.Response?.RequestId ?? `tencent-${Date.now()}`,
    provider: "tencent",
  };
}
