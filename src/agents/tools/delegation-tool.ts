import { z } from "zod";
import { resolveSessionAgentId } from "../agent-scope.js";
import { zodToToolJsonSchema } from "../schema/zod-tool-schema.js";
import { type AnyAgentTool, jsonResult, readStringParam } from "./common.js";
import { callGatewayTool } from "./gateway.js";

const DELEGATION_ACTIONS = [
  "delegate",
  "request",
  "review",
  "accept",
  "complete",
  "reject",
  "status",
  "list",
  "pending",
] as const;

const DELEGATION_PRIORITIES = ["critical", "high", "normal", "low"] as const;
const REVIEW_DECISIONS = ["approve", "reject", "redirect"] as const;

const DelegationToolSchema = zodToToolJsonSchema(
  z.object({
    action: z
      .enum(DELEGATION_ACTIONS)
      .describe(
        "delegate: assign a task to a subordinate (downward). " +
          "request: request help from your immediate superior (upward, requires justification). " +
          "review: superior reviews an upward request (approve/reject/redirect). " +
          "accept: accept an assigned delegation and start work. " +
          "complete: mark delegation as completed with result. " +
          "reject: reject a delegation. " +
          "status: get a single delegation record. " +
          "list: list delegations for current agent. " +
          "pending: list pending reviews for current agent.",
      ),
    toAgentId: z
      .string()
      .describe(
        "Target agent ID (required for delegate; optional for request because system auto-routes to immediate superior)",
      )
      .optional(),
    task: z.string().describe("Task description (for delegate/request)").optional(),
    priority: z
      .enum(DELEGATION_PRIORITIES)
      .describe("Priority level (for delegate/request, default: normal)")
      .optional(),
    justification: z
      .string()
      .describe("Justification for the request (required for upward requests)")
      .optional(),
    delegationId: z
      .string()
      .describe("Delegation ID (for review/accept/complete/reject/status)")
      .optional(),
    decision: z.enum(REVIEW_DECISIONS).describe("Review decision (for review action)").optional(),
    reasoning: z.string().describe("Reasoning for the review decision (for review)").optional(),
    redirectToAgentId: z
      .string()
      .describe("Agent to redirect to (for review with redirect decision)")
      .optional(),
    redirectReason: z
      .string()
      .describe("Reason for redirecting (for review with redirect)")
      .optional(),
    resultStatus: z
      .enum(["success", "failure", "partial"])
      .describe("Result status (for complete action)")
      .optional(),
    resultSummary: z.string().describe("Summary of the result (for complete action)").optional(),
    direction: z
      .enum(["downward", "upward"])
      .describe("Filter by direction (for list action)")
      .optional(),
  }),
);

export function createDelegationTool(opts?: { agentSessionKey?: string }): AnyAgentTool {
  return {
    label: "Delegation",
    name: "delegation",
    description:
      "Hierarchical task delegation: delegate tasks to subordinates, request help from superiors, " +
      "review upward requests. Supports downward delegation (direct assignment) and upward requests " +
      "(requires justification and superior review). Use 'delegate' for subordinates, 'request' for superiors.",
    parameters: DelegationToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const action = readStringParam(params, "action", { required: true });
      const agentId = resolveSessionAgentId({ sessionKey: opts?.agentSessionKey });

      if (action === "delegate" || action === "request") {
        const toAgentId = readStringParam(params, "toAgentId", { required: action === "delegate" });
        const task = readStringParam(params, "task", { required: true });
        const priority = readStringParam(params, "priority") ?? "normal";
        const justification = readStringParam(params, "justification");

        const result = await callGatewayTool(
          "delegation.create",
          {},
          {
            fromAgentId: agentId,
            fromSessionKey: opts?.agentSessionKey ?? `agent:${agentId}:main`,
            toAgentId,
            task,
            priority,
            justification,
            mode: action,
          },
        );
        return jsonResult(result);
      }

      if (action === "review") {
        const delegationId = readStringParam(params, "delegationId", { required: true });
        const decision = readStringParam(params, "decision", { required: true });
        const reasoning = readStringParam(params, "reasoning", { required: true });
        const redirectToAgentId = readStringParam(params, "redirectToAgentId");
        const redirectReason = readStringParam(params, "redirectReason");

        const result = await callGatewayTool(
          "delegation.review",
          {},
          {
            delegationId,
            reviewerId: agentId,
            decision,
            reasoning,
            redirectToAgentId,
            redirectReason,
          },
        );
        return jsonResult(result);
      }

      if (action === "accept") {
        const delegationId = readStringParam(params, "delegationId", { required: true });
        const result = await callGatewayTool(
          "delegation.accept",
          {},
          {
            delegationId,
            agentId,
          },
        );
        return jsonResult(result);
      }

      if (action === "complete") {
        const delegationId = readStringParam(params, "delegationId", { required: true });
        const resultStatus = readStringParam(params, "resultStatus", { required: true });
        const resultSummary = readStringParam(params, "resultSummary", { required: true });

        const result = await callGatewayTool(
          "delegation.complete",
          {},
          {
            delegationId,
            agentId,
            resultStatus,
            resultSummary,
          },
        );
        return jsonResult(result);
      }

      if (action === "reject") {
        const delegationId = readStringParam(params, "delegationId", { required: true });
        const reasoning = readStringParam(params, "reasoning");

        const result = await callGatewayTool(
          "delegation.reject",
          {},
          {
            delegationId,
            agentId,
            reasoning,
          },
        );
        return jsonResult(result);
      }

      if (action === "status") {
        const delegationId = readStringParam(params, "delegationId", { required: true });
        const result = await callGatewayTool("delegation.get", {}, { delegationId });
        return jsonResult(result);
      }

      if (action === "list") {
        const direction = readStringParam(params, "direction");
        const result = await callGatewayTool(
          "delegation.list",
          {},
          {
            agentId,
            direction,
          },
        );
        return jsonResult(result);
      }

      if (action === "pending") {
        const result = await callGatewayTool("delegation.pending", {}, { agentId });
        return jsonResult(result);
      }

      throw new Error(`Unknown delegation action: ${action}`);
    },
  };
}
