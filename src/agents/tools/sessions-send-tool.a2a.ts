import crypto from "node:crypto";
import type { GatewayMessageChannel } from "../../utils/message-channel.js";
import { loadConfig } from "../../config/config.js";
import { callGateway } from "../../gateway/call.js";
import { formatErrorMessage } from "../../infra/errors.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { resolveAgentIdFromSessionKey } from "../../routing/session-key.js";
import { resolveAgentIdentity } from "../identity.js";
import { AGENT_LANE_NESTED } from "../lanes.js";
import { resolveTeamChatSessionKey } from "../team-chat.js";
import { readLatestAssistantReply, runAgentStep } from "./agent-step.js";
import { resolveAnnounceTarget } from "./sessions-announce-target.js";
import {
  buildAgentToAgentAnnounceContext,
  buildAgentToAgentReplyContext,
  isAnnounceSkip,
  isReplySkip,
} from "./sessions-send-helpers.js";

const log = createSubsystemLogger("agents/sessions-send");

async function injectIntoTeamChat(params: {
  senderAgentId: string;
  message: string;
}): Promise<void> {
  const cfg = loadConfig();
  const rootSession = resolveTeamChatSessionKey({ cfg });
  const identity = resolveAgentIdentity(cfg, params.senderAgentId);
  await callGateway({
    method: "chat.inject",
    params: {
      sessionKey: rootSession,
      message: params.message,
      senderAgentId: params.senderAgentId,
      senderName: identity?.name ?? params.senderAgentId,
      senderEmoji: identity?.emoji ?? "💬",
      senderAvatar: identity?.avatar,
    },
    timeoutMs: 5_000,
  });
}

export async function runSessionsSendA2AFlow(params: {
  targetSessionKey: string;
  displayKey: string;
  message: string;
  announceTimeoutMs: number;
  maxPingPongTurns: number;
  requesterSessionKey?: string;
  requesterChannel?: GatewayMessageChannel;
  roundOneReply?: string;
  waitRunId?: string;
}) {
  const runContextId = params.waitRunId ?? "unknown";
  try {
    let primaryReply = params.roundOneReply;
    let latestReply = params.roundOneReply;
    let waitStatus: string | undefined;
    let waitError: string | undefined;
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
      waitStatus = typeof wait?.status === "string" ? wait.status : undefined;
      const waitWithError = wait as { status?: string; error?: unknown } | undefined;
      waitError = typeof waitWithError?.error === "string" ? waitWithError.error : undefined;
      if (wait?.status === "ok") {
        primaryReply = await readLatestAssistantReply({
          sessionKey: params.targetSessionKey,
        });
        latestReply = primaryReply;
      }
    }
    const targetAgentId = resolveAgentIdFromSessionKey(params.targetSessionKey);
    if (!latestReply?.trim()) {
      // Some runs finish without a textual assistant message (e.g. tool-only output).
      // Avoid silent failures in team chat; always provide a concise fallback status.
      const statusPart = waitStatus ? `status=${waitStatus}` : "status=unknown";
      const errorPart = waitError?.trim() ? ` error=${waitError.trim()}` : "";
      const fallbackMessage = `[delivery warning] ${targetAgentId} completed without assistant text (${statusPart}${errorPart}). Retry with another model/profile or check provider auth/rate limits.`;
      try {
        await injectIntoTeamChat({ senderAgentId: targetAgentId, message: fallbackMessage });
      } catch {
        // Non-critical.
      }
      log.warn("sessions_send announce skipped: no assistant output captured", {
        runId: runContextId,
        targetSessionKey: params.targetSessionKey,
        waitStatus,
        waitError,
      });
      return;
    }

    const announceTarget = await resolveAnnounceTarget({
      sessionKey: params.targetSessionKey,
      displayKey: params.displayKey,
    });
    const targetChannel = announceTarget?.channel ?? "unknown";

    if (
      params.maxPingPongTurns > 0 &&
      params.requesterSessionKey &&
      params.requesterSessionKey !== params.targetSessionKey
    ) {
      let currentSessionKey = params.requesterSessionKey;
      let nextSessionKey = params.targetSessionKey;
      let incomingMessage = latestReply;
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
        });
        if (!replyText || isReplySkip(replyText)) {
          break;
        }

        // Inject each ping-pong turn into root webchat for Slack-like visibility
        try {
          const speakerAgentId = resolveAgentIdFromSessionKey(currentSessionKey);
          await injectIntoTeamChat({ senderAgentId: speakerAgentId, message: replyText });
        } catch {
          // Non-critical
        }

        latestReply = replyText;
        incomingMessage = replyText;
        const swap = currentSessionKey;
        currentSessionKey = nextSessionKey;
        nextSessionKey = swap;
      }
    }

    const announcePrompt = buildAgentToAgentAnnounceContext({
      requesterSessionKey: params.requesterSessionKey,
      requesterChannel: params.requesterChannel,
      targetSessionKey: params.displayKey,
      targetChannel,
      originalMessage: params.message,
      roundOneReply: primaryReply,
      latestReply,
    });

    // Prefer announcing the actual last reply (already computed), because a second LLM call
    // for "announce" is fragile (rate limits, auth, etc.) and can make the agent look silent.
    let announceMessage = latestReply.trim();

    try {
      const announceReply = await runAgentStep({
        sessionKey: params.targetSessionKey,
        message: "Agent-to-agent announce step.",
        extraSystemPrompt: announcePrompt,
        timeoutMs: params.announceTimeoutMs,
        lane: AGENT_LANE_NESTED,
      });
      if (announceReply && announceReply.trim() && !isAnnounceSkip(announceReply)) {
        announceMessage = announceReply.trim();
      }
    } catch {
      // Fall back to latestReply.
    }

    // Deliver announce to an external channel when we can resolve a target. Otherwise,
    // always inject into the team chat so the requester isn't left hanging.
    if (announceTarget && announceTarget.channel !== "webchat" && announceTarget.to) {
      try {
        await callGateway({
          method: "send",
          params: {
            to: announceTarget.to,
            message: announceMessage,
            channel: announceTarget.channel,
            accountId: announceTarget.accountId,
            idempotencyKey: crypto.randomUUID(),
          },
          timeoutMs: 10_000,
        });
      } catch (err) {
        log.warn("sessions_send announce delivery failed", {
          runId: runContextId,
          channel: announceTarget.channel,
          to: announceTarget.to,
          error: formatErrorMessage(err),
        });
      }
      return;
    }

    try {
      await injectIntoTeamChat({ senderAgentId: targetAgentId, message: announceMessage });
    } catch (err) {
      log.warn("sessions_send announce inject failed", {
        runId: runContextId,
        error: formatErrorMessage(err),
      });
    }
  } catch (err) {
    log.warn("sessions_send announce flow failed", {
      runId: runContextId,
      error: formatErrorMessage(err),
    });
  }
}
