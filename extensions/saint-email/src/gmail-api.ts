import type { GmailMessage, ResolvedSaintEmailAccount } from "./types.js";

export class GmailAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GmailAuthError";
  }
}

function toBaseUrl(account: ResolvedSaintEmailAccount): string {
  return `https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(account.userId)}`;
}

async function gmailRequest<T>(params: {
  account: ResolvedSaintEmailAccount;
  path: string;
  method?: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
}): Promise<T> {
  const token = params.account.accessToken?.trim();
  if (!token) {
    throw new Error("email accessToken is not configured");
  }

  const url = new URL(`${toBaseUrl(params.account)}${params.path}`);
  for (const [key, value] of Object.entries(params.query ?? {})) {
    if (value === undefined) {
      continue;
    }
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    method: params.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: params.body ? JSON.stringify(params.body) : undefined,
  });

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 401) {
      throw new GmailAuthError(
        `gmail auth expired (401) for ${params.account.userId}: ${body}`,
      );
    }
    // Retry once on transient errors (429, 500, 502, 503)
    if ([429, 500, 502, 503].includes(response.status)) {
      const retryDelay = response.status === 429 ? 5000 : 1000;
      await new Promise((r) => setTimeout(r, retryDelay));
      const retryResponse = await fetch(url, {
        method: params.method ?? "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: params.body ? JSON.stringify(params.body) : undefined,
      });
      if (retryResponse.ok) {
        return (await retryResponse.json()) as T;
      }
      const retryBody = await retryResponse.text();
      throw new Error(`gmail api error ${retryResponse.status} (after retry): ${retryBody}`);
    }
    throw new Error(`gmail api error ${response.status}: ${body}`);
  }

  return (await response.json()) as T;
}

export async function gmailListMessages(params: {
  account: ResolvedSaintEmailAccount;
  query: string;
  maxResults: number;
}): Promise<string[]> {
  const payload = await gmailRequest<{ messages?: Array<{ id?: string }> }>({
    account: params.account,
    path: "/messages",
    query: {
      q: params.query,
      maxResults: params.maxResults,
    },
  });
  return (payload.messages ?? [])
    .map((entry) => entry.id)
    .filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}

export async function gmailGetMessage(params: {
  account: ResolvedSaintEmailAccount;
  id: string;
}): Promise<GmailMessage> {
  return await gmailRequest<GmailMessage>({
    account: params.account,
    path: `/messages/${encodeURIComponent(params.id)}`,
    query: { format: "full" },
  });
}

export async function gmailSendMessage(params: {
  account: ResolvedSaintEmailAccount;
  raw: string;
  threadId?: string;
}): Promise<{ id: string; threadId?: string }> {
  return await gmailRequest<{ id: string; threadId?: string }>({
    account: params.account,
    path: "/messages/send",
    method: "POST",
    body: {
      raw: params.raw,
      ...(params.threadId ? { threadId: params.threadId } : {}),
    },
  });
}

export function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf-8");
}
