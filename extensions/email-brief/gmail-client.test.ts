import * as crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GmailMessage } from "./gmail-body.js";
import type { GmailConfig } from "./types.js";
import { GmailClient, resolveGmailConfig } from "./gmail-client.js";

// ---------------------------------------------------------------------------
// Test RSA keypair (generated once for all tests)
// ---------------------------------------------------------------------------

const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

const fakeServiceAccountKey = {
  type: "service_account",
  project_id: "test-project",
  private_key_id: "key123",
  private_key: privateKey,
  client_email: "test@test-project.iam.gserviceaccount.com",
  client_id: "123456789",
  token_uri: "https://oauth2.googleapis.com/token",
};

function makeConfig(
  overrides?: Partial<Extract<GmailConfig, { authType: "serviceAccount" }>>,
): GmailConfig {
  return {
    authType: "serviceAccount" as const,
    serviceAccountKey: fakeServiceAccountKey,
    userEmail: "user@example.com",
    maxEmails: 20,
    ...overrides,
  };
}

function makeOAuthConfig(
  overrides?: Partial<Extract<GmailConfig, { authType: "oauth" }>>,
): GmailConfig {
  return {
    authType: "oauth" as const,
    oauthCredentials: {
      clientId: "test-client-id",
      clientSecret: "test-client-secret",
      refreshToken: "test-refresh-token",
    },
    maxEmails: 20,
    ...overrides,
  };
}

function makeGmailMessage(id: string): GmailMessage {
  return {
    id,
    threadId: `thread-${id}`,
    snippet: `Snippet for ${id}`,
    payload: {
      headers: [
        { name: "From", value: "sender@example.com" },
        { name: "Subject", value: `Subject ${id}` },
        { name: "Date", value: "2026-02-20T10:00:00Z" },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// JWT Construction
// ---------------------------------------------------------------------------

describe("GmailClient - JWT Auth", () => {
  it("constructs a valid JWT with correct header and claims", async () => {
    let capturedBody = "";

    const mockFetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
      if (urlStr.includes("oauth2.googleapis.com/token")) {
        capturedBody = init?.body as string;
        return new Response(JSON.stringify({ access_token: "test-token-123", expires_in: 3600 }), {
          status: 200,
        });
      }
      return new Response("Not found", { status: 404 });
    }) as unknown as typeof fetch;

    const client = new GmailClient(makeConfig(), mockFetch);
    const token = await client.getAccessToken();

    expect(token).toBe("test-token-123");
    expect(mockFetch).toHaveBeenCalledOnce();

    // Parse the JWT from the assertion parameter
    const params = new URLSearchParams(capturedBody);
    expect(params.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:jwt-bearer");

    const jwt = params.get("assertion")!;
    expect(jwt).toBeTruthy();

    const [headerB64, claimsB64, signatureB64] = jwt.split(".");

    // Verify header
    const header = JSON.parse(Buffer.from(headerB64, "base64url").toString());
    expect(header).toEqual({ alg: "RS256", typ: "JWT" });

    // Verify claims
    const claims = JSON.parse(Buffer.from(claimsB64, "base64url").toString());
    expect(claims.iss).toBe("test@test-project.iam.gserviceaccount.com");
    expect(claims.sub).toBe("user@example.com");
    expect(claims.scope).toBe("https://www.googleapis.com/auth/gmail.readonly");
    expect(claims.aud).toBe("https://oauth2.googleapis.com/token");
    expect(typeof claims.iat).toBe("number");
    expect(typeof claims.exp).toBe("number");
    expect(claims.exp - claims.iat).toBe(3600);

    // Verify signature with public key
    const signingInput = `${headerB64}.${claimsB64}`;
    const signature = Buffer.from(signatureB64, "base64url");
    const isValid = crypto.verify("RSA-SHA256", Buffer.from(signingInput), publicKey, signature);
    expect(isValid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Token Caching
// ---------------------------------------------------------------------------

describe("GmailClient - Token Caching", () => {
  it("caches token and does not re-fetch on second call", async () => {
    const mockFetch = vi.fn(async () => {
      return new Response(JSON.stringify({ access_token: "cached-token", expires_in: 3600 }), {
        status: 200,
      });
    }) as unknown as typeof fetch;

    const client = new GmailClient(makeConfig(), mockFetch);

    const token1 = await client.getAccessToken();
    const token2 = await client.getAccessToken();

    expect(token1).toBe("cached-token");
    expect(token2).toBe("cached-token");
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("refreshes token after 55-minute expiry margin", async () => {
    vi.useFakeTimers();

    let callCount = 0;
    const mockFetch = vi.fn(async () => {
      callCount++;
      return new Response(
        JSON.stringify({
          access_token: `token-${callCount}`,
          expires_in: 3600,
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const client = new GmailClient(makeConfig(), mockFetch);

    const token1 = await client.getAccessToken();
    expect(token1).toBe("token-1");

    // Advance 56 minutes (past the 55-minute safety margin)
    vi.advanceTimersByTime(56 * 60 * 1000);

    const token2 = await client.getAccessToken();
    expect(token2).toBe("token-2");
    expect(mockFetch).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// listMessages
// ---------------------------------------------------------------------------

describe("GmailClient - listMessages", () => {
  it("fetches message IDs with correct query params", async () => {
    let capturedUrl = "";
    const mockFetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
      if (urlStr.includes("oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), {
          status: 200,
        });
      }
      capturedUrl = urlStr;
      return new Response(
        JSON.stringify({
          messages: [{ id: "msg1" }, { id: "msg2" }],
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const client = new GmailClient(makeConfig(), mockFetch);
    const ids = await client.listMessages("newer_than:1d", 20);

    expect(ids).toEqual(["msg1", "msg2"]);
    expect(capturedUrl).toContain("q=newer_than%3A1d");
    expect(capturedUrl).toContain("maxResults=20");
  });

  it("returns empty array when no messages match", async () => {
    const mockFetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
      if (urlStr.includes("oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), {
          status: 200,
        });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    }) as unknown as typeof fetch;

    const client = new GmailClient(makeConfig(), mockFetch);
    const ids = await client.listMessages("newer_than:1d", 20);

    expect(ids).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getMessages
// ---------------------------------------------------------------------------

describe("GmailClient - getMessages", () => {
  it("fetches all messages concurrently", async () => {
    const fetchedIds: string[] = [];
    const mockFetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
      if (urlStr.includes("oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), {
          status: 200,
        });
      }
      // Extract message ID from URL
      const match = urlStr.match(/messages\/([^?]+)/);
      const id = match?.[1] ?? "unknown";
      fetchedIds.push(id);
      return new Response(JSON.stringify(makeGmailMessage(id)), {
        status: 200,
      });
    }) as unknown as typeof fetch;

    const client = new GmailClient(makeConfig(), mockFetch);
    const ids = ["id1", "id2", "id3", "id4", "id5", "id6"];
    const messages = await client.getMessages(ids);

    expect(messages).toHaveLength(6);
    // All IDs should have been fetched (order may vary due to concurrency)
    for (const id of ids) {
      expect(fetchedIds).toContain(id);
    }
  });

  it("retries on 401 after refreshing token", async () => {
    let tokenCalls = 0;
    let messageCalls = 0;

    const mockFetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
      if (urlStr.includes("oauth2.googleapis.com/token")) {
        tokenCalls++;
        return new Response(
          JSON.stringify({
            access_token: `tok-${tokenCalls}`,
            expires_in: 3600,
          }),
          { status: 200 },
        );
      }

      messageCalls++;
      if (messageCalls === 1) {
        // First call to Gmail API returns 401
        return new Response("Unauthorized", { status: 401 });
      }
      // Subsequent calls succeed
      return new Response(JSON.stringify(makeGmailMessage("msg1")), {
        status: 200,
      });
    }) as unknown as typeof fetch;

    const client = new GmailClient(makeConfig(), mockFetch);
    const messages = await client.getMessages(["msg1"]);

    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe("msg1");
    // Token should have been fetched twice: initial + refresh
    expect(tokenCalls).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Gmail API Errors
// ---------------------------------------------------------------------------

describe("GmailClient - Error Handling", () => {
  it("throws descriptive error on 403 mentioning domain-wide delegation", async () => {
    const mockFetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
      if (urlStr.includes("oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), {
          status: 200,
        });
      }
      return new Response("Forbidden", { status: 403 });
    }) as unknown as typeof fetch;

    const client = new GmailClient(makeConfig(), mockFetch);

    await expect(client.listMessages("test", 10)).rejects.toThrow(/domain-wide delegation/);
  });

  it("throws descriptive error on 429 mentioning rate limit", async () => {
    const mockFetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
      if (urlStr.includes("oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), {
          status: 200,
        });
      }
      return new Response("Too Many Requests", { status: 429 });
    }) as unknown as typeof fetch;

    const client = new GmailClient(makeConfig(), mockFetch);

    await expect(client.listMessages("test", 10)).rejects.toThrow(/rate limit/i);
  });

  it("throws on token exchange failure mentioning Service Account credentials", async () => {
    const mockFetch = vi.fn(async () => {
      return new Response("Bad Request", { status: 400 });
    }) as unknown as typeof fetch;

    const client = new GmailClient(makeConfig(), mockFetch);

    await expect(client.getAccessToken()).rejects.toThrow(/Service Account credentials/);
  });
});

// ---------------------------------------------------------------------------
// resolveGmailConfig
// ---------------------------------------------------------------------------

describe("resolveGmailConfig", () => {
  it("resolves SA config from inline env vars", () => {
    const env = {
      GMAIL_SERVICE_ACCOUNT_KEY: JSON.stringify(fakeServiceAccountKey),
      GMAIL_USER_EMAIL: "user@company.com",
    };

    const config = resolveGmailConfig(undefined, env);

    expect(config.authType).toBe("serviceAccount");
    expect(config.authType === "serviceAccount" && config.serviceAccountKey.client_email).toBe(
      "test@test-project.iam.gserviceaccount.com",
    );
    expect(config.authType === "serviceAccount" && config.userEmail).toBe("user@company.com");
    expect(config.maxEmails).toBe(20);
  });

  it("resolves userEmail from pluginConfig when env not set", () => {
    const env = {
      GMAIL_SERVICE_ACCOUNT_KEY: JSON.stringify(fakeServiceAccountKey),
    };

    const config = resolveGmailConfig({ userEmail: "plugin@company.com" }, env);

    expect(config.authType).toBe("serviceAccount");
    expect(config.authType === "serviceAccount" && config.userEmail).toBe("plugin@company.com");
  });

  it("throws when no credentials are provided", () => {
    expect(() => resolveGmailConfig(undefined, {})).toThrow(/Gmail credentials not found/);
  });

  it("throws when userEmail is missing from both env and config", () => {
    const env = {
      GMAIL_SERVICE_ACCOUNT_KEY: JSON.stringify(fakeServiceAccountKey),
    };

    expect(() => resolveGmailConfig(undefined, env)).toThrow(/Gmail user email not configured/);
  });

  it("resolves OAuth config when all OAuth env vars set", () => {
    const env = {
      GMAIL_CLIENT_ID: "oauth-client-id",
      GMAIL_CLIENT_SECRET: "oauth-client-secret",
      GMAIL_REFRESH_TOKEN: "oauth-refresh-token",
    };

    const config = resolveGmailConfig(undefined, env);

    expect(config.authType).toBe("oauth");
    if (config.authType === "oauth") {
      expect(config.oauthCredentials.clientId).toBe("oauth-client-id");
      expect(config.oauthCredentials.clientSecret).toBe("oauth-client-secret");
      expect(config.oauthCredentials.refreshToken).toBe("oauth-refresh-token");
    }
    expect(config.maxEmails).toBe(20);
  });

  it("does NOT require GMAIL_USER_EMAIL for OAuth", () => {
    const env = {
      GMAIL_CLIENT_ID: "id",
      GMAIL_CLIENT_SECRET: "secret",
      GMAIL_REFRESH_TOKEN: "token",
    };

    // Should not throw — userEmail not needed for OAuth
    const config = resolveGmailConfig(undefined, env);
    expect(config.authType).toBe("oauth");
  });

  it("prefers OAuth when both OAuth and SA env vars are set", () => {
    const env = {
      GMAIL_CLIENT_ID: "id",
      GMAIL_CLIENT_SECRET: "secret",
      GMAIL_REFRESH_TOKEN: "token",
      GMAIL_SERVICE_ACCOUNT_KEY: JSON.stringify(fakeServiceAccountKey),
      GMAIL_USER_EMAIL: "user@company.com",
    };

    const config = resolveGmailConfig(undefined, env);
    expect(config.authType).toBe("oauth");
  });

  it("error message lists both credential options when neither is set", () => {
    expect(() => resolveGmailConfig(undefined, {})).toThrow(/OAuth/);
    expect(() => resolveGmailConfig(undefined, {})).toThrow(/Service Account/);
  });
});

// ---------------------------------------------------------------------------
// Error messages never contain private key
// ---------------------------------------------------------------------------

describe("GmailClient - Private Key Sanitization", () => {
  it("never includes private key material in error messages", async () => {
    // Token exchange failure
    const mockFetch = vi.fn(async () => {
      return new Response(`Error with key ${privateKey.slice(0, 50)}`, {
        status: 400,
      });
    }) as unknown as typeof fetch;

    const client = new GmailClient(makeConfig(), mockFetch);

    try {
      await client.getAccessToken();
    } catch (err) {
      const msg = (err as Error).message;
      expect(msg).not.toContain("-----BEGIN");
    }
  });

  it("resolveGmailConfig errors never include private key", () => {
    const env = {
      GMAIL_SERVICE_ACCOUNT_KEY: `{"client_email":"a@b.com","private_key":"-----BEGIN RSA PRIVATE KEY-----\\nBADKEY"}`,
      GMAIL_USER_EMAIL: "user@test.com",
    };

    // This should NOT throw since the SA key has required fields.
    // But let's test with a really invalid key that might cause signing issues.
    // For resolveGmailConfig specifically, it parses OK but the key would fail at sign time.
    // Instead, test with invalid JSON that includes PEM markers:
    const envBad = {
      GMAIL_SERVICE_ACCOUNT_KEY: `not-json -----BEGIN RSA PRIVATE KEY----- secret`,
      GMAIL_USER_EMAIL: "user@test.com",
    };

    try {
      resolveGmailConfig(undefined, envBad);
    } catch (err) {
      const msg = (err as Error).message;
      expect(msg).not.toContain("-----BEGIN");
    }
  });
});

// ---------------------------------------------------------------------------
// OAuth Refresh Token Auth
// ---------------------------------------------------------------------------

describe("GmailClient - OAuth Refresh Token Auth", () => {
  it("sends grant_type=refresh_token with correct params", async () => {
    let capturedBody = "";

    const mockFetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
      if (urlStr.includes("oauth2.googleapis.com/token")) {
        capturedBody = init?.body as string;
        return new Response(JSON.stringify({ access_token: "oauth-token-123", expires_in: 3600 }), {
          status: 200,
        });
      }
      return new Response("Not found", { status: 404 });
    }) as unknown as typeof fetch;

    const client = new GmailClient(makeOAuthConfig(), mockFetch);
    const token = await client.getAccessToken();

    expect(token).toBe("oauth-token-123");

    const params = new URLSearchParams(capturedBody);
    expect(params.get("grant_type")).toBe("refresh_token");
    expect(params.get("refresh_token")).toBe("test-refresh-token");
    expect(params.get("client_id")).toBe("test-client-id");
    expect(params.get("client_secret")).toBe("test-client-secret");
    // Should NOT contain JWT assertion
    expect(params.get("assertion")).toBeNull();
  });

  it("caches OAuth token and does not re-fetch on second call", async () => {
    const mockFetch = vi.fn(async () => {
      return new Response(JSON.stringify({ access_token: "cached-oauth", expires_in: 3600 }), {
        status: 200,
      });
    }) as unknown as typeof fetch;

    const client = new GmailClient(makeOAuthConfig(), mockFetch);

    const token1 = await client.getAccessToken();
    const token2 = await client.getAccessToken();

    expect(token1).toBe("cached-oauth");
    expect(token2).toBe("cached-oauth");
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("retries on 401 after refreshing OAuth token", async () => {
    let tokenCalls = 0;
    let messageCalls = 0;

    const mockFetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
      if (urlStr.includes("oauth2.googleapis.com/token")) {
        tokenCalls++;
        return new Response(
          JSON.stringify({ access_token: `oauth-tok-${tokenCalls}`, expires_in: 3600 }),
          { status: 200 },
        );
      }

      messageCalls++;
      if (messageCalls === 1) {
        return new Response("Unauthorized", { status: 401 });
      }
      return new Response(JSON.stringify(makeGmailMessage("msg1")), { status: 200 });
    }) as unknown as typeof fetch;

    const client = new GmailClient(makeOAuthConfig(), mockFetch);
    const messages = await client.getMessages(["msg1"]);

    expect(messages).toHaveLength(1);
    expect(tokenCalls).toBe(2);
  });

  it("throws mentioning OAuth credentials on token exchange failure", async () => {
    const mockFetch = vi.fn(async () => {
      return new Response("Bad Request", { status: 400 });
    }) as unknown as typeof fetch;

    const client = new GmailClient(makeOAuthConfig(), mockFetch);

    await expect(client.getAccessToken()).rejects.toThrow(/OAuth credentials/);
  });

  it("throws mentioning insufficient permissions on 403", async () => {
    const mockFetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
      if (urlStr.includes("oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), {
          status: 200,
        });
      }
      return new Response("Forbidden", { status: 403 });
    }) as unknown as typeof fetch;

    const client = new GmailClient(makeOAuthConfig(), mockFetch);

    await expect(client.listMessages("test", 10)).rejects.toThrow(/sufficient permissions/);
  });
});
