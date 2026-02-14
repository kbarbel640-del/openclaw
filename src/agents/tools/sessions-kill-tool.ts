import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "./common.js";
import { jsonResult, readStringParam } from "./common.js";
import { loadConfig } from "../../config/config.js";
import { callGateway } from "../../gateway/call.js";
import { isSubagentSessionKey } from "../../routing/session-key.js";
import { abortEmbeddedPiRun } from "../pi-embedded.js";
import { isAncestor, getSubtreeLeafFirst } from "./sessions-lineage.js";
import { getRunByChildKey } from "../subagent-registry.js";
import { resolveInternalSessionKey, resolveMainSessionAlias } from "./sessions-helpers.js";

const SessionsKillToolSchema = Type.Object({
  sessionKey: Type.String(),
  cascade: Type.Optional(Type.Boolean()),
});

type KillResult = {
  sessionKey: string;
  runId?: string;
  status: "aborted" | "not_found" | "error";
  via: "embedded" | "gateway" | "none";
  error?: string;
};

function resolveKillList(targetKey: string, cascade: boolean): string[] {
  if (!cascade) {
    return [targetKey];
  }
  const keys = getSubtreeLeafFirst(targetKey).filter((key) => key !== targetKey);
  keys.push(targetKey);
  return Array.from(new Set(keys));
}

function toErrorText(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

export function createSessionsKillTool(opts?: { agentSessionKey?: string }): AnyAgentTool {
  return {
    label: "Sessions",
    name: "sessions_kill",
    description: "Abort a subagent session run, optionally cascading to descendants.",
    parameters: SessionsKillToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const cfg = loadConfig();
      const { mainKey, alias } = resolveMainSessionAlias(cfg);
      const requesterRaw = opts?.agentSessionKey?.trim();
      const requesterKey = requesterRaw
        ? resolveInternalSessionKey({
            key: requesterRaw,
            alias,
            mainKey,
          })
        : undefined;

      const targetRaw = readStringParam(params, "sessionKey", { required: true });
      const targetKey = resolveInternalSessionKey({
        key: targetRaw,
        alias,
        mainKey,
      });
      const cascade = params.cascade !== false;

      if (!isSubagentSessionKey(targetKey)) {
        return jsonResult({
          status: "error",
          error: "sessionKey must be a subagent session key.",
        });
      }

      const callerIsSubagent = isSubagentSessionKey(requesterKey ?? "");
      if (
        callerIsSubagent &&
        requesterKey &&
        requesterKey !== targetKey &&
        !isAncestor(requesterKey, targetKey)
      ) {
        return jsonResult({
          status: "forbidden",
          error: "You can only kill sessions inside your spawn subtree.",
        });
      }

      const killList = resolveKillList(targetKey, cascade);
      const results: KillResult[] = [];

      for (const key of killList) {
        const run = getRunByChildKey(key);
        if (!run) {
          results.push({ sessionKey: key, status: "not_found", via: "none" });
          continue;
        }

        let abortedEmbedded = false;
        try {
          abortedEmbedded = abortEmbeddedPiRun(run.childSessionKey);
        } catch {
          abortedEmbedded = false;
        }

        if (abortedEmbedded) {
          results.push({
            sessionKey: key,
            runId: run.runId,
            status: "aborted",
            via: "embedded",
          });
          continue;
        }

        try {
          await callGateway({
            method: "agent.abort",
            params: {
              runId: run.runId,
            },
          });
          results.push({
            sessionKey: key,
            runId: run.runId,
            status: "aborted",
            via: "gateway",
          });
        } catch (err) {
          results.push({
            sessionKey: key,
            runId: run.runId,
            status: "error",
            via: "none",
            error: toErrorText(err),
          });
        }
      }

      const aborted = results.filter((entry) => entry.status === "aborted").length;
      const notFound = results.filter((entry) => entry.status === "not_found").length;
      const failed = results.filter((entry) => entry.status === "error").length;
      const status =
        failed > 0
          ? "partial"
          : aborted === 0 && notFound === results.length
            ? "not_found"
            : "ok";

      return jsonResult({
        status,
        target: targetKey,
        cascade,
        requestedBy: requesterKey,
        aborted,
        notFound,
        failed,
        results,
      });
    },
  };
}
