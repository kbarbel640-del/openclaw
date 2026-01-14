import crypto from "node:crypto";

import { Type } from "@sinclair/typebox";

import { normalizeChannelId } from "../../channels/registry.js";
import { loadConfig } from "../../config/config.js";
import {
  loadSessionStore,
  resolveAgentIdFromSessionKey,
  resolveMainSessionKey,
  resolveStorePath,
} from "../../config/sessions.js";
import { callGateway } from "../../gateway/call.js";
import { isSubagentSessionKey } from "../../routing/session-key.js";
import type { AnyAgentTool } from "./common.js";
import { jsonResult, readStringParam } from "./common.js";

const ReportBackToolSchema = Type.Object({
  message: Type.String({
    description: "The message to report back to the requester",
  }),
  label: Type.Optional(
    Type.String({ description: "Optional label for the report" }),
  ),
  internalOnly: Type.Optional(
    Type.Boolean({
      description:
        "If true, only inject to main session transcript without sending to external messaging channels (Telegram, WhatsApp, etc.). Use this for silent/internal tasks.",
    }),
  ),
});

/**
 * Creates a report_back tool that allows subagents to send results back to the main session.
 *
 * This tool:
 * 1. Injects the message into the main session transcript so the main agent has context
 * 2. Broadcasts to webchat UI for immediate display
 * 3. Sends to messaging channels (Telegram, WhatsApp, etc.) if the main session has one
 * 4. Only works from subagent sessions (returns error otherwise)
 */
export function createReportBackTool(opts?: {
  agentSessionKey?: string;
  subagentLabel?: string;
}): AnyAgentTool {
  return {
    label: "Report Back",
    name: "report_back",
    description:
      "Report results back to the main session. Call this at the end of your task to share your findings with the user. The message will appear in the main chat and any connected messaging channels (unless internalOnly is true).",
    parameters: ReportBackToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const message = readStringParam(params, "message", { required: true });
      const labelParam = readStringParam(params, "label");
      const internalOnly = params.internalOnly === true;

      const agentSessionKey = opts?.agentSessionKey;

      // Only allow from subagent sessions
      if (!agentSessionKey || !isSubagentSessionKey(agentSessionKey)) {
        return jsonResult({
          status: "error",
          error: "report_back is only available to subagent sessions",
        });
      }

      const cfg = loadConfig();
      const mainKey = resolveMainSessionKey(cfg);

      if (!mainKey) {
        return jsonResult({
          status: "error",
          error: "Could not resolve main session",
        });
      }

      // Build label for the injected message
      const label = labelParam?.trim() || opts?.subagentLabel;
      const labelText = label
        ? `Subagent "${label}" report`
        : "Subagent report";

      const trimmedMessage = message.trim();
      let injected = false;
      let sentToChannel = false;

      try {
        // Inject into main session transcript via chat.inject
        // This also broadcasts to webchat UI
        await callGateway({
          method: "chat.inject",
          params: {
            sessionKey: mainKey,
            message: trimmedMessage,
            label: labelText,
          },
          timeoutMs: 10_000,
        });
        injected = true;
      } catch {
        // Best-effort injection
      }

      // Also send to messaging channel if the main session has one (unless internalOnly)
      if (!internalOnly) {
        try {
          const mainAgentId = resolveAgentIdFromSessionKey(mainKey);
          const mainStorePath = resolveStorePath(cfg.session?.store, {
            agentId: mainAgentId,
          });
          const mainEntry = loadSessionStore(mainStorePath)[mainKey];
          const mainChannel = mainEntry?.lastChannel;
          const mainTo = mainEntry?.lastTo;

          // Only send if it's a real messaging channel (not webchat/internal)
          const isMessagingChannel = Boolean(
            mainChannel && mainTo && normalizeChannelId(mainChannel),
          );

          if (isMessagingChannel && mainChannel && mainTo) {
            await callGateway({
              method: "send",
              params: {
                to: mainTo,
                message: trimmedMessage,
                channel: mainChannel,
                accountId: mainEntry?.lastAccountId,
                idempotencyKey: crypto.randomUUID(),
              },
              timeoutMs: 10_000,
            });
            sentToChannel = true;
          }
        } catch {
          // Best-effort send to messaging channel
        }
      }

      if (!injected && !sentToChannel) {
        return jsonResult({
          status: "error",
          error: "Failed to deliver message to any destination",
        });
      }

      return jsonResult({
        status: "ok",
        delivered: true,
        injected,
        sentToChannel,
      });
    },
  };
}
