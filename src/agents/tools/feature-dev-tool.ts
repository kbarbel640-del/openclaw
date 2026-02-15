import { z } from "zod";
import { zodToToolJsonSchema } from "../schema/zod-tool-schema.js";
import { FeatureDevWorkflow } from "../workflows/feature-dev.js";
import { type AnyAgentTool, jsonResult, readStringParam } from "./common.js";

const FeatureDevStartSchema = zodToToolJsonSchema(
  z.object({
    request: z.string().describe("The initial feature request description"),
  }),
);

// In-memory store for active workflows (for demo purposes)
// In production, this would be persisted in the database
const activeWorkflows = new Map<string, FeatureDevWorkflow>();

// Schema for advancing the workflow
const FeatureDevAdvanceSchema = zodToToolJsonSchema(
  z.object({
    workflowId: z.string().describe("The workflow ID to advance (optional if only one active)"),
  }),
);

export function createFeatureDevTools(): AnyAgentTool[] {
  return [
    {
      label: "Feature Dev Start",
      name: "feature_dev_start",
      description: "Start a guided feature development workflow (Discovery -> Exploration -> ...)",
      parameters: FeatureDevStartSchema,
      execute: async (_toolCallId, args) => {
        const params = args as Record<string, unknown>;
        const request = readStringParam(params, "request", { required: true });

        const workflow = new FeatureDevWorkflow(request);
        const workflowId = `feat-${Date.now()}`;
        activeWorkflows.set(workflowId, workflow);

        // Run the first step (Discovery)
        await workflow.runStep();

        return jsonResult({
          status: "started",
          workflowId,
          currentPhase: workflow.getState().currentPhase,
          message:
            "Feature development workflow started. Workflow is now in EXPLORATION phase. Use feature_dev_advance to proceed.",
        });
      },
    },
    {
      label: "Feature Dev Advance",
      name: "feature_dev_advance",
      description: "Advance an active feature development workflow to the next phase",
      parameters: FeatureDevAdvanceSchema,
      execute: async (_toolCallId, args) => {
        const params = args as Record<string, unknown>;
        let workflowId = readStringParam(params, "workflowId");

        if (!workflowId) {
          // unexpected: if multiple, fail. if one, use it.
          if (activeWorkflows.size === 1) {
            workflowId = activeWorkflows.keys().next().value;
          } else if (activeWorkflows.size === 0) {
            return jsonResult({ error: "No active workflows found." });
          } else {
            return jsonResult({ error: "Multiple active workflows. Please specify workflowId." });
          }
        }

        const workflow = activeWorkflows.get(workflowId!);
        if (!workflow) {
          return jsonResult({ error: `Workflow ${workflowId} not found.` });
        }

        try {
          const newState = await workflow.runStep();
          return jsonResult({
            status: "advanced",
            workflowId,
            currentPhase: newState.currentPhase,
            message: `Workflow advanced to ${newState.currentPhase}`,
            state: newState,
          });
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error);
          return jsonResult({ error: `Failed to advance workflow: ${msg}` });
        }
      },
    },
  ];
}
