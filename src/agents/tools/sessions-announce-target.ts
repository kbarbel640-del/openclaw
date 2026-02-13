import type { AnnounceTarget } from "./sessions-send-helpers.js";
import { getChannelPlugin, normalizeChannelId } from "../../channels/plugins/index.js";
import { callGateway } from "../../gateway/call.js";
import { SessionListRow } from "./sessions-helpers.js";
import { resolveAnnounceTargetFromKey } from "./sessions-send-helpers.js";

/** Check whether a channel string resolves to an outbound-deliverable plugin. */
function isDeliverableChannel(channel: string): boolean {
  const normalized = normalizeChannelId(channel);
  return normalized != null && getChannelPlugin(normalized) != null;
}

export async function resolveAnnounceTarget(params: {
  sessionKey: string;
  displayKey: string;
}): Promise<AnnounceTarget | null> {
  const parsed = resolveAnnounceTargetFromKey(params.sessionKey);
  const parsedDisplay = resolveAnnounceTargetFromKey(params.displayKey);
  const fallback = parsed ?? parsedDisplay ?? null;

  if (fallback) {
    if (!isDeliverableChannel(fallback.channel)) {
      // Channel is not outbound-deliverable (e.g. "webchat") — skip the
      // fast-path and fall through to the sessions.list lookup which may
      // have a valid outbound channel in deliveryContext.
    } else {
      const plugin = getChannelPlugin(normalizeChannelId(fallback.channel)!);
      if (!plugin?.meta?.preferSessionLookupForAnnounceTarget) {
        return fallback;
      }
    }
  }

  try {
    const list = await callGateway<{ sessions: Array<SessionListRow> }>({
      method: "sessions.list",
      params: {
        includeGlobal: true,
        includeUnknown: true,
        limit: 200,
      },
    });
    const sessions = Array.isArray(list?.sessions) ? list.sessions : [];
    const match =
      sessions.find((entry) => entry?.key === params.sessionKey) ??
      sessions.find((entry) => entry?.key === params.displayKey);

    const deliveryContext =
      match?.deliveryContext && typeof match.deliveryContext === "object"
        ? (match.deliveryContext as Record<string, unknown>)
        : undefined;
    const channel =
      (typeof deliveryContext?.channel === "string" ? deliveryContext.channel : undefined) ??
      (typeof match?.lastChannel === "string" ? match.lastChannel : undefined);
    const to =
      (typeof deliveryContext?.to === "string" ? deliveryContext.to : undefined) ??
      (typeof match?.lastTo === "string" ? match.lastTo : undefined);
    const accountId =
      (typeof deliveryContext?.accountId === "string" ? deliveryContext.accountId : undefined) ??
      (typeof match?.lastAccountId === "string" ? match.lastAccountId : undefined);
    if (channel && to && isDeliverableChannel(channel)) {
      return { channel, to, accountId };
    }
  } catch {
    // ignore
  }

  // Only return the fallback if its channel is actually deliverable.
  if (fallback && isDeliverableChannel(fallback.channel)) {
    return fallback;
  }
  return null;
}
