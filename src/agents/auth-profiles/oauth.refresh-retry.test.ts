import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CodexCliCredential } from "../cli-credentials.js";
import { resolveApiKeyForProfile } from "./oauth.js";
import type { AuthProfileStore, OAuthCredential } from "./types.js";

const mocks = vi.hoisted(() => ({
  getOAuthApiKey: vi.fn(),
  readCodexCliCredentialsCached: vi.fn(),
}));

vi.mock("@mariozechner/pi-ai", async () => {
  const actual = await vi.importActual<typeof import("@mariozechner/pi-ai")>("@mariozechner/pi-ai");
  return {
    ...actual,
    getOAuthApiKey: mocks.getOAuthApiKey,
  };
});

vi.mock("../cli-credentials.js", async () => {
  const actual =
    await vi.importActual<typeof import("../cli-credentials.js")>("../cli-credentials.js");
  return {
    ...actual,
    readCodexCliCredentialsCached: mocks.readCodexCliCredentialsCached,
  };
});

const AUTH_PROFILE_FILENAME = "auth-profiles.json";

function createOAuthStore(profileId: string, credential: OAuthCredential): AuthProfileStore {
  return {
    version: 1,
    profiles: {
      [profileId]: credential,
    },
  };
}

describe("oauth refresh retries and codex external credential sync", () => {
  let tempDir: string;
  let agentDir: string;

  async function writeStore(store: AuthProfileStore) {
    await fs.writeFile(
      path.join(agentDir, AUTH_PROFILE_FILENAME),
      `${JSON.stringify(store, null, 2)}\n`,
      "utf8",
    );
  }

  async function readStore(): Promise<AuthProfileStore> {
    return JSON.parse(
      await fs.readFile(path.join(agentDir, AUTH_PROFILE_FILENAME), "utf8"),
    ) as AuthProfileStore;
  }

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "oauth-refresh-retry-test-"));
    agentDir = path.join(tempDir, "agent");
    await fs.mkdir(agentDir, { recursive: true });
    mocks.getOAuthApiKey.mockReset();
    mocks.readCodexCliCredentialsCached.mockReset();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("adopts fresher external codex credentials after a transient refresh failure", async () => {
    const profileId = "openai-codex:default";
    const store = createOAuthStore(profileId, {
      type: "oauth",
      provider: "openai-codex",
      access: "stale-access",
      refresh: "stale-refresh",
      expires: Date.now() - 30_000,
      accountId: "acct-team-1",
    });
    await writeStore(store);

    const externalCred: CodexCliCredential = {
      type: "oauth",
      provider: "openai-codex",
      access: "external-access",
      refresh: "external-refresh",
      expires: Date.now() + 10 * 60_000,
      accountId: "acct-team-1",
    };

    mocks.readCodexCliCredentialsCached
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(externalCred)
      .mockReturnValue(externalCred);
    mocks.getOAuthApiKey.mockRejectedValueOnce(
      new Error("Failed to refresh OAuth token for openai-codex"),
    );

    const result = await resolveApiKeyForProfile({
      store,
      profileId,
      agentDir,
    });

    expect(result).toEqual({
      apiKey: "external-access",
      provider: "openai-codex",
      email: undefined,
    });
    expect(mocks.getOAuthApiKey).toHaveBeenCalledTimes(1);

    const persistedStore = await readStore();
    expect(persistedStore.profiles[profileId]).toMatchObject({
      access: "external-access",
      refresh: "external-refresh",
      accountId: "acct-team-1",
    });
  });

  it("fails fast for non-transient refresh errors on non-codex providers", async () => {
    const profileId = "anthropic:default";
    const store = createOAuthStore(profileId, {
      type: "oauth",
      provider: "anthropic",
      access: "stale-access",
      refresh: "stale-refresh",
      expires: Date.now() - 30_000,
    });
    await writeStore(store);

    mocks.getOAuthApiKey.mockRejectedValueOnce(new Error("invalid_grant"));

    await expect(
      resolveApiKeyForProfile({
        store,
        profileId,
        agentDir,
      }),
    ).rejects.toThrow(/OAuth token refresh failed for anthropic/);

    expect(mocks.getOAuthApiKey).toHaveBeenCalledTimes(1);
    expect(mocks.readCodexCliCredentialsCached).not.toHaveBeenCalled();
  });

  it("refuses to overwrite codex credentials when external account does not match", async () => {
    const profileId = "openai-codex:default";
    const store = createOAuthStore(profileId, {
      type: "oauth",
      provider: "openai-codex",
      access: "stale-access",
      refresh: "stale-refresh",
      expires: Date.now() - 30_000,
      accountId: "acct-primary",
    });
    await writeStore(store);

    mocks.readCodexCliCredentialsCached.mockReturnValue({
      type: "oauth",
      provider: "openai-codex",
      access: "external-access",
      refresh: "external-refresh",
      expires: Date.now() + 10 * 60_000,
      accountId: "acct-secondary",
    } satisfies CodexCliCredential);
    mocks.getOAuthApiKey.mockRejectedValue(
      new Error("Failed to refresh OAuth token for openai-codex"),
    );

    await expect(
      resolveApiKeyForProfile({
        store,
        profileId,
        agentDir,
      }),
    ).rejects.toThrow(/OAuth token refresh failed for openai-codex/);

    expect(mocks.getOAuthApiKey).toHaveBeenCalledTimes(3);

    const persistedStore = await readStore();
    expect(persistedStore.profiles[profileId]).toMatchObject({
      access: "stale-access",
      refresh: "stale-refresh",
      accountId: "acct-primary",
    });
  });
});
