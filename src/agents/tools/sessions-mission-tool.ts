import { Type } from "@sinclair/typebox";
import type { GatewayMessageChannel } from "../../utils/message-channel.js";
import type { AnyAgentTool } from "./common.js";
import { loadConfig } from "../../config/config.js";
import { normalizeAgentId, parseAgentSessionKey } from "../../routing/session-key.js";
import { normalizeDeliveryContext } from "../../utils/delivery-context.js";
import { resolveAgentConfig } from "../agent-scope.js";
import { optionalStringEnum } from "../schema/typebox.js";
import { createMission } from "../subagent-mission.js";
import { jsonResult, readStringParam } from "./common.js";
import {
  resolveDisplaySessionKey,
  resolveInternalSessionKey,
  resolveMainSessionAlias,
} from "./sessions-helpers.js";

const SessionsMissionToolSchema = Type.Object({
  label: Type.String(),
  subtasks: Type.Array(
    Type.Object({
      id: Type.String(),
      agentId: Type.String(),
      task: Type.String(),
      after: Type.Optional(Type.Array(Type.String())),
    }),
    { minItems: 1 },
  ),
  cleanup: optionalStringEnum(["delete", "keep"] as const),
  maxTotalSpawns: Type.Optional(Type.Number({ minimum: 1 })),
});

export function createSessionsMissionTool(opts?: {
  agentSessionKey?: string;
  agentChannel?: GatewayMessageChannel;
  agentAccountId?: string;
  agentTo?: string;
  agentThreadId?: string | number;
  agentGroupId?: string | null;
  agentGroupChannel?: string | null;
  agentGroupSpace?: string | null;
  sandboxed?: boolean;
  requesterAgentIdOverride?: string;
}): AnyAgentTool {
  return {
    label: "Sessions",
    name: "sessions_mission",
    description:
      "Orchestrate a multi-agent mission with dependency ordering. Subtasks run in parallel when possible, with results from completed subtasks injected into dependent ones. Returns a single synthesized announcement when the entire mission completes.",
    parameters: SessionsMissionToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const label = readStringParam(params, "label", { required: true });
      const cleanup =
        params.cleanup === "keep" || params.cleanup === "delete" ? params.cleanup : "keep";
      const maxTotalSpawns =
        typeof params.maxTotalSpawns === "number" &&
        Number.isFinite(params.maxTotalSpawns) &&
        params.maxTotalSpawns >= 1
          ? Math.floor(params.maxTotalSpawns)
          : undefined;

      const rawSubtasks = params.subtasks;
      if (!Array.isArray(rawSubtasks) || rawSubtasks.length === 0) {
        return jsonResult({ status: "error", error: "subtasks required" });
      }

      const cfg = loadConfig();
      const { mainKey, alias } = resolveMainSessionAlias(cfg);
      const requesterSessionKey = opts?.agentSessionKey;
      const requesterInternalKey = requesterSessionKey
        ? resolveInternalSessionKey({
            key: requesterSessionKey,
            alias,
            mainKey,
          })
        : alias;
      const requesterDisplayKey = resolveDisplaySessionKey({
        key: requesterInternalKey,
        alias,
        mainKey,
      });

      const requesterAgentId = normalizeAgentId(
        opts?.requesterAgentIdOverride ?? parseAgentSessionKey(requesterInternalKey)?.agentId,
      );

      // Validate agent IDs in subtasks
      const requesterConfig = resolveAgentConfig(cfg, requesterAgentId);
      const allowAgents = requesterConfig?.subagents?.allowAgents ?? [];
      const allowAny = allowAgents.some((v) => v.trim() === "*");
      const allowSet = new Set(
        allowAgents
          .filter((v) => v.trim() && v.trim() !== "*")
          .map((v) => normalizeAgentId(v).toLowerCase()),
      );

      const subtaskInputs: Array<{
        id: string;
        agentId: string;
        task: string;
        after?: string[];
      }> = [];

      for (const raw of rawSubtasks) {
        if (!raw || typeof raw !== "object") {
          return jsonResult({
            status: "error",
            error: "Invalid subtask entry",
          });
        }
        const entry = raw as Record<string, unknown>;
        const id = typeof entry.id === "string" ? entry.id.trim() : "";
        const agentId = typeof entry.agentId === "string" ? entry.agentId.trim() : "";
        const task = typeof entry.task === "string" ? entry.task.trim() : "";
        const after = Array.isArray(entry.after)
          ? entry.after
              .filter((v): v is string => typeof v === "string")
              .map((v) => v.trim())
              .filter(Boolean)
          : undefined;

        if (!id || !agentId || !task) {
          return jsonResult({
            status: "error",
            error: `Subtask missing required fields (id, agentId, task)`,
          });
        }

        const normalizedTarget = normalizeAgentId(agentId);
        if (
          normalizedTarget !== requesterAgentId &&
          !allowAny &&
          !allowSet.has(normalizedTarget.toLowerCase())
        ) {
          const allowedText = allowAny
            ? "*"
            : allowSet.size > 0
              ? Array.from(allowSet).join(", ")
              : "none";
          return jsonResult({
            status: "forbidden",
            error: `agentId "${agentId}" is not allowed (allowed: ${allowedText})`,
          });
        }

        subtaskInputs.push({
          id,
          agentId: normalizedTarget,
          task,
          after: after && after.length > 0 ? after : undefined,
        });
      }

      const requesterOrigin = normalizeDeliveryContext({
        channel: opts?.agentChannel,
        accountId: opts?.agentAccountId,
        to: opts?.agentTo,
        threadId: opts?.agentThreadId,
      });

      const result = createMission({
        label,
        subtasks: subtaskInputs,
        requesterSessionKey: requesterInternalKey,
        requesterOrigin,
        requesterDisplayKey,
        cleanup,
        maxTotalSpawns,
      });

      if ("error" in result) {
        return jsonResult({ status: "error", error: result.error });
      }

      return jsonResult({
        status: "accepted",
        missionId: result.missionId,
        subtaskCount: subtaskInputs.length,
        label,
      });
    },
  };
}
