import { createAccountListHelpers } from "../channels/plugins/account-helpers.js";
import type { OpenClawConfig } from "../config/config.js";
import { normalizeAccountId } from "../routing/session-key.js";
import { resolveDiscordUserToken } from "./token.js";

export type DiscordUserAccountConfig = {
  enabled?: boolean;
  name?: string;
  token?: string;
  stealth?: {
    buildNumber?: number;
    os?: string;
    browser?: string;
    releaseChannel?: string;
    typingDelay?: [number, number];
  };
  dmPolicy?: string;
  groupPolicy?: string;
  guilds?: Record<string, unknown>;
  actions?: Record<string, boolean>;
  accounts?: Record<string, DiscordUserAccountConfig>;
};

export type ResolvedDiscordUserAccount = {
  accountId: string;
  enabled: boolean;
  name?: string;
  token: string;
  tokenSource: "env" | "config" | "none";
  config: DiscordUserAccountConfig;
};

const { listAccountIds, resolveDefaultAccountId } = createAccountListHelpers("discord-user");
export const listDiscordUserAccountIds = listAccountIds;
export const resolveDefaultDiscordUserAccountId = resolveDefaultAccountId;

function resolveAccountConfig(
  cfg: OpenClawConfig,
  accountId: string,
): DiscordUserAccountConfig | undefined {
  const channelCfg = cfg.channels?.["discord-user"] as DiscordUserAccountConfig | undefined;
  const accounts = channelCfg?.accounts;
  if (!accounts || typeof accounts !== "object") {
    return undefined;
  }
  return accounts[accountId] as DiscordUserAccountConfig | undefined;
}

function mergeAccountConfig(cfg: OpenClawConfig, accountId: string): DiscordUserAccountConfig {
  const channelCfg = cfg.channels?.["discord-user"] as DiscordUserAccountConfig | undefined;
  const { accounts: _ignored, ...base } = (channelCfg ?? {}) as DiscordUserAccountConfig & {
    accounts?: unknown;
  };
  const account = resolveAccountConfig(cfg, accountId) ?? {};
  return { ...base, ...account };
}

export function resolveDiscordUserAccount(params: {
  cfg: OpenClawConfig;
  accountId?: string | null;
}): ResolvedDiscordUserAccount {
  const accountId = normalizeAccountId(params.accountId);
  const channelCfg = params.cfg.channels?.["discord-user"] as DiscordUserAccountConfig | undefined;
  const baseEnabled = channelCfg?.enabled !== false;
  const merged = mergeAccountConfig(params.cfg, accountId);
  const accountEnabled = merged.enabled !== false;
  const enabled = baseEnabled && accountEnabled;
  const tokenResolution = resolveDiscordUserToken(params.cfg, { accountId });
  return {
    accountId,
    enabled,
    name: merged.name?.trim() || undefined,
    token: tokenResolution.token,
    tokenSource: tokenResolution.source,
    config: merged,
  };
}

export function listEnabledDiscordUserAccounts(cfg: OpenClawConfig): ResolvedDiscordUserAccount[] {
  return listDiscordUserAccountIds(cfg)
    .map((accountId) => resolveDiscordUserAccount({ cfg, accountId }))
    .filter((account) => account.enabled);
}
