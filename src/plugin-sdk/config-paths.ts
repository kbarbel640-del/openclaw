import type { OpenClawConfig } from "../config/config.js";

/**
 * @description Returns the config key prefix for a specific channel account.
 * When the account has a dedicated entry under `channels.<channelKey>.accounts`,
 * the path includes the account ID (e.g. `"channels.slack.accounts.main."`).
 * Otherwise it falls back to the top-level channel section path (e.g.
 * `"channels.slack."`). Channel plugins use this to read and write
 * account-scoped settings at the correct nesting level.
 *
 * @param params.cfg - The current OpenClaw configuration object.
 * @param params.channelKey - The channel section key (e.g. `"slack"`,
 *   `"discord"`).
 * @param params.accountId - The account ID to look up.
 * @returns A dot-delimited config path prefix string ending with `"."`.
 *
 * @example
 * ```ts
 * const basePath = resolveChannelAccountConfigBasePath({ cfg, channelKey: "slack", accountId: "default" });
 * // "channels.slack." when no per-account entry exists
 * // "channels.slack.accounts.default." when it does
 * ```
 */
export function resolveChannelAccountConfigBasePath(params: {
  cfg: OpenClawConfig;
  channelKey: string;
  accountId: string;
}): string {
  const channels = params.cfg.channels as unknown as Record<string, unknown> | undefined;
  const channelSection = channels?.[params.channelKey] as Record<string, unknown> | undefined;
  const accounts = channelSection?.accounts as Record<string, unknown> | undefined;
  const useAccountPath = Boolean(accounts?.[params.accountId]);
  return useAccountPath
    ? `channels.${params.channelKey}.accounts.${params.accountId}.`
    : `channels.${params.channelKey}.`;
}
