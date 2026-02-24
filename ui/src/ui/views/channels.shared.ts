import { html, nothing } from "lit";
import { t } from "../../i18n/index.ts";
import type { ChannelAccountSnapshot } from "../types.ts";
import type { ChannelKey, ChannelsProps } from "./channels.types.ts";

export function channelEnabled(key: ChannelKey, props: ChannelsProps) {
  const snapshot = props.snapshot;
  const channels = snapshot?.channels as Record<string, unknown> | null;
  if (!snapshot || !channels) {
    return false;
  }
  const channelStatus = channels[key] as Record<string, unknown> | undefined;
  const configured = typeof channelStatus?.configured === "boolean" && channelStatus.configured;
  const running = typeof channelStatus?.running === "boolean" && channelStatus.running;
  const connected = typeof channelStatus?.connected === "boolean" && channelStatus.connected;
  const accounts = snapshot.channelAccounts?.[key] ?? [];
  const accountActive = accounts.some(
    (account) => account.configured || account.running || account.connected,
  );
  return configured || running || connected || accountActive;
}

export function getChannelAccountCount(
  key: ChannelKey,
  channelAccounts?: Record<string, ChannelAccountSnapshot[]> | null,
): number {
  return channelAccounts?.[key]?.length ?? 0;
}

export function renderChannelAccountCount(
  key: ChannelKey,
  channelAccounts?: Record<string, ChannelAccountSnapshot[]> | null,
) {
  const count = getChannelAccountCount(key, channelAccounts);
  if (count < 2) {
    return nothing;
  }
  return html`<div class="account-count">${t("channels.common.accountsCount", { count: String(count) })}</div>`;
}

export function formatBool(value: boolean): string {
  return value ? t("states.yes") : t("states.no");
}

export function formatBoolOrNa(value: boolean | null | undefined): string {
  if (value == null) {
    return t("common.na");
  }
  return formatBool(value);
}

export function formatProbeStatus(ok: boolean | null | undefined): string {
  return ok ? t("channels.common.probeOk") : t("channels.common.probeFailed");
}
