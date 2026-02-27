/**
 * tasks-tool.ts
 *
 * Agent tool for managing the user's task list. Tasks are stored in the
 * memory SQLite DB (tasks table) and can be auto-captured from sessions
 * or manually created by the agent/user.
 *
 * Actions: list | add | done | dismiss
 */

import { Type } from "@sinclair/typebox";
import { stringEnum } from "../schema/typebox.js";
import { type AnyAgentTool, jsonResult, readStringParam } from "./common.js";
import { callGatewayTool, readGatewayCallOptions } from "./gateway.js";

const TASK_ACTIONS = ["list", "add", "done", "dismiss"] as const;

const TasksToolSchema = Type.Object({
  action: stringEnum(TASK_ACTIONS, {
    description:
      "Action to perform. 'list' returns open tasks, 'add' creates a new task, 'done' marks a task complete, 'dismiss' removes a task without completing it.",
  }),
  text: Type.Optional(Type.String({ description: "Task description. Required for 'add'." })),
  due: Type.Optional(
    Type.String({ description: "Due date in YYYY-MM-DD format. Optional for 'add'." }),
  ),
  priority: Type.Optional(
    Type.String({ description: "Priority: low, normal, or high. Default: normal. For 'add'." }),
  ),
  id: Type.Optional(Type.String({ description: "Task ID. Required for 'done' and 'dismiss'." })),
  status: Type.Optional(
    Type.String({
      description: "Filter by status for 'list'. Default: 'open'. Options: open, done, dismissed.",
    }),
  ),
  gatewayUrl: Type.Optional(Type.String()),
  gatewayToken: Type.Optional(Type.String()),
  timeoutMs: Type.Optional(Type.Number()),
});

export function createTasksTool(options?: { agentSessionKey?: string }): AnyAgentTool {
  return {
    label: "Tasks",
    name: "tasks",
    description:
      "Manage the user's task list. Use 'list' to check open tasks (especially at conversation start), " +
      "'add' to create tasks when the user mentions something they need to do, " +
      "'done' to mark tasks complete, 'dismiss' to remove irrelevant tasks.",
    parameters: TasksToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const action = readStringParam(params, "action", { required: true });
      const gatewayOpts = readGatewayCallOptions(params);

      const rpcParams: Record<string, unknown> = {
        action,
        sessionKey: options?.agentSessionKey ?? "main",
      };

      if (action === "add") {
        rpcParams.text = readStringParam(params, "text", { required: true });
        const due = readStringParam(params, "due");
        if (due) {
          rpcParams.due = due;
        }
        const priority = readStringParam(params, "priority");
        if (priority) {
          rpcParams.priority = priority;
        }
      }

      if (action === "done" || action === "dismiss") {
        rpcParams.id = readStringParam(params, "id", { required: true });
      }

      if (action === "list") {
        const status = readStringParam(params, "status");
        if (status) {
          rpcParams.status = status;
        }
      }

      const result = await callGatewayTool("memory.tasks", gatewayOpts, rpcParams);
      return jsonResult(result);
    },
  };
}
