/**
 * processflow_list tool: lists all process flows (agentflows) for a given project.
 *
 * This tool calls the Data-Service API to retrieve available process flows
 * that can be executed for a specific coworker/project.
 *
 * The API returns full input_schema and template in the response, so this
 * is the only tool needed to discover flows and their input requirements.
 */

import { jsonResult } from "openclaw/plugin-sdk";
import type { WexaServiceConfig } from "./config.js";
import { makeDataServiceRequest } from "./http.js";
import { hasUserContext, MISSING_CONTEXT_ERROR } from "./request-context.js";
import { ProcessflowListSchema } from "./schemas.js";

export function createProcessflowListTool(config: WexaServiceConfig) {
  return {
    label: "Process Flow List",
    name: "processflow_list",
    description: `List all process flows (agentflows) available for a coworker/project with full input schemas.

**Use this when:**
- User mentions a specific coworker via @mention and you need to see what it can do
- User asks "what can [coworker] do?" or "show me [coworker]'s workflows"
- You need to discover available process flows before executing one
- You need the agentflow_id and input_schema before calling processflow_execute

**Prerequisites:**
- Call coworker_list first to get the projectId for the target coworker

**Returns:** List of process flows with:
- id: The agentflow_id to use with processflow_execute
- name: Display name of the flow
- role: Description of what the flow does
- description: Detailed description
- template: Goal template string
- input_schema: Array of input fields with id, title, type, required, description
- ui_card: Optional UI card type

This is a read-only/pull action — execute autonomously without asking permission.`,
    parameters: ProcessflowListSchema,
    execute: async (_toolCallId: string, args: unknown) => {
      if (!hasUserContext()) {
        return jsonResult({ success: false, error: MISSING_CONTEXT_ERROR });
      }

      const params = args as Record<string, unknown>;
      const projectId = params.project_id as string;

      if (!projectId) {
        return jsonResult({
          success: false,
          error:
            "project_id is required. Use coworker_list to get the projectId for the target coworker.",
        });
      }

      const endpoint = `/super_coworker/agentflows?projectId=${encodeURIComponent(projectId)}&limit=50&page=1`;
      const result = await makeDataServiceRequest(endpoint, {
        method: "GET",
        config,
      });

      if (!result.success) {
        return jsonResult({ success: false, error: result.error });
      }

      const responseData = result.data as {
        items?: Array<{
          _id: string;
          name: string;
          role?: string;
          description?: string;
          template?: string;
          input_schema?: Array<{
            id: string;
            title: string;
            type: string;
            required: boolean;
            description?: string;
            options?: string[];
          }>;
          ui_card?: string;
        }>;
        total_count?: number;
      };

      const items = responseData?.items ?? [];

      // Return full flow info including input_schema and template
      const flows = items.map((flow) => {
        const inputSchema = flow.input_schema ?? [];
        const requiredFields = inputSchema.filter((f) => f.required);
        const optionalFields = inputSchema.filter((f) => !f.required);

        return {
          id: flow._id,
          name: flow.name,
          role: flow.role || "",
          description: flow.description || "",
          template: flow.template || "",
          input_schema: inputSchema,
          required_fields: requiredFields.map((f) => f.title || f.id),
          optional_fields: optionalFields.map((f) => f.title || f.id),
          ui_card: flow.ui_card,
        };
      });

      return jsonResult({
        success: true,
        description: `Found ${flows.length} process flow(s) for project ${projectId}`,
        flows,
        total: flows.length,
        hint: flows.some((f) => f.required_fields.length > 0)
          ? "Some flows have required inputs. Collect these from the user before calling processflow_execute."
          : "Flows are ready to execute. Use processflow_execute with agentflow_id and project_id.",
      });
    },
  };
}
