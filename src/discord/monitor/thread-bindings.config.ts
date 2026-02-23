import type { OpenClawConfig } from "../../config/config.js";
import { normalizeAccountId } from "../../routing/session-key.js";

const DEFAULT_THREAD_BINDING_TTL_HOURS = 24;

function normalizeThreadBindingTtlHours(raw: unknown): number | undefined {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return undefined;
  }
  if (raw < 0) {
    return undefined;
  }
  return raw;
}

export function resolveThreadBindingSessionTtlMs(params: {
  channelTtlHoursRaw: unknown;
  sessionTtlHoursRaw: unknown;
}): number {
  const ttlHours =
    normalizeThreadBindingTtlHours(params.channelTtlHoursRaw) ??
    normalizeThreadBindingTtlHours(params.sessionTtlHoursRaw) ??
    DEFAULT_THREAD_BINDING_TTL_HOURS;
  return Math.floor(ttlHours * 60 * 60 * 1000);
}

function normalizeThreadBindingsEnabled(raw: unknown): boolean | undefined {
  if (typeof raw !== "boolean") {
    return undefined;
  }
  return raw;
}

export function resolveThreadBindingsEnabled(params: {
  channelEnabledRaw: unknown;
  sessionEnabledRaw: unknown;
}): boolean {
  return (
    normalizeThreadBindingsEnabled(params.channelEnabledRaw) ??
    normalizeThreadBindingsEnabled(params.sessionEnabledRaw) ??
    true
  );
}

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
