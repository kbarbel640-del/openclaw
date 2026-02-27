import type { QQAccessToken } from "./types.js";

const QQ_TOKEN_URL = "https://bots.qq.com/app/getAppAccessToken";

type TokenCache = {
  token: string;
  expiresAt: number;
};

const tokenCache = new Map<string, TokenCache>();

export async function getQQAccessToken(
  appId: string,
  clientSecret: string,
): Promise<string> {
  const key = `${appId}:${clientSecret}`;
  const cached = tokenCache.get(key);
  // Refresh 60s before expiry
  if (cached && cached.expiresAt - Date.now() > 60_000) {
    return cached.token;
  }

  const res = await fetch(QQ_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appId, clientSecret }),
  });

  if (!res.ok) {
    throw new Error(`QQ token fetch failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as QQAccessToken;
  if (!data.access_token) {
    throw new Error("QQ token response missing access_token");
  }

  tokenCache.set(key, {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  });

  return data.access_token;
}

export function clearQQTokenCache(appId: string, clientSecret: string): void {
  tokenCache.delete(`${appId}:${clientSecret}`);
}
