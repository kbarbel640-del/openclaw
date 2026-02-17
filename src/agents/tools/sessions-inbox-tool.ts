import { z } from "zod";
import { resolveAgentIdFromSessionKey } from "../../routing/session-key.js";
import { zodToToolJsonSchema } from "../schema/zod-tool-schema.js";
import { readInboxByAgent, readInboxBySession } from "./agent-inbox.js";
import type { AnyAgentTool } from "./common.js";
import { jsonResult } from "./common.js";

const SessionsInboxToolSchema = zodToToolJsonSchema(
  z.object({
    scope: z
      .string()
      .describe(
        'Read scope: "session" (messages to this session) or "agent" (all messages to this agent). Default: "agent".',
      )
      .optional(),
  }),
);

export function createSessionsInboxTool(opts?: { agentSessionKey?: string }): AnyAgentTool {
  return {
    label: "Session Inbox",
    name: "sessions_inbox",
    description:
      "Read inbound messages from other agents. Messages arrive instantly without waiting for LLM processing. Use this to check for incoming pings, requests, or information from peer agents.",
    parameters: SessionsInboxToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const scope = typeof params.scope === "string" ? params.scope.trim() : "agent";
      const sessionKey = opts?.agentSessionKey ?? "";
      const agentId = resolveAgentIdFromSessionKey(sessionKey);

      let messages;
      if (scope === "session") {
        messages = readInboxBySession(sessionKey);
      } else {
        messages = readInboxByAgent(agentId);
      }

      const formatted = messages.map((msg) => ({
        id: msg.id,
        from: msg.fromAgentId,
        message: msg.message,
        timestamp: msg.timestamp,
        age: `${Math.round((Date.now() - msg.timestamp) / 1000)}s ago`,
      }));

      return jsonResult({
        count: formatted.length,
        messages: formatted,
      });
    },
  };
}
