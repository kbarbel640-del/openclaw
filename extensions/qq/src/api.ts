import { getQQAccessToken } from "./token.js";
import type { QQSendMessageParams, QQSendResult } from "./types.js";

const QQ_API_BASE = "https://api.sgroup.qq.com";

async function qqRequest<T>(params: {
  appId: string;
  clientSecret: string;
  method: string;
  path: string;
  body?: unknown;
  signal?: AbortSignal;
}): Promise<T> {
  const token = await getQQAccessToken(params.appId, params.clientSecret);
  const res = await fetch(`${QQ_API_BASE}${params.path}`, {
    method: params.method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `QQBot ${token}`,
      "X-Union-Appid": params.appId,
    },
    body: params.body ? JSON.stringify(params.body) : undefined,
    signal: params.signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`QQ API ${params.method} ${params.path} failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<T>;
}

/** Send C2C (single chat) message */
export async function sendQQC2CMessage(params: {
  appId: string;
  clientSecret: string;
  openid: string;
  msg: QQSendMessageParams;
  signal?: AbortSignal;
}): Promise<QQSendResult> {
  return qqRequest<QQSendResult>({
    appId: params.appId,
    clientSecret: params.clientSecret,
    method: "POST",
    path: `/v2/users/${encodeURIComponent(params.openid)}/messages`,
    body: params.msg,
    signal: params.signal,
  });
}

/** Send group message */
export async function sendQQGroupMessage(params: {
  appId: string;
  clientSecret: string;
  groupOpenid: string;
  msg: QQSendMessageParams;
  signal?: AbortSignal;
}): Promise<QQSendResult> {
  return qqRequest<QQSendResult>({
    appId: params.appId,
    clientSecret: params.clientSecret,
    method: "POST",
    path: `/v2/groups/${encodeURIComponent(params.groupOpenid)}/messages`,
    body: params.msg,
    signal: params.signal,
  });
}

/** Probe bot info */
export async function probeQQBot(params: {
  appId: string;
  clientSecret: string;
  timeoutMs?: number;
}): Promise<{ ok: boolean; username?: string; id?: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      params.timeoutMs ?? 5000,
    );
    try {
      const token = await getQQAccessToken(params.appId, params.clientSecret);
      const res = await fetch(`${QQ_API_BASE}/users/@me`, {
        headers: {
          Authorization: `QQBot ${token}`,
          "X-Union-Appid": params.appId,
        },
        signal: controller.signal,
      });
      if (!res.ok) {
        return { ok: false };
      }
      const data = (await res.json()) as { id?: string; username?: string };
      return { ok: true, id: data.id, username: data.username };
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return { ok: false };
  }
}
