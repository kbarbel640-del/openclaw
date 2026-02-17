import { createHash, randomBytes } from "node:crypto";
import type { OpenClawPluginApi, ProviderAuthContext } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

// OAuth constants (from Anthropic's public PKCE client)
const decode = (s: string) => Buffer.from(s, "base64").toString();
const CLIENT_ID = decode("OWQxYzI1MGEtZTYxYi00NGQ5LTg4ZWQtNTk0NGQxOTYyZjVl");
const AUTHORIZE_URL = "https://claude.ai/oauth/authorize";
const TOKEN_URL = "https://console.anthropic.com/v1/oauth/token";
const REDIRECT_URI = "https://console.anthropic.com/oauth/code/callback";
const SCOPES = "org:create_api_key user:profile user:inference";

const PROVIDER_ID = "anthropic";
const PROVIDER_LABEL = "Anthropic";

function generatePkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  const challenge = createHash("sha256")
    .update(verifier)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  return { verifier, challenge };
}

function buildAuthUrl(params: { challenge: string; state: string }): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

async function exchangeCode(params: {
  code: string;
  state: string;
  verifier: string;
}): Promise<{ access: string; refresh: string; expires: number }> {
  const body: Record<string, string> = {
    client_id: CLIENT_ID,
    code: params.code,
    grant_type: "authorization_code",
    redirect_uri: REDIRECT_URI,
    code_verifier: params.verifier,
  };
  // Anthropic requires state in the token exchange
  if (params.state) {
    body.state = params.state;
  }

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  const access = data.access_token?.trim();
  const refresh = data.refresh_token?.trim();
  const expiresIn = data.expires_in ?? 0;

  if (!access) {
    throw new Error("Token exchange returned no access_token");
  }
  if (!refresh) {
    throw new Error("Token exchange returned no refresh_token");
  }

  return {
    access,
    refresh,
    expires: Date.now() + expiresIn * 1000 - 5 * 60 * 1000,
  };
}

/**
 * Parse user-pasted authorization input.
 * Anthropic returns code#state format. Also accepts:
 * - A full redirect URL with ?code=...&state=...
 * - Just a raw code (state extracted from original request)
 */
function parseAuthInput(input: string): { code: string; state: string } {
  const trimmed = input.trim();

  // Try parsing as a URL first (user may paste the full redirect URL)
  try {
    const url = new URL(trimmed);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (code) {
      return { code, state: state ?? "" };
    }
  } catch {
    // Not a URL, try code#state format
  }

  // Handle code#state format (Anthropic's standard response format)
  const hashIdx = trimmed.indexOf("#");
  if (hashIdx > 0) {
    return {
      code: trimmed.slice(0, hashIdx).trim(),
      state: trimmed.slice(hashIdx + 1).trim(),
    };
  }

  return { code: trimmed, state: "" };
}

async function loginAnthropic(params: {
  openUrl: (url: string) => Promise<void>;
  prompt: (message: string) => Promise<string>;
  progress: { update: (msg: string) => void; stop: (msg?: string) => void };
}): Promise<{
  access: string;
  refresh: string;
  expires: number;
}> {
  const { verifier, challenge } = generatePkce();
  const state = randomBytes(16).toString("hex");
  const authUrl = buildAuthUrl({ challenge, state });

  params.progress.update("Opening Anthropic sign-in...");
  await params.openUrl(authUrl);

  params.progress.update("Waiting for authorization code...");
  const rawInput = await params.prompt(
    "After signing in, paste the authorization code shown on the page:",
  );

  const parsed = parseAuthInput(rawInput);
  if (!parsed.code) {
    throw new Error("No authorization code provided");
  }

  // Use the state from the pasted input if present, otherwise use the original
  const returnedState = parsed.state || state;

  params.progress.update("Exchanging code for tokens...");
  const tokens = await exchangeCode({
    code: parsed.code,
    state: returnedState,
    verifier,
  });

  return tokens;
}

const anthropicAuthPlugin = {
  id: "anthropic-auth",
  name: "Anthropic OAuth",
  description: "OAuth flow for Anthropic (Claude Pro/Max subscription)",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    api.registerProvider({
      id: PROVIDER_ID,
      label: PROVIDER_LABEL,
      docsPath: "/providers/anthropic",
      aliases: [],
      auth: [
        {
          id: "oauth",
          label: "Anthropic OAuth",
          hint: "Sign in with Claude Pro/Max",
          kind: "oauth",
          run: async (ctx: ProviderAuthContext) => {
            const spin = ctx.prompter.progress("Starting Anthropic OAuth...");
            try {
              const result = await loginAnthropic({
                openUrl: ctx.openUrl,
                prompt: async (message) => String(await ctx.prompter.text({ message })),
                progress: spin,
              });

              spin.stop("Anthropic OAuth complete");

              const profileId = `${PROVIDER_ID}:oauth`;
              return {
                profiles: [
                  {
                    profileId,
                    credential: {
                      type: "oauth",
                      provider: PROVIDER_ID,
                      access: result.access,
                      refresh: result.refresh,
                      expires: result.expires,
                    },
                  },
                ],
                configPatch: {},
                notes: ["Anthropic OAuth tokens auto-refresh. Re-run login if refresh fails."],
              };
            } catch (err) {
              spin.stop("Anthropic OAuth failed");
              throw err;
            }
          },
        },
      ],
    });
  },
};

export default anthropicAuthPlugin;
