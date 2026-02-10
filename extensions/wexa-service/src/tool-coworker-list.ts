/**
 * Coworker list tool: lists all projects/coworkers the user has access to.
 *
 * This tool calls the Identity-Service API to retrieve the user's projects
 * with details like name, role, description, and projectId.
 */

import { jsonResult } from "openclaw/plugin-sdk";
import type { WexaServiceConfig } from "./config.js";
import { makeIdentityServiceRequest } from "./http.js";
import {
  getEffectiveUserContext,
  hasUserContext,
  MISSING_CONTEXT_ERROR,
} from "./request-context.js";
import { CoworkerListSchema } from "./schemas.js";

export function createCoworkerListTool(config: WexaServiceConfig) {
  return {
    label: "Coworker List",
    name: "coworker_list",
    description: `List all projects/coworkers the user has access to. Returns project details including name, role, description, and projectId.

**Use this when:**
- User asks about their projects or coworkers
- You need to know what projects/coworkers are available
- User wants to see their workspace structure
- You need projectId for other operations

This is a read-only/pull action — execute autonomously without asking permission.`,
    parameters: CoworkerListSchema,
    execute: async (_toolCallId: string, _args: unknown) => {
      // Check if user context is set
      if (!hasUserContext()) {
        return jsonResult({ success: false, error: MISSING_CONTEXT_ERROR });
      }

      const userCtx = getEffectiveUserContext();
      const { userId } = userCtx;

      // Debug logging to verify context is being received
      console.log("[wexa-service] coworker_list called with context:", {
        userId,
        hasContext: !!userId,
      });

      const endpoint = `/system/user-projects?userId=${encodeURIComponent(userId || "")}`;
      const result = await makeIdentityServiceRequest(endpoint, {
        method: "GET",
        config,
      });

      // Debug logging to see API response
      console.log("[wexa-service] coworker_list API response:", {
        success: result.success,
        error: result.error,
      });

      if (!result.success) {
        return jsonResult({ success: false, error: result.error });
      }

      const responseData = result.data as {
        projects?: Array<{
          agentKey: string;
          projectId: string;
          projectName: string;
          description: string;
          coworkerRole: string;
          orgId: string;
          onboardingStep: number;
        }>;
        products?: Record<string, unknown>;
        total?: number;
      };

      return jsonResult({
        success: true,
        description: "Projects/coworkers accessible to the user",
        projects: responseData.projects || [],
        products: responseData.products || {},
        total: responseData.total || 0,
      });
    },
  };
}
