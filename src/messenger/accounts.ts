/**
 * Messenger account resolution.
 *
 * Handles multi-account configuration and token resolution.
 */

import type { OpenClawConfig } from "../config/config.js";
import type { MessengerAccountConfig } from "../config/types.messenger.js";
import type { ResolvedMessengerAccount } from "./types.js";
import { isTruthyEnvValue } from "../infra/env.js";
import { listBoundAccountIds, resolveDefaultAgentBoundAccountId } from "../routing/bindings.js";
import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from "../routing/session-key.js";

const debugAccounts = (...args: unknown[]) => {
  if (isTruthyEnvValue(process.env.OPENCLAW_DEBUG_MESSENGER_ACCOUNTS)) {
    console.warn("[messenger:accounts]", ...args);
  }
};

/**
 * List configured Messenger account IDs.
 */
function listConfiguredAccountIds(cfg: OpenClawConfig): string[] {
  const accounts = cfg.channels?.messenger?.accounts;
  if (!accounts || typeof accounts !== "object") {
    return [];
  }
  const ids = new Set<string>();
  for (const key of Object.keys(accounts)) {
    if (!key) {
      continue;
    }
    ids.add(normalizeAccountId(key));
  }
  return [...ids];
}

/**
 * List all Messenger account IDs (configured + bound).
 */
export function listMessengerAccountIds(cfg: OpenClawConfig): string[] {
  const ids = Array.from(
    new Set([...listConfiguredAccountIds(cfg), ...listBoundAccountIds(cfg, "messenger")]),
  );
  debugAccounts("listMessengerAccountIds", ids);
  if (ids.length === 0) {
    return [DEFAULT_ACCOUNT_ID];
  }
  return ids.toSorted((a, b) => a.localeCompare(b));
}

/**
 * Resolve the default Messenger account ID.
 */
export function resolveDefaultMessengerAccountId(cfg: OpenClawConfig): string {
  const boundDefault = resolveDefaultAgentBoundAccountId(cfg, "messenger");
  if (boundDefault) {
    return boundDefault;
  }
  const ids = listMessengerAccountIds(cfg);
  if (ids.includes(DEFAULT_ACCOUNT_ID)) {
    return DEFAULT_ACCOUNT_ID;
  }
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}

/**
 * Resolve account-specific config from the accounts map.
 */
function resolveAccountConfig(
  cfg: OpenClawConfig,
  accountId: string,
): MessengerAccountConfig | undefined {
  const accounts = cfg.channels?.messenger?.accounts;
  if (!accounts || typeof accounts !== "object") {
    return undefined;
  }
  const direct = accounts[accountId] as MessengerAccountConfig | undefined;
  if (direct) {
    return direct;
  }
  const normalized = normalizeAccountId(accountId);
  const matchKey = Object.keys(accounts).find((key) => normalizeAccountId(key) === normalized);
  return matchKey ? (accounts[matchKey] as MessengerAccountConfig | undefined) : undefined;
}

/**
 * Merge base config with account-specific overrides.
 */
function mergeMessengerAccountConfig(
  cfg: OpenClawConfig,
  accountId: string,
): MessengerAccountConfig {
  const { accounts: _ignored, ...base } = (cfg.channels?.messenger ??
    {}) as MessengerAccountConfig & { accounts?: unknown };
  const account = resolveAccountConfig(cfg, accountId) ?? {};
  return { ...base, ...account };
}

/**
 * Resolve the page access token from config, file, or environment.
 */
function resolveMessengerToken(
  cfg: OpenClawConfig,
  accountId: string,
): { token: string; source: ResolvedMessengerAccount["tokenSource"] } {
  const merged = mergeMessengerAccountConfig(cfg, accountId);

  // Check for token in config
  if (merged.pageAccessToken?.trim()) {
    return { token: merged.pageAccessToken.trim(), source: "config" };
  }

  // Check for token file
  if (merged.tokenFile?.trim()) {
    try {
      const fs = require("node:fs");
      const token = fs.readFileSync(merged.tokenFile.trim(), "utf-8").trim();
      if (token) {
        return { token, source: "tokenFile" };
      }
    } catch {
      // Fall through to env
    }
  }

  // Check environment variable
  const envToken = process.env.MESSENGER_PAGE_ACCESS_TOKEN?.trim();
  if (envToken) {
    return { token: envToken, source: "env" };
  }

  return { token: "", source: "none" };
}

/**
 * Resolve a Messenger account by ID.
 */
export function resolveMessengerAccount(params: {
  cfg: OpenClawConfig;
  accountId?: string | null;
}): ResolvedMessengerAccount {
  const hasExplicitAccountId = Boolean(params.accountId?.trim());
  const baseEnabled = params.cfg.channels?.messenger?.enabled !== false;

  const resolve = (accountId: string) => {
    const merged = mergeMessengerAccountConfig(params.cfg, accountId);
    const accountEnabled = merged.enabled !== false;
    const enabled = baseEnabled && accountEnabled;
    const tokenResolution = resolveMessengerToken(params.cfg, accountId);

    debugAccounts("resolve", {
      accountId,
      enabled,
      tokenSource: tokenResolution.source,
    });

    return {
      accountId,
      enabled,
      name: merged.name?.trim() || undefined,
      pageAccessToken: tokenResolution.token,
      tokenSource: tokenResolution.source,
      appSecret: merged.appSecret?.trim() || undefined,
      verifyToken: merged.verifyToken?.trim() || undefined,
      pageId: merged.pageId?.trim() || undefined,
      config: merged,
    } satisfies ResolvedMessengerAccount;
  };

  const normalized = normalizeAccountId(params.accountId);
  const primary = resolve(normalized);

  if (hasExplicitAccountId) {
    return primary;
  }

  if (primary.tokenSource !== "none") {
    return primary;
  }

  // If accountId is omitted, prefer a configured account token over failing on
  // the implicit "default" account.
  const fallbackId = resolveDefaultMessengerAccountId(params.cfg);
  if (fallbackId === primary.accountId) {
    return primary;
  }

  const fallback = resolve(fallbackId);
  if (fallback.tokenSource === "none") {
    return primary;
  }

  return fallback;
}

/**
 * List all enabled Messenger accounts.
 */
export function listEnabledMessengerAccounts(cfg: OpenClawConfig): ResolvedMessengerAccount[] {
  return listMessengerAccountIds(cfg)
    .map((accountId) => resolveMessengerAccount({ cfg, accountId }))
    .filter((account) => account.enabled);
}
