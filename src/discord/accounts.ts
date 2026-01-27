import type { MoltbotConfig } from "../config/config.js";
import type { DiscordAccountConfig } from "../config/types.js";
import { createAccountBase } from "../channels/accounts-base.js";
import { normalizeAccountId } from "../routing/session-key.js";
import { resolveDiscordToken } from "./token.js";

const base = createAccountBase<DiscordAccountConfig>("discord");

export type ResolvedDiscordAccount = {
  accountId: string;
  enabled: boolean;
  name?: string;
  token: string;
  tokenSource: "env" | "config" | "none";
  config: DiscordAccountConfig;
};

export const listDiscordAccountIds = base.listAccountIds;
export const resolveDefaultDiscordAccountId = base.resolveDefaultAccountId;

export function resolveDiscordAccount(params: {
  cfg: MoltbotConfig;
  accountId?: string | null;
}): ResolvedDiscordAccount {
  const accountId = normalizeAccountId(params.accountId);
  const merged = base.mergeAccountConfig(params.cfg, accountId);
  const enabled = base.isBaseEnabled(params.cfg) && merged.enabled !== false;
  const tokenResolution = resolveDiscordToken(params.cfg, { accountId });
  return {
    accountId,
    enabled,
    name: merged.name?.trim() || undefined,
    token: tokenResolution.token,
    tokenSource: tokenResolution.source,
    config: merged,
  };
}

export function listEnabledDiscordAccounts(cfg: MoltbotConfig): ResolvedDiscordAccount[] {
  return base.listEnabledAccounts(cfg, resolveDiscordAccount);
}
