import type { BaseTokenResolution } from "../channels/plugins/types.js";
import type { OpenClawConfig } from "../config/config.js";
import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from "../routing/session-key.js";

export type DiscordUserTokenSource = "env" | "config" | "none";

export type DiscordUserTokenResolution = BaseTokenResolution & {
  source: DiscordUserTokenSource;
};

/**
 * Normalize a user token. Unlike bot tokens, user tokens have no `Bot ` prefix
 * to strip — we simply trim whitespace.
 */
export function normalizeDiscordUserToken(raw?: string | null): string | undefined {
  if (!raw) {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed || undefined;
}

export function resolveDiscordUserToken(
  cfg?: OpenClawConfig,
  opts: { accountId?: string | null; envToken?: string | null } = {},
): DiscordUserTokenResolution {
  const accountId = normalizeAccountId(opts.accountId);
  const channelCfg = cfg?.channels?.["discord-user"] as Record<string, unknown> | undefined;

  // Check account-specific token first
  const accounts = channelCfg?.accounts as Record<string, Record<string, unknown>> | undefined;
  const accountCfg =
    accountId !== DEFAULT_ACCOUNT_ID ? accounts?.[accountId] : accounts?.[DEFAULT_ACCOUNT_ID];
  const accountToken = normalizeDiscordUserToken(accountCfg?.token as string | undefined);
  if (accountToken) {
    return { token: accountToken, source: "config" };
  }

  // Check base config token (only for default account)
  const allowEnv = accountId === DEFAULT_ACCOUNT_ID;
  const configToken = allowEnv
    ? normalizeDiscordUserToken(channelCfg?.token as string | undefined)
    : undefined;
  if (configToken) {
    return { token: configToken, source: "config" };
  }

  // Check environment variable (only for default account)
  const envToken = allowEnv
    ? normalizeDiscordUserToken(opts.envToken ?? process.env.DISCORD_USER_TOKEN)
    : undefined;
  if (envToken) {
    return { token: envToken, source: "env" };
  }

  return { token: "", source: "none" };
}
