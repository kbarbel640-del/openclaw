/**
 * processflow_execute tool: triggers a process flow execution.
 *
 * This tool calls the Data-Service API to start a process flow execution
 * and returns an execution_id that the frontend can use for polling.
 *
 * The execution is ASYNCHRONOUS — the tool returns immediately with an
 * execution_id, and the frontend polls for status via processflow_status
 * or direct API calls.
 */

import { jsonResult, readStringParam } from "openclaw/plugin-sdk";
import type { WexaServiceConfig } from "./config.js";
import { makeDataServiceRequest } from "./http.js";
import {
  getEffectiveUserContext,
  hasUserContext,
  MISSING_CONTEXT_ERROR,
} from "./request-context.js";
import { ProcessflowExecuteSchema } from "./schemas.js";

export function createProcessflowExecuteTool(config: WexaServiceConfig) {
  return {
    label: "Process Flow Execute",
    name: "processflow_execute",
    description: `Execute a process flow (agentflow) asynchronously.

**IMPORTANT: This is a PUSH action — always show the user what you're about to execute and get confirmation before calling this tool.**

**Prerequisites — do these BEFORE calling this tool:**
1. Called processflow_list to discover available flows, get agentflow_id, input_schema, and goal template
2. Collected ALL required input values from the user or context
3. Showed the user a preview of what will be executed and got confirmation

**Parameters:**
- project_id: The coworker's project ID (from coworker_list)
- agentflow_id: The process flow to execute (from processflow_list)
- goal: The goal template (from processflow_list, optionally filled with specifics)
- input_variables: JSON string of input field values matching the input_schema from processflow_list

**Returns:** execution_id for tracking. The frontend will automatically show execution progress.

**CRITICAL — After calling this tool:**
- Tell the user the execution has started
- The UI will automatically show execution progress in a panel
- Do NOT poll for status yourself unless the user specifically asks — the frontend handles it`,
    parameters: ProcessflowExecuteSchema,
    execute: async (_toolCallId: string, args: unknown) => {
      if (!hasUserContext()) {
        return jsonResult({ success: false, error: MISSING_CONTEXT_ERROR });
      }

      const userCtx = getEffectiveUserContext();
      const params = args as Record<string, unknown>;
      const projectId = readStringParam(params, "project_id", { required: true });
      const agentflowId = readStringParam(params, "agentflow_id", { required: true });
      const goal = readStringParam(params, "goal", { required: false }) || "";
      const inputVariablesStr = readStringParam(params, "input_variables", { required: false });

      if (!projectId) {
        return jsonResult({
          success: false,
          error: "project_id is required. Use coworker_list to get the projectId.",
        });
      }
      if (!agentflowId) {
        return jsonResult({
          success: false,
          error: "agentflow_id is required. Use processflow_list to get the agentflow ID.",
        });
      }

      // Parse input variables if provided
      let inputVariables: Record<string, unknown> | undefined;
      if (inputVariablesStr) {
        try {
          inputVariables = JSON.parse(inputVariablesStr);
        } catch {
          return jsonResult({
            success: false,
            error: `Invalid JSON in input_variables: ${inputVariablesStr}`,
          });
        }
      }

      // If no goal provided, try to fetch the goal template
      let resolvedGoal = goal;
      if (!resolvedGoal) {
        const schemaEndpoint = `/super_coworker/agentflow/${encodeURIComponent(agentflowId)}/goal_structure`;
        const schemaResult = await makeDataServiceRequest(schemaEndpoint, {
          method: "GET",
          config,
        });
        if (schemaResult.success) {
          const goalStructure = schemaResult.data as { template?: string };
          resolvedGoal = goalStructure?.template || "Execute process flow";
        }
      }

      // Build execution request body
      const body: Record<string, unknown> = {
        executed_by: {
          _id: userCtx.userId || "unknown",
          name: "AI_Pilot",
          type: "api",
          is_external_application: false,
        },
        agentflow_id: agentflowId,
        goal: resolvedGoal,
      };

      if (inputVariables && Object.keys(inputVariables).length > 0) {
        body.input_variables = inputVariables;
      }

      // Also fetch the flow name for the UI
      let flowName = agentflowId;
      let uiCard: string | undefined;
      try {
        const listEndpoint = `/super_coworker/agentflows?projectId=${encodeURIComponent(projectId)}&limit=50&page=1`;
        const listResult = await makeDataServiceRequest(listEndpoint, {
          method: "GET",
          config,
        });
        if (listResult.success) {
          const items =
            (listResult.data as { items?: Array<{ _id: string; name: string; ui_card?: string }> })
              ?.items ?? [];
          const matchingFlow = items.find((f) => f._id === agentflowId);
          if (matchingFlow) {
            flowName = matchingFlow.name;
            uiCard = matchingFlow.ui_card;
          }
        }
      } catch {
        // Non-critical — flow name is just for display
      }

      // Execute the flow
      const endpoint = `/super_coworker/execute_flow`;
      const result = await makeDataServiceRequest(endpoint, {
        method: "POST",
        body,
        config,
      });

      if (!result.success) {
        return jsonResult({
          success: false,
          error: result.error,
          agentflow_id: agentflowId,
          hint: "Check that the process flow exists and all required inputs are provided.",
        });
      }

      const resultData = result.data as {
        execution_id?: string;
        _id?: string;
      };

      const executionId = resultData?.execution_id || resultData?._id || "";

      return jsonResult({
        success: true,
        execution_id: executionId,
        agentflow_id: agentflowId,
        project_id: projectId,
        flow_name: flowName,
        goal: resolvedGoal,
        input_variables: inputVariables || {},
        ui_card: uiCard,
        status: "running",
        message: `Process flow "${flowName}" has been triggered. Execution ID: ${executionId}`,
        hint: "The frontend will show execution progress automatically. Tell the user the execution has started.",
      });
    },
  };
}
