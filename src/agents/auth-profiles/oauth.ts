import {
  getOAuthApiKey,
  getOAuthProviders,
  type OAuthCredentials,
  type OAuthProvider,
} from "@mariozechner/pi-ai";
import type { OpenClawConfig } from "../../config/config.js";
import { withFileLock } from "../../infra/file-lock.js";
import { refreshQwenPortalCredentials } from "../../providers/qwen-portal-oauth.js";
import { sleep } from "../../utils.js";
import { refreshChutesTokens } from "../chutes-oauth.js";
import { readCodexCliCredentialsCached } from "../cli-credentials.js";
import { AUTH_STORE_LOCK_OPTIONS, log } from "./constants.js";
import { formatAuthDoctorHint } from "./doctor.js";
import { ensureAuthStoreFile, resolveAuthStorePath } from "./paths.js";
import { suggestOAuthProfileIdForLegacyDefault } from "./repair.js";
import { ensureAuthProfileStore, saveAuthProfileStore } from "./store.js";
import type { AuthProfileStore } from "./types.js";

const OAUTH_PROVIDER_IDS = new Set<string>(getOAuthProviders().map((provider) => provider.id));

const isOAuthProvider = (provider: string): provider is OAuthProvider =>
  OAUTH_PROVIDER_IDS.has(provider);

const resolveOAuthProvider = (provider: string): OAuthProvider | null =>
  isOAuthProvider(provider) ? provider : null;

const OAUTH_REFRESH_MAX_ATTEMPTS = 3;
const OAUTH_REFRESH_RETRY_BASE_DELAY_MS = 150;
const OAUTH_REFRESH_RETRY_MAX_DELAY_MS = 600;
const RETRYABLE_OAUTH_REFRESH_ERROR_MARKERS = [
  "refresh_token_reused",
  "temporar",
  "timeout",
  "timed out",
  "network",
  "fetch",
  "econn",
  "etimedout",
  "eai_again",
  "rate limit",
  "429",
  "5xx",
];
const NON_RETRYABLE_OAUTH_REFRESH_ERROR_MARKERS = [
  "invalid_grant",
  "invalid_request",
  "unauthorized",
  "forbidden",
  "not found",
  "re-authenticate",
];

/** Bearer-token auth modes that are interchangeable (oauth tokens and raw tokens). */
const BEARER_AUTH_MODES = new Set(["oauth", "token"]);

const isCompatibleModeType = (mode: string | undefined, type: string | undefined): boolean => {
  if (!mode || !type) {
    return false;
  }
  if (mode === type) {
    return true;
  }
  // Both token and oauth represent bearer-token auth paths — allow bidirectional compat.
  return BEARER_AUTH_MODES.has(mode) && BEARER_AUTH_MODES.has(type);
};

function isProfileConfigCompatible(params: {
  cfg?: OpenClawConfig;
  profileId: string;
  provider: string;
  mode: "api_key" | "token" | "oauth";
  allowOAuthTokenCompatibility?: boolean;
}): boolean {
  const profileConfig = params.cfg?.auth?.profiles?.[params.profileId];
  if (profileConfig && profileConfig.provider !== params.provider) {
    return false;
  }
  if (profileConfig && !isCompatibleModeType(profileConfig.mode, params.mode)) {
    return false;
  }
  return true;
}

function buildOAuthApiKey(provider: string, credentials: OAuthCredentials): string {
  const needsProjectId = provider === "google-gemini-cli";
  return needsProjectId
    ? JSON.stringify({
        token: credentials.access,
        projectId: credentials.projectId,
      })
    : credentials.access;
}

function buildApiKeyProfileResult(params: { apiKey: string; provider: string; email?: string }) {
  return {
    apiKey: params.apiKey,
    provider: params.provider,
    email: params.email,
  };
}

function buildOAuthProfileResult(params: {
  provider: string;
  credentials: OAuthCredentials;
  email?: string;
}) {
  return buildApiKeyProfileResult({
    apiKey: buildOAuthApiKey(params.provider, params.credentials),
    provider: params.provider,
    email: params.email,
  });
}

function isExpiredCredential(expires: number | undefined): boolean {
  return (
    typeof expires === "number" && Number.isFinite(expires) && expires > 0 && Date.now() >= expires
  );
}

type ResolveApiKeyForProfileParams = {
  cfg?: OpenClawConfig;
  store: AuthProfileStore;
  profileId: string;
  agentDir?: string;
};

type StoredOAuthCredential = OAuthCredentials & { type: "oauth"; provider: string; email?: string };

function normalizeAccountId(accountId: string | undefined): string | null {
  if (typeof accountId !== "string") {
    return null;
  }
  const normalized = accountId.trim();
  return normalized.length > 0 ? normalized : null;
}

function isMatchingAccountId(
  currentAccountId: string | undefined,
  externalAccountId: string | undefined,
): boolean {
  const current = normalizeAccountId(currentAccountId);
  const external = normalizeAccountId(externalAccountId);
  if (!current && !external) {
    return true;
  }
  if (!current || !external) {
    return false;
  }
  return current === external;
}

function isNewerOAuthCredential(
  currentExpires: number | undefined,
  candidateExpires: number,
): boolean {
  const current = Number.isFinite(currentExpires) ? currentExpires : Number.NEGATIVE_INFINITY;
  return Number.isFinite(candidateExpires) && candidateExpires > current;
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return String(error);
}

function resolveOAuthRefreshRetryDelayMs(attempt: number): number {
  const normalizedAttempt = Math.max(1, attempt);
  return Math.min(
    OAUTH_REFRESH_RETRY_MAX_DELAY_MS,
    OAUTH_REFRESH_RETRY_BASE_DELAY_MS * 2 ** (normalizedAttempt - 1),
  );
}

function shouldRetryOAuthRefreshFailure(provider: string, error: unknown): boolean {
  if (provider === "openai-codex") {
    // openai-codex failures can mask transient refresh_token races in upstream tooling.
    return true;
  }

  const message = extractErrorMessage(error).toLowerCase();
  if (!message) {
    return false;
  }

  if (NON_RETRYABLE_OAUTH_REFRESH_ERROR_MARKERS.some((marker) => message.includes(marker))) {
    return false;
  }

  if (/\b5\d\d\b/.test(message)) {
    return true;
  }

  return RETRYABLE_OAUTH_REFRESH_ERROR_MARKERS.some((marker) => message.includes(marker));
}

function adoptNewerCodexExternalCredential(params: {
  store: AuthProfileStore;
  profileId: string;
  agentDir?: string;
  cred: StoredOAuthCredential;
  phase: "before-refresh" | "after-refresh-failure";
}): StoredOAuthCredential | null {
  if (params.cred.provider !== "openai-codex") {
    return null;
  }

  const externalCred = readCodexCliCredentialsCached({ ttlMs: 0 });
  if (!externalCred) {
    return null;
  }

  if (!isMatchingAccountId(params.cred.accountId, externalCred.accountId)) {
    log.debug("skipped codex external credential sync due to account mismatch", {
      profileId: params.profileId,
      phase: params.phase,
    });
    return null;
  }

  if (!isNewerOAuthCredential(params.cred.expires, externalCred.expires)) {
    return null;
  }

  const merged: StoredOAuthCredential = {
    ...params.cred,
    ...externalCred,
    type: "oauth",
    provider: "openai-codex",
  };
  params.store.profiles[params.profileId] = merged;
  saveAuthProfileStore(params.store, params.agentDir);
  log.info("adopted newer openai-codex credentials from external cli", {
    profileId: params.profileId,
    phase: params.phase,
    expires: new Date(merged.expires).toISOString(),
  });

  return merged;
}

function adoptNewerMainOAuthCredential(params: {
  store: AuthProfileStore;
  profileId: string;
  agentDir?: string;
  cred: StoredOAuthCredential;
}): StoredOAuthCredential | null {
  if (!params.agentDir) {
    return null;
  }
  try {
    const mainStore = ensureAuthProfileStore(undefined);
    const mainCred = mainStore.profiles[params.profileId];
    if (
      mainCred?.type === "oauth" &&
      mainCred.provider === params.cred.provider &&
      Number.isFinite(mainCred.expires) &&
      (!Number.isFinite(params.cred.expires) || mainCred.expires > params.cred.expires)
    ) {
      params.store.profiles[params.profileId] = { ...mainCred };
      saveAuthProfileStore(params.store, params.agentDir);
      log.info("adopted newer OAuth credentials from main agent", {
        profileId: params.profileId,
        agentDir: params.agentDir,
        expires: new Date(mainCred.expires).toISOString(),
      });
      return mainCred;
    }
  } catch (err) {
    // Best-effort: don't crash if main agent store is missing or unreadable.
    log.debug("adoptNewerMainOAuthCredential failed", {
      profileId: params.profileId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return null;
}

async function refreshOAuthCredential(
  cred: StoredOAuthCredential,
): Promise<{ apiKey: string; newCredentials: OAuthCredentials } | null> {
  const oauthCreds: Record<string, OAuthCredentials> = {
    [cred.provider]: cred,
  };

  if (String(cred.provider) === "chutes") {
    const newCredentials = await refreshChutesTokens({
      credential: cred,
    });
    return { apiKey: newCredentials.access, newCredentials };
  }

  if (String(cred.provider) === "qwen-portal") {
    const newCredentials = await refreshQwenPortalCredentials(cred);
    return { apiKey: newCredentials.access, newCredentials };
  }

  const oauthProvider = resolveOAuthProvider(cred.provider);
  if (!oauthProvider) {
    return null;
  }
  return getOAuthApiKey(oauthProvider, oauthCreds);
}

async function refreshOAuthTokenWithLock(params: {
  profileId: string;
  agentDir?: string;
}): Promise<{ apiKey: string; newCredentials: OAuthCredentials } | null> {
  const authPath = resolveAuthStorePath(params.agentDir);
  ensureAuthStoreFile(authPath);

  return await withFileLock(authPath, AUTH_STORE_LOCK_OPTIONS, async () => {
    const store = ensureAuthProfileStore(params.agentDir);
    const cred = store.profiles[params.profileId];
    if (!cred || cred.type !== "oauth") {
      return null;
    }

    let activeCredential: StoredOAuthCredential = cred;
    const syncedBeforeRefresh = adoptNewerCodexExternalCredential({
      store,
      profileId: params.profileId,
      agentDir: params.agentDir,
      cred: activeCredential,
      phase: "before-refresh",
    });
    if (syncedBeforeRefresh) {
      activeCredential = syncedBeforeRefresh;
    }

    if (Date.now() < activeCredential.expires) {
      return {
        apiKey: buildOAuthApiKey(activeCredential.provider, activeCredential),
        newCredentials: activeCredential,
      };
    }

    for (let attempt = 1; attempt <= OAUTH_REFRESH_MAX_ATTEMPTS; attempt += 1) {
      try {
        const result = await refreshOAuthCredential(activeCredential);
        if (!result) {
          return null;
        }
        const mergedCredential: StoredOAuthCredential = {
          ...activeCredential,
          ...result.newCredentials,
          type: "oauth",
        };
        store.profiles[params.profileId] = mergedCredential;
        saveAuthProfileStore(store, params.agentDir);
        return {
          apiKey: result.apiKey,
          newCredentials: mergedCredential,
        };
      } catch (error) {
        const syncedAfterFailure = adoptNewerCodexExternalCredential({
          store,
          profileId: params.profileId,
          agentDir: params.agentDir,
          cred: activeCredential,
          phase: "after-refresh-failure",
        });
        if (syncedAfterFailure && Date.now() < syncedAfterFailure.expires) {
          return {
            apiKey: buildOAuthApiKey(syncedAfterFailure.provider, syncedAfterFailure),
            newCredentials: syncedAfterFailure,
          };
        }

        if (
          attempt >= OAUTH_REFRESH_MAX_ATTEMPTS ||
          !shouldRetryOAuthRefreshFailure(activeCredential.provider, error)
        ) {
          throw error;
        }

        const delayMs = resolveOAuthRefreshRetryDelayMs(attempt);
        log.warn("oauth token refresh failed; retrying", {
          profileId: params.profileId,
          provider: activeCredential.provider,
          attempt,
          maxAttempts: OAUTH_REFRESH_MAX_ATTEMPTS,
          delayMs,
          error: extractErrorMessage(error),
        });
        await sleep(delayMs);
      }
    }

    return null;
  });
}

async function tryResolveOAuthProfile(
  params: ResolveApiKeyForProfileParams,
): Promise<{ apiKey: string; provider: string; email?: string } | null> {
  const { cfg, store, profileId } = params;
  const cred = store.profiles[profileId];
  if (!cred || cred.type !== "oauth") {
    return null;
  }
  if (
    !isProfileConfigCompatible({
      cfg,
      profileId,
      provider: cred.provider,
      mode: cred.type,
    })
  ) {
    return null;
  }

  if (Date.now() < cred.expires) {
    return buildOAuthProfileResult({
      provider: cred.provider,
      credentials: cred,
      email: cred.email,
    });
  }

  const refreshed = await refreshOAuthTokenWithLock({
    profileId,
    agentDir: params.agentDir,
  });
  if (!refreshed) {
    return null;
  }
  return buildApiKeyProfileResult({
    apiKey: refreshed.apiKey,
    provider: cred.provider,
    email: cred.email,
  });
}

export async function resolveApiKeyForProfile(
  params: ResolveApiKeyForProfileParams,
): Promise<{ apiKey: string; provider: string; email?: string } | null> {
  const { cfg, store, profileId } = params;
  const cred = store.profiles[profileId];
  if (!cred) {
    return null;
  }
  if (
    !isProfileConfigCompatible({
      cfg,
      profileId,
      provider: cred.provider,
      mode: cred.type,
      // Compatibility: treat "oauth" config as compatible with stored token profiles.
      allowOAuthTokenCompatibility: true,
    })
  ) {
    return null;
  }

  if (cred.type === "api_key") {
    const key = cred.key?.trim();
    if (!key) {
      return null;
    }
    return buildApiKeyProfileResult({ apiKey: key, provider: cred.provider, email: cred.email });
  }
  if (cred.type === "token") {
    const token = cred.token?.trim();
    if (!token) {
      return null;
    }
    if (isExpiredCredential(cred.expires)) {
      return null;
    }
    return buildApiKeyProfileResult({ apiKey: token, provider: cred.provider, email: cred.email });
  }

  const oauthCred =
    adoptNewerMainOAuthCredential({
      store,
      profileId,
      agentDir: params.agentDir,
      cred,
    }) ?? cred;

  if (Date.now() < oauthCred.expires) {
    return buildOAuthProfileResult({
      provider: oauthCred.provider,
      credentials: oauthCred,
      email: oauthCred.email,
    });
  }

  try {
    const result = await refreshOAuthTokenWithLock({
      profileId,
      agentDir: params.agentDir,
    });
    if (!result) {
      return null;
    }
    return buildApiKeyProfileResult({
      apiKey: result.apiKey,
      provider: cred.provider,
      email: cred.email,
    });
  } catch (error) {
    const refreshedStore = ensureAuthProfileStore(params.agentDir);
    const refreshed = refreshedStore.profiles[profileId];
    if (refreshed?.type === "oauth" && Date.now() < refreshed.expires) {
      return buildOAuthProfileResult({
        provider: refreshed.provider,
        credentials: refreshed,
        email: refreshed.email ?? cred.email,
      });
    }
    const fallbackProfileId = suggestOAuthProfileIdForLegacyDefault({
      cfg,
      store: refreshedStore,
      provider: cred.provider,
      legacyProfileId: profileId,
    });
    if (fallbackProfileId && fallbackProfileId !== profileId) {
      try {
        const fallbackResolved = await tryResolveOAuthProfile({
          cfg,
          store: refreshedStore,
          profileId: fallbackProfileId,
          agentDir: params.agentDir,
        });
        if (fallbackResolved) {
          return fallbackResolved;
        }
      } catch {
        // keep original error
      }
    }

    // Fallback: if this is a secondary agent, try using the main agent's credentials
    if (params.agentDir) {
      try {
        const mainStore = ensureAuthProfileStore(undefined); // main agent (no agentDir)
        const mainCred = mainStore.profiles[profileId];
        if (mainCred?.type === "oauth" && Date.now() < mainCred.expires) {
          // Main agent has fresh credentials - copy them to this agent and use them
          refreshedStore.profiles[profileId] = { ...mainCred };
          saveAuthProfileStore(refreshedStore, params.agentDir);
          log.info("inherited fresh OAuth credentials from main agent", {
            profileId,
            agentDir: params.agentDir,
            expires: new Date(mainCred.expires).toISOString(),
          });
          return buildOAuthProfileResult({
            provider: mainCred.provider,
            credentials: mainCred,
            email: mainCred.email,
          });
        }
      } catch {
        // keep original error if main agent fallback also fails
      }
    }

    const message = error instanceof Error ? error.message : String(error);
    const hint = formatAuthDoctorHint({
      cfg,
      store: refreshedStore,
      provider: cred.provider,
      profileId,
    });
    throw new Error(
      `OAuth token refresh failed for ${cred.provider}: ${message}. ` +
        "Please try again or re-authenticate." +
        (hint ? `\n\n${hint}` : ""),
      { cause: error },
    );
  }
}
