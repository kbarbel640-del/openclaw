import type { OpenClawConfig } from "../config/config.js";
import type { SessionEntry } from "../config/sessions.js";
import { isDeliverableMessageChannel, normalizeMessageChannel } from "../utils/message-channel.js";
import { resolveSessionDeliveryTarget } from "./outbound/targets.js";
import { enqueueSystemEvent } from "./system-events.js";

type CompactionNotificationParams = {
  cfg: OpenClawConfig;
  sessionKey: string;
  entry: SessionEntry;
};

/** Tracks sessions that have already been notified during the current compaction cycle. */
const notifiedSessions = new Set<string>();

/**
 * Sends a brief notification to the user's active channel when context
 * compaction occurs.  This is core UX — the user deserves to know their
 * conversation history is being summarised, just as typing indicators tell
 * them a reply is in progress.
 *
 * Dedupes per session key: only the first call per compaction cycle sends
 * a notification.  Call {@link clearCompactionNotification} when the cycle
 * ends (phase === "end" with willRetry === false) to re-arm for the next
 * compaction.
 *
 * Follows the same delivery pattern as session-maintenance-warning.ts.
 */
export async function deliverCompactionNotification(
  params: CompactionNotificationParams,
): Promise<void> {
  // Never deliver in test/vitest.
  if (process.env.VITEST || process.env.NODE_ENV === "test") {
    return;
  }

  // Dedupe: only notify once per compaction cycle per session.
  if (notifiedSessions.has(params.sessionKey)) {
    return;
  }
  notifiedSessions.add(params.sessionKey);

  const text = "🧹 Compacting conversation context…";

  const target = resolveSessionDeliveryTarget({
    entry: params.entry,
    requestedChannel: "last",
  });

  if (!target.channel || !target.to) {
    // No deliverable channel — fall back to a system event so the agent
    // (and any listening UI) still sees the notification.
    enqueueSystemEvent(text, { sessionKey: params.sessionKey });
    return;
  }

  const channel = normalizeMessageChannel(target.channel) ?? target.channel;
  if (!isDeliverableMessageChannel(channel)) {
    enqueueSystemEvent(text, { sessionKey: params.sessionKey });
    return;
  }

  try {
    const { deliverOutboundPayloads } = await import("./outbound/deliver.js");
    await deliverOutboundPayloads({
      cfg: params.cfg,
      channel,
      to: target.to,
      accountId: target.accountId,
      threadId: target.threadId,
      payloads: [{ text }],
    });
  } catch {
    // Best-effort — fall back to system event.
    enqueueSystemEvent(text, { sessionKey: params.sessionKey });
  }
}

/**
 * Clear the dedupe guard for a session so the next compaction cycle can
 * notify again.  Call when compaction ends (phase === "end", willRetry === false).
 */
export function clearCompactionNotification(sessionKey: string): void {
  notifiedSessions.delete(sessionKey);
}
