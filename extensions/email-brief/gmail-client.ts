import * as crypto from "node:crypto";
import * as fs from "node:fs";
import type { GmailMessage } from "./gmail-body.js";
import type { GmailConfig, ServiceAccountKey } from "./types.js";

const GMAIL_API_BASE = "https://gmail.googleapis.com";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

/** Token refresh margin: 55 minutes (safety buffer per T-01 risk). */
const TOKEN_REFRESH_MARGIN_MS = 55 * 60 * 1000;

/** Maximum concurrent Gmail API requests. */
const CONCURRENCY_CAP = 5;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Base64url-encode a Buffer or string. */
function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64url");
}

/**
 * Sanitize error messages to never leak private key material.
 * If the message contains PEM markers or the raw key, redact it.
 */
function sanitizeError(error: unknown, privateKey?: string): string {
  let msg = error instanceof Error ? error.message : String(error);
  if (msg.includes("-----BEGIN")) {
    // First try to match full PEM blocks (BEGIN...END)
    msg = msg.replace(/-----BEGIN[\s\S]*?-----END[^\n]*/g, "[REDACTED]");
    // Also catch partial PEM markers (BEGIN without matching END)
    if (msg.includes("-----BEGIN")) {
      msg = msg.replace(/-----BEGIN[\s\S]*/g, "[REDACTED]");
    }
  }
  if (privateKey && msg.includes(privateKey.slice(0, 40))) {
    msg = msg.replace(new RegExp(escapeRegExp(privateKey), "g"), "[REDACTED]");
  }
  return msg;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------------------------------------------------------------------------
// GmailClient
// ---------------------------------------------------------------------------

export class GmailClient {
  private config: GmailConfig;
  private fetchImpl: typeof fetch;
  private cachedToken: { token: string; expiresAt: number } | null = null;

  constructor(config: GmailConfig, fetchImpl: typeof fetch = globalThis.fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  /**
   * Get an OAuth2 access token via JWT (Service Account).
   * Caches the token and refreshes 55 minutes before expiry.
   */
  async getAccessToken(): Promise<string> {
    const now = Date.now();

    if (this.cachedToken && now < this.cachedToken.expiresAt) {
      return this.cachedToken.token;
    }

    const sa = this.config.serviceAccountKey;
    const iat = Math.floor(now / 1000);
    const exp = iat + 3600;

    const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claims = base64url(
      JSON.stringify({
        iss: sa.client_email,
        sub: this.config.userEmail,
        scope: GMAIL_SCOPE,
        aud: TOKEN_ENDPOINT,
        iat,
        exp,
      }),
    );

    const signingInput = `${header}.${claims}`;
    const signature = crypto.sign("RSA-SHA256", Buffer.from(signingInput), sa.private_key);
    const jwt = `${signingInput}.${base64url(signature)}`;

    const body = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    });

    let response: Response;
    try {
      response = await this.fetchImpl(TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
    } catch (err) {
      throw new Error(
        `Failed to exchange JWT for access token. Check your Service Account credentials. ${sanitizeError(err, sa.private_key)}`,
      );
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `Token exchange failed (${response.status}). Check your Service Account credentials. ${sanitizeError(text, sa.private_key)}`,
      );
    }

    const data = (await response.json()) as { access_token: string; expires_in?: number };
    const expiresIn = data.expires_in ?? 3600;

    this.cachedToken = {
      token: data.access_token,
      expiresAt: now + expiresIn * 1000 - (3600 * 1000 - TOKEN_REFRESH_MARGIN_MS),
    };

    return data.access_token;
  }

  /**
   * List message IDs matching a Gmail search query.
   */
  async listMessages(query: string, maxResults: number): Promise<string[]> {
    const token = await this.getAccessToken();
    const params = new URLSearchParams({
      q: query,
      maxResults: String(maxResults),
    });

    const url = `${GMAIL_API_BASE}/gmail/v1/users/me/messages?${params}`;
    const response = await this.fetchImpl(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    this.handleGmailError(response);

    const data = (await response.json()) as {
      messages?: Array<{ id: string }>;
    };

    return (data.messages ?? []).map((m) => m.id);
  }

  /**
   * Fetch full message details for given IDs.
   * Uses concurrent fetching with a concurrency cap of 5.
   * Retries once on 401 after refreshing the token.
   */
  async getMessages(ids: string[]): Promise<GmailMessage[]> {
    const results: GmailMessage[] = [];
    let retried401 = false;

    // Simple semaphore for concurrency control
    const queue = [...ids];
    const inFlight = new Set<Promise<void>>();

    const fetchOne = async (id: string): Promise<void> => {
      const token = await this.getAccessToken();
      const url = `${GMAIL_API_BASE}/gmail/v1/users/me/messages/${id}?format=full`;

      let response = await this.fetchImpl(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // On 401, refresh token and retry once
      if (response.status === 401 && !retried401) {
        retried401 = true;
        this.cachedToken = null;
        const newToken = await this.getAccessToken();
        response = await this.fetchImpl(url, {
          headers: { Authorization: `Bearer ${newToken}` },
        });
      }

      this.handleGmailError(response);

      const msg = (await response.json()) as GmailMessage;
      results.push(msg);
    };

    for (const id of queue) {
      const promise = fetchOne(id).then(() => {
        inFlight.delete(promise);
      });
      inFlight.add(promise);

      if (inFlight.size >= CONCURRENCY_CAP) {
        await Promise.race(inFlight);
      }
    }

    await Promise.all(inFlight);
    return results;
  }

  /**
   * Handle Gmail API error responses with descriptive messages.
   */
  private handleGmailError(response: Response): void {
    if (response.ok) return;

    if (response.status === 403) {
      throw new Error(
        `Gmail API returned 403 Forbidden. Ensure domain-wide delegation is configured for the Service Account ` +
          `with scope "${GMAIL_SCOPE}" and the correct client ID in Google Workspace Admin.`,
      );
    }

    if (response.status === 429) {
      throw new Error(
        "Gmail API rate limit exceeded (429). Please wait and retry, or reduce maxResults.",
      );
    }

    if (response.status === 401) {
      throw new Error(
        "Gmail API returned 401 Unauthorized. The access token may be invalid or expired.",
      );
    }

    throw new Error(`Gmail API error: ${response.status} ${response.statusText}`);
  }
}

// ---------------------------------------------------------------------------
// Config Resolution
// ---------------------------------------------------------------------------

/**
 * Resolve Gmail configuration from environment variables and plugin config.
 *
 * Service Account key resolution order:
 *   1. `GMAIL_SERVICE_ACCOUNT_KEY_PATH` env var (path to JSON file)
 *   2. `GMAIL_SERVICE_ACCOUNT_KEY` env var (inline JSON string)
 *
 * User email resolution order:
 *   1. `GMAIL_USER_EMAIL` env var
 *   2. `pluginConfig.userEmail`
 */
export function resolveGmailConfig(
  pluginConfig?: { userEmail?: string; maxEmails?: number },
  env: Record<string, string | undefined> = process.env,
): GmailConfig {
  // Resolve Service Account key
  let serviceAccountKey: ServiceAccountKey;

  const keyPath = env.GMAIL_SERVICE_ACCOUNT_KEY_PATH;
  const keyJson = env.GMAIL_SERVICE_ACCOUNT_KEY;

  if (keyPath) {
    try {
      const raw = fs.readFileSync(keyPath, "utf-8");
      serviceAccountKey = JSON.parse(raw) as ServiceAccountKey;
    } catch (err) {
      throw new Error(
        `Failed to read Service Account key from GMAIL_SERVICE_ACCOUNT_KEY_PATH="${keyPath}": ${sanitizeError(err)}`,
      );
    }
  } else if (keyJson) {
    try {
      serviceAccountKey = JSON.parse(keyJson) as ServiceAccountKey;
    } catch (err) {
      throw new Error(`Failed to parse GMAIL_SERVICE_ACCOUNT_KEY as JSON: ${sanitizeError(err)}`);
    }
  } else {
    throw new Error(
      "Gmail Service Account credentials not found. " +
        "Set GMAIL_SERVICE_ACCOUNT_KEY_PATH (path to JSON file) or GMAIL_SERVICE_ACCOUNT_KEY (inline JSON). " +
        "See docs for Google Workspace domain-wide delegation setup.",
    );
  }

  // Validate SA key required fields
  if (!serviceAccountKey.client_email || !serviceAccountKey.private_key) {
    throw new Error(
      "Service Account key is missing required fields (client_email, private_key). " +
        "Check your Service Account credentials.",
    );
  }

  // Resolve user email
  const userEmail = env.GMAIL_USER_EMAIL ?? pluginConfig?.userEmail;
  if (!userEmail) {
    throw new Error(
      "Gmail user email not configured. " +
        "Set GMAIL_USER_EMAIL env var or userEmail in plugin config.",
    );
  }

  const maxEmails = pluginConfig?.maxEmails ?? 20;

  return { serviceAccountKey, userEmail, maxEmails };
}
