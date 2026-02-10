/**
 * processflow_status tool: polls execution status for a running process flow.
 *
 * This tool calls the Data-Service API to check the current status of
 * a process flow execution. The frontend typically handles polling
 * automatically, but the AI can use this if the user asks about status.
 */

import { jsonResult, readStringParam } from "openclaw/plugin-sdk";
import type { WexaServiceConfig } from "./config.js";
import { makeDataServiceRequest } from "./http.js";
import { hasUserContext, MISSING_CONTEXT_ERROR } from "./request-context.js";
import { ProcessflowStatusSchema } from "./schemas.js";

export function createProcessflowStatusTool(config: WexaServiceConfig) {
  return {
    label: "Process Flow Status",
    name: "processflow_status",
    description: `Check the execution status of a running process flow.

**Use this when:**
- User asks "what's the status of the execution?"
- User asks "is it done yet?"
- You need to check if an execution completed before proceeding

**NOTE:** The frontend automatically polls for status and shows progress.
You generally do NOT need to call this — only use it if the user explicitly asks.

**Returns:** Current status, execution logs, and conclusion (if completed).

This is a read-only/pull action — execute autonomously without asking permission.`,
    parameters: ProcessflowStatusSchema,
    execute: async (_toolCallId: string, args: unknown) => {
      if (!hasUserContext()) {
        return jsonResult({ success: false, error: MISSING_CONTEXT_ERROR });
      }

      const params = args as Record<string, unknown>;
      const executionId = readStringParam(params, "execution_id", { required: true });

      if (!executionId) {
        return jsonResult({
          success: false,
          error: "execution_id is required.",
        });
      }

      const endpoint = `/execute_flow/${encodeURIComponent(executionId)}`;
      const result = await makeDataServiceRequest(endpoint, {
        method: "GET",
        config,
      });

      if (!result.success) {
        return jsonResult({
          success: false,
          error: result.error,
          execution_id: executionId,
        });
      }

      const executionData = result.data as {
        status?: string;
        execution_context?: Record<string, unknown>;
        analytics?: {
          overall?: {
            total_tokens?: number;
            total_execution_time?: number;
            total_price?: number;
          };
        };
        conclusion?: string;
        agentflow?: {
          name?: string;
          unique_id?: string;
        };
      };

      const status = executionData?.status || "unknown";
      const isTerminal = ["completed", "failed", "cancelled"].includes(status);

      return jsonResult({
        success: true,
        execution_id: executionId,
        status,
        is_terminal: isTerminal,
        flow_name: executionData?.agentflow?.name,
        unique_id: executionData?.agentflow?.unique_id,
        conclusion: executionData?.conclusion,
        analytics: executionData?.analytics?.overall,
        hint: isTerminal
          ? `Execution ${status}. ${executionData?.conclusion ? `Conclusion: ${executionData.conclusion}` : ""}`
          : "Execution is still running. The frontend shows live progress.",
      });
    },
  };
}
