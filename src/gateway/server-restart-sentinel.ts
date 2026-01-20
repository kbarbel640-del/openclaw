import { resolveAnnounceTargetFromKey } from "../agents/tools/sessions-send-helpers.js";
import { normalizeChannelId } from "../channels/plugins/index.js";
import type { CliDeps } from "../cli/deps.js";
import { agentCommand } from "../commands/agent.js";
import { loadConfig } from "../config/io.js";
import {
  resolveMainSessionKeyFromConfig,
  resolveStorePath,
  updateSessionStore,
} from "../config/sessions.js";
import { resolveOutboundTarget } from "../infra/outbound/targets.js";
import {
  consumeRestartSentinel,
  formatRestartSentinelMessage,
  summarizeRestartSentinel,
} from "../infra/restart-sentinel.js";
import { enqueueSystemEvent } from "../infra/system-events.js";
import { defaultRuntime } from "../runtime.js";
import { deliveryContextFromSession, mergeDeliveryContext } from "../utils/delivery-context.js";
import { loadSessionEntry } from "./session-utils.js";

export async function scheduleRestartSentinelWake(params: { deps: CliDeps }) {
  const sentinel = await consumeRestartSentinel();
  if (!sentinel) return;
  const payload = sentinel.payload;
  const sessionKey = payload.sessionKey?.trim();
  const message = formatRestartSentinelMessage(payload);
  const summary = summarizeRestartSentinel(payload);

  if (!sessionKey) {
    const mainSessionKey = resolveMainSessionKeyFromConfig();
    enqueueSystemEvent(message, { sessionKey: mainSessionKey });
    return;
  }

  const { cfg, entry } = loadSessionEntry(sessionKey);
  const parsedTarget = resolveAnnounceTargetFromKey(sessionKey);
  // Prefer delivery context from sentinel payload (captured at restart time) over session store lookup
  // This handles the case where session store wasn't flushed to disk before restart
  const sentinelDelivery =
    payload.deliveryContext && typeof payload.deliveryContext === "object"
      ? {
          channel: payload.deliveryContext.channel,
          to: payload.deliveryContext.to,
          accountId: payload.deliveryContext.accountId,
        }
      : undefined;
  const origin = mergeDeliveryContext(
    sentinelDelivery,
    mergeDeliveryContext(deliveryContextFromSession(entry), parsedTarget ?? undefined),
  );
  const channelRaw = origin?.channel;
  const channel = channelRaw ? normalizeChannelId(channelRaw) : null;
  const to = origin?.to;
  if (!channel || !to) {
    enqueueSystemEvent(message, { sessionKey });
    return;
  }

  // Update session store with delivery context so subsequent agent responses route correctly
  if (sentinelDelivery && (sentinelDelivery.channel || sentinelDelivery.to)) {
    try {
      const storePath = resolveStorePath(cfg.session?.store);
      await updateSessionStore(storePath, (store) => {
        const current = store[sessionKey];
        if (current) {
          store[sessionKey] = {
            ...current,
            deliveryContext: {
              channel: sentinelDelivery.channel ?? current.deliveryContext?.channel,
              to: sentinelDelivery.to ?? current.deliveryContext?.to,
              accountId: sentinelDelivery.accountId ?? current.deliveryContext?.accountId,
            },
            lastChannel: sentinelDelivery.channel ?? current.lastChannel,
            lastTo: sentinelDelivery.to ?? current.lastTo,
            lastAccountId: sentinelDelivery.accountId ?? current.lastAccountId,
            updatedAt: Date.now(),
          };
        }
      });
    } catch {
      // ignore: session update is best-effort
    }
  }

  const resolved = resolveOutboundTarget({
    channel,
    to,
    cfg,
    accountId: origin?.accountId,
    mode: "implicit",
  });
  if (!resolved.ok) {
    enqueueSystemEvent(message, { sessionKey });
    return;
  }

  try {
    await agentCommand(
      {
        message,
        sessionKey,
        to: resolved.to,
        channel,
        deliver: true,
        bestEffortDeliver: true,
        messageChannel: channel,
      },
      defaultRuntime,
      params.deps,
    );
  } catch (err) {
    enqueueSystemEvent(`${summary}\n${String(err)}`, { sessionKey });
  }
}

export function shouldWakeFromRestartSentinel() {
  return !process.env.VITEST && process.env.NODE_ENV !== "test";
}
