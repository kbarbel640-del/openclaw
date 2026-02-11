/**
 * Wexa-Service Plugin for OpenClaw
 *
 * Provides process flow management tools:
 * - processflow_list: List available process flows for an agent (with full input_schema)
 * - processflow_execute: Trigger process flow execution
 * - processflow_status: Check execution status
 *
 * ## Integration with data-service
 *
 * This plugin reads user context from the same global store that data-service writes to.
 * Call `data-service.setContext` before using these tools - no separate setup needed.
 *
 * ## Dynamic Prompt Injection
 *
 * On every agent start, this plugin fetches the user's available agents from
 * Identity-Service and injects their descriptions into the prompt. This allows
 * the LLM to match user requests to agent capabilities and route appropriately.
 * The injected prompt includes Project IDs, so no separate tool call is needed
 * to discover agents.
 *
 * ## Environment Variables:
 *
 * - `DATA_SERVICE_URL` — Base URL for the Data-Service API
 * - `DATA_SERVICE_SERVER_KEY` — Server key for system-level API calls
 * - `IDENTITY_SERVICE_URL` — Base URL for the Identity-Service API
 * - `IDENTITY_SERVICE_SERVER_KEY` — Server key for Identity-Service calls
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { resolveWexaServiceConfig } from "./src/config.js";
import { fetchUserAgentsPrompt } from "./src/fetch-user-agents.js";
import { PROCESSFLOW_GUIDANCE } from "./src/prompt-guidance.js";
import {
  getUserContextBySessionKey,
  setCurrentSessionKey,
  clearCurrentSessionKey,
} from "./src/request-context.js";
import { createProcessflowExecuteTool } from "./src/tool-processflow-execute.js";
import { createProcessflowListTool } from "./src/tool-processflow-list.js";
import { createProcessflowStatusTool } from "./src/tool-processflow-status.js";

/** Tool names registered by this plugin */
const TOOL_NAMES = ["processflow_list", "processflow_execute", "processflow_status"] as const;

const wexaServicePlugin = {
  id: "wexa-service",
  name: "Wexa Service",
  description: "Agent and process flow management tools",

  register(api: OpenClawPluginApi) {
    const config = resolveWexaServiceConfig(api.pluginConfig);

    // Skip registration if not enabled
    if (!config.enabled) {
      console.log("[wexa-service] Plugin disabled - DATA_SERVICE_URL not set");
      return;
    }

    // -- Tool registration ----------------------------------------------------

    api.registerTool(
      () => {
        const tools = [
          createProcessflowListTool(config),
          createProcessflowExecuteTool(config),
          createProcessflowStatusTool(config),
        ];
        return tools;
      },
      { names: [...TOOL_NAMES] },
    );

    // -- Lifecycle hooks ------------------------------------------------------

    // before_agent_start: inject process flow guidance + dynamic agent list
    api.on("before_agent_start", async (_event, ctx) => {
      let dynamicSection = "";

      try {
        if (ctx.sessionKey) {
          const userCtx = getUserContextBySessionKey(ctx.sessionKey);

          if (userCtx.userId) {
            const agentsPrompt = await fetchUserAgentsPrompt(config, userCtx.userId);
            if (agentsPrompt) {
              dynamicSection = `\n\n${agentsPrompt}`;
            }
          }
        }
      } catch (err) {
        console.warn("[wexa-service] Failed to fetch dynamic prompt:", err);
      }

      return {
        prependContext: `${PROCESSFLOW_GUIDANCE}${dynamicSection}`,
      };
    });

    // before_tool_call: set session context for tools
    api.on("before_tool_call", (_event, ctx) => {
      if (ctx.sessionKey) {
        setCurrentSessionKey(ctx.sessionKey);
      }
    });

    // after_tool_call: clear session context
    api.on("after_tool_call", () => {
      clearCurrentSessionKey();
    });

    // -- Gateway methods ------------------------------------------------------

    /**
     * wexa-service.status — Get the current status of the wexa-service plugin.
     */
    api.registerGatewayMethod("wexa-service.status", ({ respond }) => {
      respond(true, {
        status: "ok",
        enabled: config.enabled,
        dataServiceUrl: config.url,
        identityServiceUrl: config.identityServiceUrl,
        tools: [...TOOL_NAMES],
        note: "Uses same context as data-service. Call data-service.setContext before agent calls.",
      });
    });

    console.log("[wexa-service] Plugin registered with tools:", TOOL_NAMES.join(", "));
  },
};

export default wexaServicePlugin;
