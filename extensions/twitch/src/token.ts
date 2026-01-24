/**
 * Twitch token resolution with environment variable support.
 *
 * Supports reading Twitch OAuth tokens from config or environment variable.
 * The CLAWDBOT_TWITCH_ACCESS_TOKEN env var is only used for the default account.
 */

import type { ClawdbotConfig } from "../../../src/config/config.js";
import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from "../../../src/routing/session-key.js";

export type TwitchTokenSource = "env" | "config" | "none";

export type TwitchTokenResolution = {
  token: string;
  source: TwitchTokenSource;
};

/**
 * Normalize a Twitch OAuth token - ensure it has the oauth: prefix
 */
function normalizeTwitchToken(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  // Twitch tokens should have oauth: prefix
  return trimmed.startsWith("oauth:") ? trimmed : `oauth:${trimmed}`;
}

/**
 * Resolve Twitch token from config or environment variable.
 *
 * Priority:
 * 1. Account token: channels.twitch.accounts.{accountId}.token
 * 2. Base config token: channels.twitch.token (default account only)
 * 3. Environment variable: CLAWDBOT_TWITCH_ACCESS_TOKEN (default account only)
 *
 * @param cfg - Clawdbot config
 * @param opts - Options including accountId and optional envToken override
 * @returns Token resolution with source
 */
export function resolveTwitchToken(
  cfg?: ClawdbotConfig,
  opts: { accountId?: string | null; envToken?: string | null } = {},
): TwitchTokenResolution {
  const accountId = normalizeAccountId(opts.accountId);
  const twitchCfg = cfg?.channels?.twitch;
  const accountCfg =
    accountId !== DEFAULT_ACCOUNT_ID
      ? twitchCfg?.accounts?.[accountId]
      : twitchCfg?.accounts?.[DEFAULT_ACCOUNT_ID];

  // 1. Account token (highest priority)
  const accountToken = normalizeTwitchToken(accountCfg?.token ?? undefined);
  if (accountToken) {
    return { token: accountToken, source: "config" };
  }

  // 2. Base config token (default account only)
  const allowEnv = accountId === DEFAULT_ACCOUNT_ID;
  const configToken = allowEnv
    ? normalizeTwitchToken(twitchCfg?.token ?? undefined)
    : undefined;
  if (configToken) {
    return { token: configToken, source: "config" };
  }

  // 3. Environment variable (default account only)
  const envToken = allowEnv
    ? normalizeTwitchToken(opts.envToken ?? process.env.CLAWDBOT_TWITCH_ACCESS_TOKEN)
    : undefined;
  if (envToken) {
    return { token: envToken, source: "env" };
  }

  return { token: "", source: "none" };
}
