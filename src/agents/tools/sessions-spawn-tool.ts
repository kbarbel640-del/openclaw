import { Type } from "@sinclair/typebox";
import type { GatewayMessageChannel } from "../../utils/message-channel.js";
import type { AnyAgentTool } from "./common.js";
import { normalizeDeliveryContext } from "../../utils/delivery-context.js";
import { optionalStringEnum } from "../schema/typebox.js";
import { SpawnError, spawnCore } from "../spawn-core.js";
import { jsonResult, readStringParam } from "./common.js";

const SessionsSpawnToolSchema = Type.Object({
  task: Type.String(),
  label: Type.Optional(Type.String()),
  agentId: Type.Optional(Type.String()),
  model: Type.Optional(Type.String()),
  thinking: Type.Optional(Type.String()),
  runTimeoutSeconds: Type.Optional(Type.Number({ minimum: 0 })),
  // Back-compat alias. Prefer runTimeoutSeconds.
  timeoutSeconds: Type.Optional(Type.Number({ minimum: 0 })),
  cleanup: optionalStringEnum(["delete", "keep"] as const),
});

function normalizeTimeoutSeconds(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.max(0, Math.floor(value));
}

export function createSessionsSpawnTool(opts?: {
  agentSessionKey?: string;
  agentChannel?: GatewayMessageChannel;
  agentAccountId?: string;
  agentTo?: string;
  agentThreadId?: string | number;
  agentGroupId?: string | null;
  agentGroupChannel?: string | null;
  agentGroupSpace?: string | null;
  sandboxed?: boolean;
  /** Explicit agent ID override for cron/hook sessions where session key parsing may not work. */
  requesterAgentIdOverride?: string;
}): AnyAgentTool {
  return {
    label: "Sessions",
    name: "sessions_spawn",
    description:
      "Spawn a background sub-agent run in an isolated session and announce the result back to the requester chat.",
    parameters: SessionsSpawnToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const task = readStringParam(params, "task", { required: true });
      const explicitRunTimeoutSeconds =
        normalizeTimeoutSeconds(params.runTimeoutSeconds) ??
        normalizeTimeoutSeconds(params.timeoutSeconds);
      const requesterOrigin = normalizeDeliveryContext({
        channel: opts?.agentChannel,
        accountId: opts?.agentAccountId,
        to: opts?.agentTo,
        threadId: opts?.agentThreadId,
      });

      try {
        const result = await spawnCore({
          task,
          label: typeof params.label === "string" ? params.label : undefined,
          requestedAgentId: readStringParam(params, "agentId"),
          modelOverride: readStringParam(params, "model"),
          thinkingOverrideRaw: readStringParam(params, "thinking"),
          explicitRunTimeoutSeconds,
          cleanup:
            params.cleanup === "keep" || params.cleanup === "delete" ? params.cleanup : "keep",
          requesterSessionKey: opts?.agentSessionKey,
          requesterOrigin,
          requesterAgentIdOverride: opts?.requesterAgentIdOverride,
          agentGroupId: opts?.agentGroupId,
          agentGroupChannel: opts?.agentGroupChannel,
          agentGroupSpace: opts?.agentGroupSpace,
        });
        return jsonResult(result);
      } catch (err) {
        if (err instanceof SpawnError) {
          return jsonResult(err.details);
        }
        throw err;
      }
    },
  };
}
