import { html, nothing } from "lit";
import { t } from "../../i18n/index.ts";
import { formatRelativeTimestamp } from "../format.ts";
import type { GoogleChatStatus } from "../types.ts";
import { renderChannelConfigSection } from "./channels.config.ts";
import { formatBoolOrNa, formatProbeStatus } from "./channels.shared.ts";
import type { ChannelsProps } from "./channels.types.ts";

export function renderGoogleChatCard(params: {
  props: ChannelsProps;
  googleChat?: GoogleChatStatus | null;
  accountCountLabel: unknown;
}) {
  const { props, googleChat, accountCountLabel } = params;

  return html`
    <div class="card">
      <div class="card-title">Google Chat</div>
      <div class="card-sub">${t("channels.cards.googleChatSubtitle")}</div>
      ${accountCountLabel}

      <div class="status-list" style="margin-top: 16px;">
        <div>
          <span class="label">${t("channels.common.configured")}</span>
          <span>${formatBoolOrNa(googleChat?.configured)}</span>
        </div>
        <div>
          <span class="label">${t("channels.common.running")}</span>
          <span>${formatBoolOrNa(googleChat?.running)}</span>
        </div>
        <div>
          <span class="label">${t("channels.common.credential")}</span>
          <span>${googleChat?.credentialSource ?? t("common.na")}</span>
        </div>
        <div>
          <span class="label">${t("channels.common.audience")}</span>
          <span>
            ${
              googleChat?.audienceType
                ? `${googleChat.audienceType}${googleChat.audience ? ` · ${googleChat.audience}` : ""}`
                : t("common.na")
            }
          </span>
        </div>
        <div>
          <span class="label">${t("channels.common.lastStart")}</span>
          <span>${googleChat?.lastStartAt ? formatRelativeTimestamp(googleChat.lastStartAt) : t("common.na")}</span>
        </div>
        <div>
          <span class="label">${t("channels.common.lastProbe")}</span>
          <span>${googleChat?.lastProbeAt ? formatRelativeTimestamp(googleChat.lastProbeAt) : t("common.na")}</span>
        </div>
      </div>

      ${
        googleChat?.lastError
          ? html`<div class="callout danger" style="margin-top: 12px;">
            ${googleChat.lastError}
          </div>`
          : nothing
      }

      ${
        googleChat?.probe
          ? html`<div class="callout" style="margin-top: 12px;">
            ${t("channels.common.probe")} ${formatProbeStatus(googleChat.probe.ok)} ·
            ${googleChat.probe.status ?? ""} ${googleChat.probe.error ?? ""}
          </div>`
          : nothing
      }

      ${renderChannelConfigSection({ channelId: "googlechat", props })}

      <div class="row" style="margin-top: 12px;">
        <button class="btn" @click=${() => props.onRefresh(true)}>
          ${t("channels.common.probe")}
        </button>
      </div>
    </div>
  `;
}
