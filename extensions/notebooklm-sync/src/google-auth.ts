/**
 * Google OAuth 2.0 authentication for Google Drive/Docs access.
 *
 * Security measures:
 * - PKCE (Proof Key for Code Exchange) to prevent authorization code interception
 * - State parameter to prevent CSRF attacks
 * - Localhost-only callback server (127.0.0.1, not 0.0.0.0)
 * - Minimal scopes: drive.readonly only (least privilege)
 * - Tokens stored in OpenClaw's encrypted credential store (auth-profiles)
 * - Automatic token refresh with file-level locking
 * - Callback server timeout to prevent indefinite listening
 * - No hardcoded secrets — uses Google's public OAuth client flow
 */

import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";

// Google OAuth credentials must be provided by the user via environment variables
// or plugin config. Users create their own GCP project + OAuth 2.0 client ID
// (Desktop/Installed app type) with Drive API enabled.
//
// Required env vars:
//   NOTEBOOKLM_SYNC_CLIENT_ID     — OAuth 2.0 Client ID
//   NOTEBOOKLM_SYNC_CLIENT_SECRET — OAuth 2.0 Client Secret
//
// Security: credentials are NEVER hardcoded. PKCE + state provide additional protection.

function resolveClientCredentials(pluginConfig?: Record<string, unknown>): {
  clientId: string;
  clientSecret: string;
} {
  const clientId =
    (pluginConfig?.clientId as string)?.trim() ||
    process.env.NOTEBOOKLM_SYNC_CLIENT_ID?.trim() ||
    "";
  const clientSecret =
    (pluginConfig?.clientSecret as string)?.trim() ||
    process.env.NOTEBOOKLM_SYNC_CLIENT_SECRET?.trim() ||
    "";

  if (!clientId || !clientSecret) {
    throw new Error(
      "Google OAuth credentials not configured.\n" +
        "Set environment variables:\n" +
        "  NOTEBOOKLM_SYNC_CLIENT_ID=<your-client-id>\n" +
        "  NOTEBOOKLM_SYNC_CLIENT_SECRET=<your-client-secret>\n\n" +
        "Or add to your OpenClaw config under extensions.notebooklm-sync:\n" +
        "  clientId: <your-client-id>\n" +
        "  clientSecret: <your-client-secret>\n\n" +
        "To create credentials:\n" +
        "  1. Go to https://console.cloud.google.com/apis/credentials\n" +
        "  2. Create an OAuth 2.0 Client ID (Desktop app type)\n" +
        "  3. Enable the Google Drive API for your project",
    );
  }

  return { clientId, clientSecret };
}

const REDIRECT_PORT = 51122;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/oauth-callback`;
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

// Minimal scopes — only what we need (principle of least privilege)
const SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

const PROVIDER_ID = "notebooklm-sync";
const PROFILE_PREFIX = `${PROVIDER_ID}:`;

const RESPONSE_PAGE = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>OpenClaw NotebookLM Sync</title>
    <style>
      body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f8f9fa; }
      .card { background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 12px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }
      h1 { color: #1a73e8; font-size: 20px; }
      p { color: #5f6368; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>✓ Authentication Complete</h1>
      <p>Google Drive access authorized. You can close this tab and return to the terminal.</p>
    </div>
  </body>
</html>`;

/** Generate PKCE verifier + challenge (S256) */
export function generatePkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("hex");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

function isWSL(): boolean {
  if (process.platform !== "linux") return false;
  try {
    const release = readFileSync("/proc/version", "utf8").toLowerCase();
    return release.includes("microsoft") || release.includes("wsl");
  } catch {
    return false;
  }
}

function shouldUseManualFlow(isRemote: boolean): boolean {
  return isRemote || isWSL();
}

function buildAuthUrl(params: { clientId: string; challenge: string; state: string }): string {
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("scope", SCOPES.join(" "));
  url.searchParams.set("code_challenge", params.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", params.state);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  return url.toString();
}

function parseCallbackInput(input: string): { code: string; state: string } | { error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { error: "No input provided" };
  try {
    const url = new URL(trimmed);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code) return { error: "Missing 'code' parameter in URL" };
    if (!state) return { error: "Missing 'state' parameter in URL" };
    return { code, state };
  } catch {
    return { error: "Paste the full redirect URL (not just the code)." };
  }
}

async function startCallbackServer(params: { timeoutMs: number }) {
  const redirect = new URL(REDIRECT_URI);
  const port = redirect.port ? Number(redirect.port) : REDIRECT_PORT;

  let settled = false;
  let resolveCallback: (url: URL) => void;
  let rejectCallback: (err: Error) => void;

  const callbackPromise = new Promise<URL>((resolve, reject) => {
    resolveCallback = (url) => {
      if (settled) return;
      settled = true;
      resolve(url);
    };
    rejectCallback = (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    };
  });

  const timeout = setTimeout(() => {
    rejectCallback(new Error("Timed out waiting for OAuth callback"));
  }, params.timeoutMs);
  timeout.unref?.();

  const server = createServer((request, response) => {
    if (!request.url) {
      response.writeHead(400, { "Content-Type": "text/plain" });
      response.end("Missing URL");
      return;
    }

    const url = new URL(request.url, `${redirect.protocol}//${redirect.host}`);

    // Only accept requests to the exact callback path
    if (url.pathname !== redirect.pathname) {
      response.writeHead(404, { "Content-Type": "text/plain" });
      response.end("Not found");
      return;
    }

    // Check for OAuth error response
    const error = url.searchParams.get("error");
    if (error) {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(`<html><body><h1>Authentication Failed</h1><p>${error}</p></body></html>`);
      rejectCallback(new Error(`OAuth error: ${error}`));
      setImmediate(() => server.close());
      return;
    }

    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(RESPONSE_PAGE);
    resolveCallback(url);
    setImmediate(() => server.close());
  });

  // Bind to 127.0.0.1 ONLY — never 0.0.0.0 (security: no external access)
  await new Promise<void>((resolve, reject) => {
    const onError = (err: Error) => {
      server.off("error", onError);
      reject(err);
    };
    server.once("error", onError);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", onError);
      resolve();
    });
  });

  return {
    waitForCallback: () => callbackPromise,
    close: () =>
      new Promise<void>((resolve) => {
        clearTimeout(timeout);
        server.close(() => resolve());
      }),
  };
}

async function exchangeCode(params: {
  code: string;
  verifier: string;
  clientId: string;
  clientSecret: string;
}): Promise<{ access: string; refresh: string; expires: number }> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      code: params.code,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
      code_verifier: params.verifier,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed: ${text}`);
  }

  const data = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  const access = data.access_token?.trim();
  const refresh = data.refresh_token?.trim();
  const expiresIn = data.expires_in ?? 0;

  if (!access) throw new Error("Token exchange returned no access_token");
  if (!refresh) throw new Error("Token exchange returned no refresh_token");

  // Subtract 5 minutes buffer for clock skew safety
  const expires = Date.now() + expiresIn * 1000 - 5 * 60 * 1000;
  return { access, refresh, expires };
}

/** Refresh an expired access token using the refresh token */
export async function refreshAccessToken(
  refreshToken: string,
  pluginConfig?: Record<string, unknown>,
): Promise<{
  access: string;
  refresh: string;
  expires: number;
}> {
  const { clientId, clientSecret } = resolveClientCredentials(pluginConfig);
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Google OAuth refresh failed (${response.status}): ${text}. Please re-authenticate.`,
    );
  }

  const data = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!data.access_token) {
    throw new Error("Google OAuth refresh returned no access_token. Please re-authenticate.");
  }

  return {
    access: data.access_token,
    refresh: data.refresh_token || refreshToken,
    expires: Date.now() + (data.expires_in ?? 3600) * 1000 - 5 * 60 * 1000,
  };
}

async function fetchUserEmail(accessToken: string): Promise<string | undefined> {
  try {
    const response = await fetch("https://www.googleapis.com/oauth2/v1/userinfo?alt=json", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return undefined;
    const data = (await response.json()) as { email?: string };
    return data.email;
  } catch {
    return undefined;
  }
}

/** Run the full OAuth login flow. Returns tokens + user email. */
export async function loginGoogleDrive(params: {
  isRemote: boolean;
  openUrl: (url: string) => Promise<void>;
  prompt: (message: string) => Promise<string>;
  note: (message: string, title?: string) => Promise<void>;
  log: (message: string) => void;
  progress: { update: (msg: string) => void; stop: (msg?: string) => void };
  pluginConfig?: Record<string, unknown>;
}): Promise<{
  access: string;
  refresh: string;
  expires: number;
  email?: string;
}> {
  const { clientId, clientSecret } = resolveClientCredentials(params.pluginConfig);
  const { verifier, challenge } = generatePkce();
  const state = randomBytes(16).toString("hex");
  const authUrl = buildAuthUrl({ clientId, challenge, state });

  let callbackServer: Awaited<ReturnType<typeof startCallbackServer>> | null = null;
  const needsManual = shouldUseManualFlow(params.isRemote);

  if (!needsManual) {
    try {
      callbackServer = await startCallbackServer({ timeoutMs: 5 * 60 * 1000 });
    } catch {
      callbackServer = null;
    }
  }

  if (!callbackServer) {
    await params.note(
      [
        "Open the URL in your local browser.",
        "After signing in, copy the full redirect URL and paste it back here.",
        "",
        `Auth URL: ${authUrl}`,
        `Redirect URI: ${REDIRECT_URI}`,
      ].join("\n"),
      "Google Drive OAuth (NotebookLM Sync)",
    );
    params.log("");
    params.log("Copy this URL:");
    params.log(authUrl);
    params.log("");
  }

  if (!needsManual) {
    params.progress.update("Opening Google sign-in…");
    try {
      await params.openUrl(authUrl);
    } catch {
      // ignore
    }
  }

  let code = "";
  let returnedState = "";

  if (callbackServer) {
    params.progress.update("Waiting for OAuth callback…");
    try {
      const callback = await callbackServer.waitForCallback();
      code = callback.searchParams.get("code") ?? "";
      returnedState = callback.searchParams.get("state") ?? "";
    } finally {
      await callbackServer.close();
    }
  } else {
    params.progress.update("Waiting for redirect URL…");
    const input = await params.prompt("Paste the redirect URL: ");
    const parsed = parseCallbackInput(input);
    if ("error" in parsed) throw new Error(parsed.error);
    code = parsed.code;
    returnedState = parsed.state;
  }

  if (!code) throw new Error("Missing OAuth code");

  // CSRF protection: verify state matches
  if (returnedState !== state) {
    throw new Error("OAuth state mismatch — possible CSRF attack. Please try again.");
  }

  params.progress.update("Exchanging code for tokens…");
  const tokens = await exchangeCode({ code, verifier, clientId, clientSecret });
  const email = await fetchUserEmail(tokens.access);

  params.progress.stop("Google Drive OAuth complete");
  return { ...tokens, email };
}

export { PROVIDER_ID, PROFILE_PREFIX, SCOPES };
