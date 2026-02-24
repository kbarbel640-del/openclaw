import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeEnv } from "../runtime.js";
import type { WizardPrompter } from "../wizard/prompts.js";

const mocks = vi.hoisted(() => ({
  loginOpenAICodex: vi.fn(),
  createVpsAwareOAuthHandlers: vi.fn(),
}));

vi.mock("@mariozechner/pi-ai", () => ({
  loginOpenAICodex: mocks.loginOpenAICodex,
}));

vi.mock("./oauth-flow.js", () => ({
  createVpsAwareOAuthHandlers: mocks.createVpsAwareOAuthHandlers,
}));

import { extractEmailFromCodexToken, loginOpenAICodexOAuth } from "./openai-codex-oauth.js";

/** Build a minimal JWT with the given payload (no signature verification needed). */
function buildJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.fake-signature`;
}

function createPrompter() {
  const spin = { update: vi.fn(), stop: vi.fn() };
  const prompter: Pick<WizardPrompter, "note" | "progress"> = {
    note: vi.fn(async () => {}),
    progress: vi.fn(() => spin),
  };
  return { prompter: prompter as unknown as WizardPrompter, spin };
}

function createRuntime(): RuntimeEnv {
  return {
    log: vi.fn(),
    error: vi.fn(),
    exit: vi.fn((code: number) => {
      throw new Error(`exit:${code}`);
    }),
  };
}

describe("loginOpenAICodexOAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns credentials on successful oauth login", async () => {
    const creds = {
      provider: "openai-codex" as const,
      access: "access-token",
      refresh: "refresh-token",
      expires: Date.now() + 60_000,
      email: "user@example.com",
    };
    mocks.createVpsAwareOAuthHandlers.mockReturnValue({
      onAuth: vi.fn(),
      onPrompt: vi.fn(),
    });
    mocks.loginOpenAICodex.mockResolvedValue(creds);

    const { prompter, spin } = createPrompter();
    const runtime = createRuntime();
    const result = await loginOpenAICodexOAuth({
      prompter,
      runtime,
      isRemote: false,
      openUrl: async () => {},
    });

    expect(result).toEqual(creds);
    expect(mocks.loginOpenAICodex).toHaveBeenCalledOnce();
    expect(spin.stop).toHaveBeenCalledWith("OpenAI OAuth complete");
    expect(runtime.error).not.toHaveBeenCalled();
  });

  it("reports oauth errors and rethrows", async () => {
    mocks.createVpsAwareOAuthHandlers.mockReturnValue({
      onAuth: vi.fn(),
      onPrompt: vi.fn(),
    });
    mocks.loginOpenAICodex.mockRejectedValue(new Error("oauth failed"));

    const { prompter, spin } = createPrompter();
    const runtime = createRuntime();
    await expect(
      loginOpenAICodexOAuth({
        prompter,
        runtime,
        isRemote: true,
        openUrl: async () => {},
      }),
    ).rejects.toThrow("oauth failed");

    expect(spin.stop).toHaveBeenCalledWith("OpenAI OAuth failed");
    expect(runtime.error).toHaveBeenCalledWith(expect.stringContaining("oauth failed"));
    expect(prompter.note).toHaveBeenCalledWith(
      "Trouble with OAuth? See https://docs.openclaw.ai/start/faq",
      "OAuth help",
    );
  });

  it("enriches credentials with email extracted from JWT access token", async () => {
    const accessToken = buildJwt({
      "https://api.openai.com/profile": { email: "teamuser@agency.com" },
      "https://api.openai.com/auth": { chatgpt_account_id: "acct_shared_team" },
    });
    const creds = {
      access: accessToken,
      refresh: "refresh-token",
      expires: Date.now() + 60_000,
      accountId: "acct_shared_team",
    };
    mocks.createVpsAwareOAuthHandlers.mockReturnValue({
      onAuth: vi.fn(),
      onPrompt: vi.fn(),
    });
    mocks.loginOpenAICodex.mockResolvedValue(creds);

    const { prompter } = createPrompter();
    const runtime = createRuntime();
    const result = await loginOpenAICodexOAuth({
      prompter,
      runtime,
      isRemote: false,
      openUrl: async () => {},
    });

    expect(result).not.toBeNull();
    expect(result?.email).toBe("teamuser@agency.com");
  });

  it("does not overwrite pre-existing email on credentials", async () => {
    const accessToken = buildJwt({
      "https://api.openai.com/profile": { email: "jwt@agency.com" },
    });
    const creds = {
      access: accessToken,
      refresh: "refresh-token",
      expires: Date.now() + 60_000,
      email: "existing@agency.com",
    };
    mocks.createVpsAwareOAuthHandlers.mockReturnValue({
      onAuth: vi.fn(),
      onPrompt: vi.fn(),
    });
    mocks.loginOpenAICodex.mockResolvedValue(creds);

    const { prompter } = createPrompter();
    const runtime = createRuntime();
    const result = await loginOpenAICodexOAuth({
      prompter,
      runtime,
      isRemote: false,
      openUrl: async () => {},
    });

    expect(result?.email).toBe("existing@agency.com");
  });
});

describe("extractEmailFromCodexToken", () => {
  it("extracts email from OpenAI profile claim", () => {
    const token = buildJwt({
      "https://api.openai.com/profile": { email: "user1@agency.com" },
      "https://api.openai.com/auth": { chatgpt_account_id: "acct_shared" },
    });
    expect(extractEmailFromCodexToken(token)).toBe("user1@agency.com");
  });

  it("extracts email from standard OIDC email claim", () => {
    const token = buildJwt({
      email: "user2@agency.com",
      "https://api.openai.com/auth": { chatgpt_account_id: "acct_shared" },
    });
    expect(extractEmailFromCodexToken(token)).toBe("user2@agency.com");
  });

  it("prefers OpenAI profile claim over OIDC email claim", () => {
    const token = buildJwt({
      email: "oidc@example.com",
      "https://api.openai.com/profile": { email: "profile@example.com" },
    });
    expect(extractEmailFromCodexToken(token)).toBe("profile@example.com");
  });

  it("normalizes email to lowercase", () => {
    const token = buildJwt({
      "https://api.openai.com/profile": { email: "  User@Agency.COM  " },
    });
    expect(extractEmailFromCodexToken(token)).toBe("user@agency.com");
  });

  it("returns undefined for token without email claims", () => {
    const token = buildJwt({
      "https://api.openai.com/auth": { chatgpt_account_id: "acct_123" },
    });
    expect(extractEmailFromCodexToken(token)).toBeUndefined();
  });

  it("returns undefined for empty or whitespace-only email", () => {
    const token = buildJwt({
      "https://api.openai.com/profile": { email: "  " },
    });
    expect(extractEmailFromCodexToken(token)).toBeUndefined();
  });

  it("returns undefined for non-string email", () => {
    const token = buildJwt({
      "https://api.openai.com/profile": { email: 42 },
    });
    expect(extractEmailFromCodexToken(token)).toBeUndefined();
  });

  it("returns undefined for malformed tokens", () => {
    expect(extractEmailFromCodexToken("not-a-jwt")).toBeUndefined();
    expect(extractEmailFromCodexToken("")).toBeUndefined();
    expect(extractEmailFromCodexToken("a.b")).toBeUndefined();
  });

  it("two users from same Team produce different emails", () => {
    const sharedAccountId = "acct_TEAM_123";
    const token1 = buildJwt({
      "https://api.openai.com/profile": { email: "user1@agency.com" },
      "https://api.openai.com/auth": { chatgpt_account_id: sharedAccountId },
    });
    const token2 = buildJwt({
      "https://api.openai.com/profile": { email: "user2@agency.com" },
      "https://api.openai.com/auth": { chatgpt_account_id: sharedAccountId },
    });
    expect(extractEmailFromCodexToken(token1)).toBe("user1@agency.com");
    expect(extractEmailFromCodexToken(token2)).toBe("user2@agency.com");
    expect(extractEmailFromCodexToken(token1)).not.toBe(extractEmailFromCodexToken(token2));
  });

  it("handles unpadded base64url-encoded JWT payload", () => {
    // Build a token with base64url encoding (no padding, url-safe chars)
    const payload = { "https://api.openai.com/profile": { email: "unpadded@test.com" } };
    const header = Buffer.from(JSON.stringify({ alg: "RS256" })).toString("base64url");
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const token = `${header}.${body}.sig`;
    expect(extractEmailFromCodexToken(token)).toBe("unpadded@test.com");
  });
});
