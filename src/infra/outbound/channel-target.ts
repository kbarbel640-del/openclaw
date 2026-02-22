import { MESSAGE_ACTION_TARGET_MODE } from "./message-action-spec.js";

export const CHANNEL_TARGET_DESCRIPTION =
  "Recipient/channel: E.164 for WhatsApp/Signal, Telegram chat id/@username, Discord/Slack channel/user, or iMessage handle/chat_id";

export const CHANNEL_TARGETS_DESCRIPTION =
  "Recipient/channel targets (same format as --target); accepts ids or names when the directory is available.";

export function applyTargetToParams(params: {
  action: string;
  args: Record<string, unknown>;
}): void {
  const target = typeof params.args.target === "string" ? params.args.target.trim() : "";
  const legacyTo = typeof params.args.to === "string" ? params.args.to.trim() : "";
  const legacyChannelId =
    typeof params.args.channelId === "string" ? params.args.channelId.trim() : "";
  const hasLegacyTo = legacyTo.length > 0;
  const hasLegacyChannelId = legacyChannelId.length > 0;
  const mode =
    MESSAGE_ACTION_TARGET_MODE[params.action as keyof typeof MESSAGE_ACTION_TARGET_MODE] ?? "none";

  if (mode !== "none") {
    if (hasLegacyTo || hasLegacyChannelId) {
      throw new Error(
        `Action "${params.action}" expects "target" for the destination. Replace legacy "to"/"channelId" with "target".`,
      );
    }
  } else if (hasLegacyTo) {
    throw new Error(
      `Action "${params.action}" does not use recipient routing. Remove "to" and use action-specific filters instead.`,
    );
  }

  if (!target) {
    return;
  }
  if (mode === "channelId") {
    params.args.channelId = target;
    return;
  }
  if (mode === "to") {
    params.args.to = target;
    return;
  }
  throw new Error(
    `Action "${params.action}" does not accept a destination target. Remove "target"/"to"/"channelId" for this action.`,
  );
}
