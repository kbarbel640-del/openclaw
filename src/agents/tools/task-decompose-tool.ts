/**
 * Tool: task_decompose
 *
 * Allows orchestrator/lead agents to decompose complex tasks into a subtask DAG.
 * Performs local analysis (complexity, agent matching) and returns an execution plan
 * that can be fed into sessions_spawn_batch.
 */

import { z } from "zod";
import { zodToToolJsonSchema } from "../schema/zod-tool-schema.js";
import { analyzeTaskForDecomposition, processDecomposition } from "../task-decomposition.js";
import type { AnyAgentTool } from "./common.js";
import { jsonResult } from "./common.js";

const subtaskShape = z.object({
  id: z.string(),
  description: z.string(),
  dependencies: z.array(z.string()).optional(),
  requiredCapabilities: z.array(z.string()).optional(),
});

const TaskDecomposeToolSchema = zodToToolJsonSchema(
  z.object({
    task: z.string().describe("The complex task to decompose into subtasks"),
    subtasks: z.array(subtaskShape).optional(),
  }),
);

export function createTaskDecomposeTool(): AnyAgentTool {
  return {
    label: "Planning",
    name: "task_decompose",
    description:
      "Analyze a complex task and decompose it into a subtask DAG with dependency ordering and agent assignment. " +
      "Call without subtasks to get a complexity analysis. Call with subtasks to validate the DAG and assign agents.",
    parameters: TaskDecomposeToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const task = typeof params.task === "string" ? params.task.trim() : "";

      if (!task) {
        return jsonResult({
          status: "error",
          error: "Task is required",
        });
      }

      const rawSubtasks = Array.isArray(params.subtasks) ? params.subtasks : null;

      // If subtasks are provided, validate and process them.
      if (rawSubtasks && rawSubtasks.length > 0) {
        const result = processDecomposition(
          rawSubtasks as Array<{
            id: string;
            description: string;
            dependencies?: string[];
            requiredCapabilities?: string[];
          }>,
        );

        return jsonResult({
          status: result.decomposed ? "ok" : "error",
          ...result,
          spawnReady: result.decomposed
            ? result.phases.map((phase, idx) => ({
                phase: idx + 1,
                tasks: phase.map((node) => ({
                  agentId: node.assignedAgent ?? "unassigned",
                  task: node.description,
                  label: node.id,
                })),
              }))
            : undefined,
        });
      }

      // No subtasks: analyze whether decomposition is needed.
      const analysis = analyzeTaskForDecomposition(task);

      return jsonResult({
        status: "ok",
        ...analysis,
        hint: analysis.decomposed
          ? "Call task_decompose again with subtasks array to validate your decomposition plan and get agent assignments."
          : undefined,
      });
    },
  };
}
