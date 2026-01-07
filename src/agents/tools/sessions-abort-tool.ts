import { Type } from "@sinclair/typebox";

import { callGateway } from "../../gateway/call.js";
import { logDebug, logWarn } from "../../logger.js";
import type { AnyAgentTool } from "./common.js";
import { jsonResult, readStringParam } from "./common.js";

const SessionsAbortToolSchema = Type.Object({
  runId: Type.String(),
  sessionKey: Type.Optional(Type.String()),
  cleanup: Type.Optional(Type.Union([Type.Literal("delete"), Type.Literal("keep")])),
  deleteTranscript: Type.Optional(Type.Boolean()),
});

export function createSessionsAbortTool(): AnyAgentTool {
  return {
    label: "Session Abort",
    name: "sessions_abort",
    description:
      "Abort an in-flight run (chat.abort). Optionally delete the child session when cleanup=delete.",
    parameters: SessionsAbortToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const runId = readStringParam(params, "runId", { required: true });
      const sessionKey = readStringParam(params, "sessionKey");
      const cleanup =
        params.cleanup === "delete" || params.cleanup === "keep"
          ? (params.cleanup as "delete" | "keep")
          : undefined;
      const deleteTranscript =
        typeof params.deleteTranscript === "boolean" ? params.deleteTranscript : false;

      logDebug(`sessions_abort start runId=${runId} sessionKey=${sessionKey ?? ""}`);

      let aborted = false;
      try {
        const res = (await callGateway({
          method: "chat.abort",
          params: {
            sessionKey: sessionKey ?? "",
            runId,
          },
          timeoutMs: 10_000,
        })) as { aborted?: boolean };
        aborted = Boolean(res?.aborted);
      } catch (err) {
        logWarn(`sessions_abort chat.abort failed: ${String(err)}`);
      }

      if (cleanup === "delete" && sessionKey) {
        try {
          await callGateway({
            method: "sessions.delete",
            params: { key: sessionKey, deleteTranscript },
            timeoutMs: 10_000,
          });
        } catch (err) {
          logWarn(`sessions_abort cleanup failed: ${String(err)}`);
        }
      }

      return jsonResult({
        ok: true,
        runId,
        sessionKey: sessionKey ?? null,
        aborted,
        cleanup: cleanup ?? null,
      });
    },
  };
}
