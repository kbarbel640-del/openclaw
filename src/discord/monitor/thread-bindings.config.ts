import {
  resolveThreadBindingSessionTtlMs,
  resolveThreadBindingsEnabled,
} from "../../channels/thread-bindings-policy.js";
import type { OpenClawConfig } from "../../config/config.js";
import { normalizeAccountId } from "../../routing/session-key.js";

export { resolveThreadBindingSessionTtlMs, resolveThreadBindingsEnabled };

/** Discord only allows 60, 1440, 4320, 10080 as auto-archive durations. */
export const DEFAULT_DISCORD_THREAD_AUTO_ARCHIVE_DURATION = 10_080;
const VALID_AUTO_ARCHIVE_DURATIONS = new Set([60, 1440, 4320, 10_080]);

export function resolveDiscordThreadBindingSessionTtlMs(params: {
  cfg: OpenClawConfig;
  accountId?: string;
}): number {
  const accountId = normalizeAccountId(params.accountId);
  const root = params.cfg.channels?.discord?.threadBindings;
  const account = params.cfg.channels?.discord?.accounts?.[accountId]?.threadBindings;
  return resolveThreadBindingSessionTtlMs({
    channelTtlHoursRaw: account?.ttlHours ?? root?.ttlHours,
    sessionTtlHoursRaw: params.cfg.session?.threadBindings?.ttlHours,
  });
}

/**
 * Resolve the auto-archive duration (minutes) for Discord thread creation.
 * Account-level overrides root-level; falls back to 10080 (1 week).
 */
export function resolveDiscordThreadAutoArchiveDuration(params: {
  cfg: OpenClawConfig;
  accountId?: string;
}): number {
  const accountId = normalizeAccountId(params.accountId);
  const account = params.cfg.channels?.discord?.accounts?.[accountId]?.threadBindings;
  const root = params.cfg.channels?.discord?.threadBindings;
  const raw = account?.autoArchiveDuration ?? root?.autoArchiveDuration;
  if (typeof raw === "number" && VALID_AUTO_ARCHIVE_DURATIONS.has(raw)) {
    return raw;
  }
  return DEFAULT_DISCORD_THREAD_AUTO_ARCHIVE_DURATION;
}
