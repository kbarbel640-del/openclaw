import crypto from "node:crypto";
import type { GatewayMessageChannel } from "../../utils/message-channel.js";
import { callGateway } from "../../gateway/call.js";
import { formatErrorMessage } from "../../infra/errors.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { resolveAgentIdFromSessionKey } from "../../routing/session-key.js";
import { isInternalMessageChannel } from "../../utils/message-channel.js";
import { AGENT_LANE_NESTED } from "../lanes.js";
import { readLatestAssistantReply, runAgentStep } from "./agent-step.js";
import { resolveAnnounceTarget } from "./sessions-announce-target.js";
import {
  buildAgentToAgentReplyContext,
  isAnnounceSkip,
  isReplySkip,
} from "./sessions-send-helpers.js";

const log = createSubsystemLogger("agents/sessions-send");

export async function runSessionsSendA2AFlow(params: {
  targetSessionKey: string;
  displayKey: string;
  message: string;
  announceTimeoutMs: number;
  maxPingPongTurns: number;
  announceEnabled: boolean;
  requesterSessionKey?: string;
  requesterChannel?: GatewayMessageChannel;
  roundOneReply?: string;
  waitRunId?: string;
}) {
  const runContextId = params.waitRunId ?? "unknown";
  try {
    let primaryReply = params.roundOneReply;
    let latestReply = params.roundOneReply;
    if (!primaryReply && params.waitRunId) {
      const waitMs = Math.min(params.announceTimeoutMs, 60_000);
      const wait = await callGateway<{ status: string }>({
        method: "agent.wait",
        params: {
          runId: params.waitRunId,
          timeoutMs: waitMs,
        },
        timeoutMs: waitMs + 2000,
      });
      if (wait?.status === "ok") {
        primaryReply = await readLatestAssistantReply({
          sessionKey: params.targetSessionKey,
        });
        latestReply = primaryReply;
      }
    }
    if (!latestReply) {
      return;
    }

    // Resolve the announce target initially based on the request context
    const announceTarget = await resolveAnnounceTarget({
      sessionKey: params.targetSessionKey,
      displayKey: params.displayKey,
      requesterSessionKey: params.requesterSessionKey,
    });
    const targetChannel = announceTarget?.channel ?? "unknown";

    // Resolve the originating channel for nested agent steps so the gateway
    // agent handler records the correct channel in the session entry instead
    // of defaulting to INTERNAL_MESSAGE_CHANNEL ("webchat").
    const originChannel =
      targetChannel && !isInternalMessageChannel(targetChannel)
        ? targetChannel
        : params.requesterChannel;

    // Helper to announce messages to the correct target channel with correct identity
    const tryAnnounce = async (message: string, sessionKey: string) => {
      if (!params.announceEnabled || !message || !message.trim()) {
        return;
      }
      if (isAnnounceSkip(message) || isReplySkip(message)) {
        return;
      }

      try {
        // accountId from announceTarget already identifies the correct bot
        // (e.g. "sena", "miru") — the send handler routes via accountId.
        if (announceTarget) {
          const agentId = resolveAgentIdFromSessionKey(sessionKey);
          log.info(
            `[a2a] announcing for ${agentId} (${sessionKey}): target=${announceTarget.channel}/${announceTarget.to}`,
          );
          await callGateway({
            method: "send",
            params: {
              to: announceTarget.to,
              message: message.trim(),
              channel: announceTarget.channel,
              accountId: announceTarget.accountId,
              idempotencyKey: crypto.randomUUID(),
            },
            timeoutMs: 10_000,
          });
        }
      } catch (err) {
        log.warn(`[a2a] announce failed for ${sessionKey}`, { error: formatErrorMessage(err) });
      }
    };

    if (
      params.maxPingPongTurns > 0 &&
      params.requesterSessionKey &&
      params.requesterSessionKey !== params.targetSessionKey
    ) {
      let currentSessionKey = params.requesterSessionKey;
      let nextSessionKey = params.targetSessionKey;
      let incomingMessage = latestReply;

      // Announce the initial reply (Round 1) if it exists
      // This is usually from the target agent (e.g., Sena) responding to the request
      if (latestReply) {
        await tryAnnounce(latestReply, params.targetSessionKey);
      }

      for (let turn = 1; turn <= params.maxPingPongTurns; turn += 1) {
        const currentRole =
          currentSessionKey === params.requesterSessionKey ? "requester" : "target";
        const replyPrompt = buildAgentToAgentReplyContext({
          requesterSessionKey: params.requesterSessionKey,
          requesterChannel: params.requesterChannel,
          targetSessionKey: params.displayKey,
          targetChannel,
          currentRole,
          turn,
          maxTurns: params.maxPingPongTurns,
        });
        const replyText = await runAgentStep({
          sessionKey: currentSessionKey,
          message: incomingMessage,
          extraSystemPrompt: replyPrompt,
          timeoutMs: params.announceTimeoutMs,
          lane: AGENT_LANE_NESTED,
          channel: originChannel,
        });
        if (!replyText || isReplySkip(replyText)) {
          break;
        }

        // Announce immediately after generation
        await tryAnnounce(replyText, currentSessionKey);

        latestReply = replyText;
        incomingMessage = replyText;
        const swap = currentSessionKey;
        currentSessionKey = nextSessionKey;
        nextSessionKey = swap;
      }
    } else {
      // No ping-pong, just announce the single reply
      await tryAnnounce(latestReply, params.targetSessionKey);
    }
  } catch (err) {
    log.warn("sessions_send announce flow failed", {
      runId: runContextId,
      error: formatErrorMessage(err),
    });
  }
}
