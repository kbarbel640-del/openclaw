import { Type } from "@sinclair/typebox";

import { loadConfig } from "../../config/config.js";
import { logVerbose } from "../../globals.js";
import { logDebug } from "../../logger.js";
import { callGateway } from "../../gateway/call.js";
import {
  getSubagentRun,
  updateSubagentRun,
  type SubagentRunStatus,
} from "../subagent-registry.js";
import type { AnyAgentTool } from "./common.js";
import { jsonResult, readStringParam } from "./common.js";
import {
  extractAssistantText,
  resolveDisplaySessionKey,
  resolveMainSessionAlias,
  stripToolMessages,
} from "./sessions-helpers.js";

const SessionsWaitToolSchema = Type.Object({
  runId: Type.String(),
  timeoutSeconds: Type.Optional(Type.Integer({ minimum: 0 })),
  includeMessages: Type.Optional(Type.Boolean()),
  messageLimit: Type.Optional(Type.Integer({ minimum: 0 })),
});

function extractLatestAssistantReply(messages: unknown[]): string | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const text = extractAssistantText(messages[i]);
    if (text) return text;
  }
  return undefined;
}

function normalizeWaitStatus(value?: string): SubagentRunStatus | undefined {
  if (value === "ok") return "ok";
  if (value === "error") return "error";
  if (value === "timeout") return "timeout";
  return undefined;
}

export function createSessionsWaitTool(): AnyAgentTool {
  return {
    label: "Session Wait",
    name: "sessions_wait",
    description:
      "Check a spawned sub-agent run. Returns status plus recent messages if available.",
    parameters: SessionsWaitToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const runId = readStringParam(params, "runId", { required: true });

      const record = getSubagentRun(runId);
      if (!record) {
        logDebug(`sessions_wait missing runId=${runId}`);
        return jsonResult({
          runId,
          status: "unknown",
          error: "runId not found in subagent registry",
        });
      }

      const timeoutSeconds =
        typeof params.timeoutSeconds === "number" &&
        Number.isFinite(params.timeoutSeconds)
          ? Math.max(0, Math.floor(params.timeoutSeconds))
          : 5;
      const timeoutMs = Math.min(timeoutSeconds * 1000, 30_000);
      const includeMessages = params.includeMessages !== false;
      const messageLimitRaw =
        typeof params.messageLimit === "number" &&
        Number.isFinite(params.messageLimit)
          ? Math.max(0, Math.floor(params.messageLimit))
          : 5;
      const messageLimit = Math.min(messageLimitRaw, 20);

      logDebug(
        `sessions_wait start runId=${runId} timeoutSeconds=${timeoutSeconds} includeMessages=${includeMessages} messageLimit=${messageLimit}`,
      );
      if (includeMessages && !record.childSessionKey) {
        logVerbose(`sessions_wait runId=${runId} has no child session key`);
      }

      let waitStatus: string | undefined;
      let waitError: string | undefined;
      if (timeoutMs > 0) {
        logDebug(`sessions_wait wait runId=${runId} timeoutMs=${timeoutMs}`);
        try {
          const wait = (await callGateway({
            method: "agent.wait",
            params: {
              runId,
              timeoutMs,
            },
            timeoutMs: timeoutMs + 2000,
          })) as { status?: string; error?: string };
          waitStatus = typeof wait?.status === "string" ? wait.status : undefined;
          waitError = typeof wait?.error === "string" ? wait.error : undefined;
          logVerbose(`sessions_wait status=${waitStatus ?? "unknown"} runId=${runId}`);
        } catch (err) {
          logDebug(`sessions_wait wait error runId=${runId}: ${String(err)}`);
          const messageText =
            err instanceof Error
              ? err.message
              : typeof err === "string"
                ? err
                : "error";
          waitStatus = messageText.includes("gateway timeout")
            ? "timeout"
            : "error";
          waitError = messageText;
        }
      }

      const normalizedStatus = normalizeWaitStatus(waitStatus) ?? "running";
      updateSubagentRun(runId, {
        lastStatus:
          normalizedStatus === "timeout" ? "running" : normalizedStatus,
        lastCheckedAt: Date.now(),
      });

      let messages: unknown[] | undefined;
      let latestReply: string | undefined;
      if (includeMessages && record.childSessionKey) {
        const history = (await callGateway({
          method: "chat.history",
          params: {
            sessionKey: record.childSessionKey,
            limit: messageLimit > 0 ? messageLimit : 10,
          },
        })) as { messages?: unknown[] };
        const filtered = stripToolMessages(
          Array.isArray(history?.messages) ? history.messages : [],
        );
        messages = filtered;
        latestReply = extractLatestAssistantReply(filtered);
        logDebug(`sessions_wait history runId=${runId} messages=${filtered.length}`);
      }

      const cfg = loadConfig();
      const { mainKey, alias } = resolveMainSessionAlias(cfg);
      const displayKey = resolveDisplaySessionKey({
        key: record.childSessionKey,
        alias,
        mainKey,
      });

      return jsonResult({
        runId,
        status: normalizedStatus === "timeout" ? "running" : normalizedStatus,
        waitStatus,
        error: waitError,
        childSessionKey: displayKey,
        latestReply,
        messages,
      });
    },
  };
}

