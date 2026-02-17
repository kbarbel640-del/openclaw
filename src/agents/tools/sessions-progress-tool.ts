import { z } from "zod";
import { clearSessionQueues } from "../../auto-reply/reply/queue.js";
import { loadConfig } from "../../config/config.js";
import { emitAgentEvent } from "../../infra/agent-events.js";
import { abortEmbeddedPiRun } from "../pi-embedded.js";
import { zodToToolJsonSchema } from "../schema/zod-tool-schema.js";
import { getSubagentRunBySessionKey } from "../subagent-registry.js";
import type { AnyAgentTool } from "./common.js";
import { jsonResult, readStringParam } from "./common.js";
import { resolveInternalSessionKey, resolveMainSessionAlias } from "./sessions-helpers.js";

const SessionsProgressToolSchema = zodToToolJsonSchema(
  z.object({
    sessionKey: z.string().describe("The session key of the spawned subagent"),
  }),
);

const SessionsAbortToolSchema = zodToToolJsonSchema(
  z.object({
    sessionKey: z.string().describe("The session key of the subagent to abort"),
  }),
);

export function createSessionsProgressTool(_opts?: { agentSessionKey?: string }): AnyAgentTool {
  return {
    label: "Sessions Progress",
    name: "sessions_progress",
    description:
      "Query the current progress and status of a spawned subagent. Returns real-time progress, status, and resource usage.",
    parameters: SessionsProgressToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const targetSessionKey = readStringParam(params, "sessionKey", { required: true });

      const cfg = loadConfig();
      const { mainKey, alias } = resolveMainSessionAlias(cfg);

      // Resolve the target session key to internal format
      const internalTargetKey = resolveInternalSessionKey({
        key: targetSessionKey,
        alias,
        mainKey,
      });

      // Find the run record
      const run = getSubagentRunBySessionKey(internalTargetKey);
      if (!run) {
        return jsonResult({
          status: "not_found",
          error: `No subagent run found for session key: ${targetSessionKey}`,
        });
      }

      // Determine current status
      let status: "running" | "completed" | "error";
      if (run.outcome) {
        status = run.outcome.status === "ok" ? "completed" : "error";
      } else {
        status = run.startedAt ? "running" : "running";
      }

      return jsonResult({
        status,
        runId: run.runId,
        sessionKey: run.childSessionKey,
        task: run.task,
        label: run.label,
        progress: run.progress ?? {
          percent: 0,
          status: "initializing",
          lastUpdate: run.createdAt,
        },
        usage: run.usage,
        startedAt: run.startedAt,
        endedAt: run.endedAt,
        outcome: run.outcome,
      });
    },
  };
}

export function createSessionsAbortTool(opts?: { agentSessionKey?: string }): AnyAgentTool {
  return {
    label: "Sessions Abort",
    name: "sessions_abort",
    description:
      "Abort a running subagent. Cancels execution and marks the run as aborted. Use this when you need to stop a subagent that's taking too long or is no longer needed.",
    parameters: SessionsAbortToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const targetSessionKey = readStringParam(params, "sessionKey", { required: true });

      const cfg = loadConfig();
      const { mainKey, alias } = resolveMainSessionAlias(cfg);
      const requesterSessionKey = opts?.agentSessionKey;

      // Resolve the target session key to internal format
      const internalTargetKey = resolveInternalSessionKey({
        key: targetSessionKey,
        alias,
        mainKey,
      });

      // Find the run record
      const run = getSubagentRunBySessionKey(internalTargetKey);
      if (!run) {
        return jsonResult({
          status: "not_found",
          error: `No subagent run found for session key: ${targetSessionKey}`,
        });
      }

      // Verify requester has permission to abort this subagent
      if (requesterSessionKey) {
        const internalRequesterKey = resolveInternalSessionKey({
          key: requesterSessionKey,
          alias,
          mainKey,
        });

        if (run.requesterSessionKey !== internalRequesterKey) {
          return jsonResult({
            status: "forbidden",
            error: "You can only abort subagents you spawned",
          });
        }
      }

      // Check if already ended
      if (run.endedAt) {
        const alreadyStatus = run.outcome?.status === "ok" ? "completed" : "error";
        return jsonResult({
          status: "already_ended",
          message: `Subagent already ${alreadyStatus}`,
          runId: run.runId,
          endedAt: run.endedAt,
        });
      }

      // Abort the run
      let _aborted = false;
      const childKey = run.childSessionKey;

      // Clear queues
      clearSessionQueues([childKey]);

      // Abort embedded PI run if session has one
      // We need to get the sessionId from the session entry
      try {
        const sessionEntry = run.childSessionKey;
        if (sessionEntry) {
          // Try to abort via the session's current run
          _aborted = abortEmbeddedPiRun(run.runId) || false;
        }
      } catch {
        // Best effort
      }

      // Mark the run as aborted
      run.endedAt = Date.now();
      run.outcome = {
        status: "error",
        error: "Aborted by parent agent",
      };

      // Emit abort event
      emitAgentEvent({
        runId: run.runId,
        stream: "lifecycle",
        sessionKey: run.childSessionKey,
        data: {
          phase: "error",
          error: "Aborted by parent agent",
          endedAt: run.endedAt,
        },
      });

      return jsonResult({
        status: "aborted",
        runId: run.runId,
        sessionKey: run.childSessionKey,
        abortedAt: run.endedAt,
        message: "Subagent execution aborted successfully",
      });
    },
  };
}
