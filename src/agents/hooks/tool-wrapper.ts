import type { AnyAgentTool } from "../tools/common.js";
import { HookRunner } from "./hook-runner.js";

export function wrapToolWithHookSystem(tool: AnyAgentTool, runner: HookRunner): AnyAgentTool {
  return {
    ...tool,
    execute: async (toolCallId, args) => {
      const result = await runner.runHooks(tool.name, args);

      if (result.action === "deny") {
        throw new Error(`Tool execution denied by hook: ${result.message || "No reason provided"}`);
      }

      if (result.action === "ask") {
        // In a real implementation, we would pause execution and ask the user.
        // For now, we'll log it and deny, or throw a special error that the specialized agent can handle.
        // Since we don't have a UI loop here yet to ask, we'll deny with a specific message.
        throw new Error(
          `Tool execution requires approval (hook 'ask'): ${result.message || "No reason provided"}`,
        );
      }

      return tool.execute(toolCallId, args);
    },
  };
}
