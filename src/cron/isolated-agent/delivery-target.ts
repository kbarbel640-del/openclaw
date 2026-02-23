import type { ChannelId } from "../../channels/plugins/types.js";
import type { OpenClawConfig } from "../../config/config.js";
import type { OutboundChannel } from "../../infra/outbound/targets.js";
import { DEFAULT_CHAT_CHANNEL } from "../../channels/registry.js";
import {
  loadSessionStore,
  resolveAgentMainSessionKey,
  resolveStorePath,
} from "../../config/sessions.js";
import { resolveMessageChannelSelection } from "../../infra/outbound/channel-selection.js";
import {
  resolveOutboundTarget,
  resolveSessionDeliveryTarget,
} from "../../infra/outbound/targets.js";

export async function resolveDeliveryTarget(
  cfg: OpenClawConfig,
  agentId: string,
  jobPayload: {
    channel?: "last" | ChannelId;
    to?: string;
    /** Explicit account ID from the job delivery config. When set, overrides the
     * session-derived accountId so delivery always uses the specified bot account
     * (important for multi-account setups where the session may not record
     * the correct lastAccountId). */
    accountId?: string;
  },
): Promise<{
  channel: Exclude<OutboundChannel, "none">;
  to?: string;
  accountId?: string;
  threadId?: string | number;
  mode: "explicit" | "implicit";
  error?: Error;
}> {
  const requestedChannel = typeof jobPayload.channel === "string" ? jobPayload.channel : "last";
  const explicitTo = typeof jobPayload.to === "string" ? jobPayload.to : undefined;
  // Explicit accountId from the job delivery config takes precedence over the session-derived one.
  const explicitAccountId =
    typeof jobPayload.accountId === "string" && jobPayload.accountId.trim()
      ? jobPayload.accountId.trim()
      : undefined;
  const allowMismatchedLastTo = requestedChannel === "last";

  const sessionCfg = cfg.session;
  const mainSessionKey = resolveAgentMainSessionKey({ cfg, agentId });
  const storePath = resolveStorePath(sessionCfg?.store, { agentId });
  const store = loadSessionStore(storePath);
  const main = store[mainSessionKey];

  const preliminary = resolveSessionDeliveryTarget({
    entry: main,
    requestedChannel,
    explicitTo,
    allowMismatchedLastTo,
  });

  let fallbackChannel: Exclude<OutboundChannel, "none"> | undefined;
  if (!preliminary.channel) {
    try {
      const selection = await resolveMessageChannelSelection({ cfg });
      fallbackChannel = selection.channel;
    } catch {
      fallbackChannel = preliminary.lastChannel ?? DEFAULT_CHAT_CHANNEL;
    }
  }

  const resolved = fallbackChannel
    ? resolveSessionDeliveryTarget({
        entry: main,
        requestedChannel,
        explicitTo,
        fallbackChannel,
        allowMismatchedLastTo,
        mode: preliminary.mode,
      })
    : preliminary;

  const channel = resolved.channel ?? fallbackChannel ?? DEFAULT_CHAT_CHANNEL;
  const mode = resolved.mode as "explicit" | "implicit";
  const toCandidate = resolved.to;

  // Only carry threadId when delivering to the same recipient as the session's
  // last conversation. This prevents stale thread IDs (e.g. from a Telegram
  // supergroup topic) from being sent to a different target (e.g. a private
  // chat) where they would cause API errors.
  const threadId =
    resolved.threadId && resolved.to && resolved.to === resolved.lastTo
      ? resolved.threadId
      : undefined;

  // Prefer explicit accountId from the job delivery config over the session-derived one.
  // This is important for multi-account channel setups (e.g. two Discord bots) where the
  // session may not have recorded a lastAccountId at all, or may have recorded the wrong one.
  const effectiveAccountId = explicitAccountId ?? resolved.accountId;

  if (!toCandidate) {
    return {
      channel,
      to: undefined,
      accountId: effectiveAccountId,
      threadId,
      mode,
    };
  }

  const docked = resolveOutboundTarget({
    channel,
    to: toCandidate,
    cfg,
    accountId: effectiveAccountId,
    mode,
  });
  return {
    channel,
    to: docked.ok ? docked.to : undefined,
    accountId: effectiveAccountId,
    threadId,
    mode,
    error: docked.ok ? undefined : docked.error,
  };
}
