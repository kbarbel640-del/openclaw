import { z } from "zod";
import { resolveSessionAgentId } from "../agent-scope.js";
import { zodToToolJsonSchema } from "../schema/zod-tool-schema.js";
import { type AnyAgentTool, jsonResult, readStringArrayParam, readStringParam } from "./common.js";
import { callGatewayTool } from "./gateway.js";

const COLLAB_ACTIONS = [
  "session.init",
  "session.create_focused",
  "session.invite",
  "proposal.publish",
  "proposal.challenge",
  "proposal.agree",
  "decision.finalize",
  "dispute.escalate",
  "session.get",
  "thread.get",
  "poll",
  "poll.vote",
  "poll.get",
  "submit_review",
  "review.submit",
  "review.get",
  "review.list",
  "standup",
] as const;

const CollaborationToolSchema = zodToToolJsonSchema(
  z.object({
    action: z
      .enum(COLLAB_ACTIONS)
      .describe(
        "session.init: create a collaborative debate session. " +
          "session.create_focused: create a private/focused session (not broadcast to team chat). " +
          "session.invite: invite an agent to join an existing session mid-debate. " +
          "proposal.publish: submit a proposal to a decision thread. " +
          "proposal.challenge: challenge an existing proposal. " +
          "proposal.agree: agree with a decision. " +
          "decision.finalize: moderator finalizes a decision (requires min 3 debate rounds). " +
          "dispute.escalate: escalate a dispute to the immediate superior in the hierarchy. " +
          "session.get: read full session state. " +
          "thread.get: read a specific decision thread. " +
          "poll: create a quick yes/no or multi-choice poll. " +
          "poll.vote: cast a vote in a poll. " +
          "poll.get: read poll status + tally. " +
          "submit_review: submit work for async review. " +
          "review.submit: submit review feedback. " +
          "review.get: read a review request. " +
          "review.list: list review requests. " +
          "standup: get aggregated status of all active agents.",
      ),
    topic: z.string().describe("Session topic (for session.init)").optional(),
    agents: z
      .array(z.string())
      .describe("Agent IDs to include in the session (for session.init, minimum 2)")
      .optional(),
    moderator: z.string().describe("Moderator agent ID (for session.init, optional)").optional(),
    sessionKey: z
      .string()
      .describe("Collaboration session key (returned by session.init)")
      .optional(),
    decisionTopic: z
      .string()
      .describe("Topic for the decision thread (for proposal.publish)")
      .optional(),
    proposal: z.string().describe("The proposal text (for proposal.publish)").optional(),
    reasoning: z
      .string()
      .describe("Reasoning behind the proposal (for proposal.publish)")
      .optional(),
    decisionId: z
      .string()
      .describe("Decision thread ID (for proposal.challenge, proposal.agree, decision.finalize)")
      .optional(),
    challenge: z.string().describe("Challenge text (for proposal.challenge)").optional(),
    suggestedAlternative: z
      .string()
      .describe("Alternative suggestion when challenging (for proposal.challenge, optional)")
      .optional(),
    finalDecision: z
      .string()
      .describe("The final decision text (for decision.finalize)")
      .optional(),
    question: z.string().describe("Poll question (for poll)").optional(),
    options: z.array(z.string()).describe("Poll options (for poll)").optional(),
    voters: z.array(z.string()).describe("Agent IDs to poll (for poll)").optional(),
    timeoutSeconds: z.number().describe("Poll timeout in seconds (for poll, optional)").optional(),
    pollId: z.string().describe("Poll id (for poll.vote, poll.get)").optional(),
    choice: z.string().describe("Selected option (for poll.vote)").optional(),
    artifact: z.string().describe("Work artifact to review (for submit_review)").optional(),
    reviewers: z.array(z.string()).describe("Agent IDs to review (for submit_review)").optional(),
    context: z
      .string()
      .describe("Additional context for review (for submit_review, optional)")
      .optional(),
    reviewId: z.string().describe("Review request id (for review.submit/review.get)").optional(),
    approved: z.boolean().describe("Whether the review is approved (for review.submit)").optional(),
    feedback: z.string().describe("Optional review feedback (for review.submit)").optional(),
    completed: z.boolean().describe("Filter completed reviews (for review.list)").optional(),
    inviteAgentId: z
      .string()
      .describe("Agent ID to invite to the session (for session.invite)")
      .optional(),
  }),
);

export function createCollaborationTool(opts?: { agentSessionKey?: string }): AnyAgentTool {
  return {
    label: "Collaboration",
    name: "collaboration",
    description:
      "Multi-agent collaboration: create debate sessions, publish proposals, challenge or agree with proposals, and finalize decisions. " +
      "Use session.init to start a collaborative session, then proposal.publish/challenge/agree to debate, and decision.finalize to conclude.",
    parameters: CollaborationToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const action = readStringParam(params, "action", { required: true });
      const agentId = resolveSessionAgentId({ sessionKey: opts?.agentSessionKey });

      if (action === "session.init") {
        const topic = readStringParam(params, "topic", { required: true });
        const agents = readStringArrayParam(params, "agents", { required: true });
        const moderator = readStringParam(params, "moderator");
        const result = await callGatewayTool(
          "collab.session.init",
          {},
          { topic, agents, moderator },
        );
        return jsonResult(result);
      }

      if (action === "session.create_focused") {
        const topic = readStringParam(params, "topic", { required: true });
        const agents = readStringArrayParam(params, "agents", { required: true });
        const result = await callGatewayTool(
          "collab.session.create_focused",
          {},
          { topic, agents, createdBy: agentId },
        );
        return jsonResult(result);
      }

      if (action === "session.invite") {
        const sessionKey = readStringParam(params, "sessionKey", { required: true });
        const inviteAgentId = readStringParam(params, "inviteAgentId", { required: true });
        const result = await callGatewayTool(
          "collab.session.invite",
          {},
          { sessionKey, agentId: inviteAgentId, invitedBy: agentId },
        );
        return jsonResult(result);
      }

      if (action === "dispute.escalate") {
        const sessionKey = readStringParam(params, "sessionKey", { required: true });
        const decisionId = readStringParam(params, "decisionId", { required: true });
        const reason = readStringParam(params, "reasoning", { required: true });
        const result = await callGatewayTool(
          "collab.dispute.escalate",
          {},
          { sessionKey, decisionId, escalatingAgentId: agentId, reason },
        );
        return jsonResult(result);
      }

      if (action === "proposal.publish") {
        const sessionKey = readStringParam(params, "sessionKey", { required: true });
        const decisionTopic = readStringParam(params, "decisionTopic", { required: true });
        const proposal = readStringParam(params, "proposal", { required: true });
        const reasoning = readStringParam(params, "reasoning", { required: true });
        const result = await callGatewayTool(
          "collab.proposal.publish",
          {},
          {
            sessionKey,
            agentId,
            decisionTopic,
            proposal,
            reasoning,
          },
        );
        return jsonResult(result);
      }

      if (action === "proposal.challenge") {
        const sessionKey = readStringParam(params, "sessionKey", { required: true });
        const decisionId = readStringParam(params, "decisionId", { required: true });
        const challenge = readStringParam(params, "challenge", { required: true });
        const suggestedAlternative = readStringParam(params, "suggestedAlternative");
        const result = await callGatewayTool(
          "collab.proposal.challenge",
          {},
          {
            sessionKey,
            decisionId,
            agentId,
            challenge,
            suggestedAlternative,
          },
        );
        return jsonResult(result);
      }

      if (action === "proposal.agree") {
        const sessionKey = readStringParam(params, "sessionKey", { required: true });
        const decisionId = readStringParam(params, "decisionId", { required: true });
        const result = await callGatewayTool(
          "collab.proposal.agree",
          {},
          {
            sessionKey,
            decisionId,
            agentId,
          },
        );
        return jsonResult(result);
      }

      if (action === "decision.finalize") {
        const sessionKey = readStringParam(params, "sessionKey", { required: true });
        const decisionId = readStringParam(params, "decisionId", { required: true });
        const finalDecision = readStringParam(params, "finalDecision", { required: true });
        const result = await callGatewayTool(
          "collab.decision.finalize",
          {},
          {
            sessionKey,
            decisionId,
            finalDecision,
            moderatorId: agentId,
          },
        );
        return jsonResult(result);
      }

      if (action === "session.get") {
        const sessionKey = readStringParam(params, "sessionKey", { required: true });
        const result = await callGatewayTool(
          "collab.session.get",
          {},
          { sessionKey, requesterId: agentId },
        );
        return jsonResult(result);
      }

      if (action === "thread.get") {
        const sessionKey = readStringParam(params, "sessionKey", { required: true });
        const decisionId = readStringParam(params, "decisionId", { required: true });
        const result = await callGatewayTool(
          "collab.thread.get",
          {},
          {
            sessionKey,
            decisionId,
            requesterId: agentId,
          },
        );
        return jsonResult(result);
      }

      if (action === "poll") {
        const question = readStringParam(params, "question", { required: true });
        const options = readStringArrayParam(params, "options", { required: true });
        const voters = readStringArrayParam(params, "voters", { required: true });
        const timeoutSeconds =
          typeof params.timeoutSeconds === "number" ? params.timeoutSeconds : undefined;
        const result = await callGatewayTool(
          "collab.poll",
          {},
          {
            question,
            options,
            voters,
            timeoutSeconds,
            initiatorId: agentId,
          },
        );
        return jsonResult(result);
      }

      if (action === "submit_review") {
        const artifact = readStringParam(params, "artifact", { required: true });
        const reviewers = readStringArrayParam(params, "reviewers", { required: true });
        const context = readStringParam(params, "context");
        const result = await callGatewayTool(
          "collab.submit_review",
          {},
          {
            artifact,
            reviewers,
            context,
            submitterId: agentId,
          },
        );
        return jsonResult(result);
      }

      if (action === "poll.vote") {
        const pollId = readStringParam(params, "pollId", { required: true });
        const choice = readStringParam(params, "choice", { required: true });
        const result = await callGatewayTool("collab.poll.vote", {}, { pollId, agentId, choice });
        return jsonResult(result);
      }

      if (action === "poll.get") {
        const pollId = readStringParam(params, "pollId", { required: true });
        const result = await callGatewayTool(
          "collab.poll.get",
          {},
          { pollId, requesterId: agentId },
        );
        return jsonResult(result);
      }

      if (action === "review.submit") {
        const reviewId = readStringParam(params, "reviewId", { required: true });
        const approvedRaw = params.approved;
        if (typeof approvedRaw !== "boolean") {
          throw new Error("approved is required for review.submit");
        }
        const feedback = readStringParam(params, "feedback");
        const result = await callGatewayTool(
          "collab.review.submit",
          {},
          {
            reviewId,
            reviewerId: agentId,
            approved: approvedRaw,
            feedback,
          },
        );
        return jsonResult(result);
      }

      if (action === "review.get") {
        const reviewId = readStringParam(params, "reviewId", { required: true });
        const result = await callGatewayTool(
          "collab.review.get",
          {},
          {
            reviewId,
            requesterId: agentId,
          },
        );
        return jsonResult(result);
      }

      if (action === "review.list") {
        const completedRaw = params.completed;
        const completed = typeof completedRaw === "boolean" ? completedRaw : undefined;
        const result = await callGatewayTool(
          "collab.review.list",
          {},
          {
            completed,
            requesterId: agentId,
          },
        );
        return jsonResult(result);
      }

      if (action === "standup") {
        const result = await callGatewayTool("collab.standup", {}, {});
        return jsonResult(result);
      }

      throw new Error(`Unknown collaboration action: ${action}`);
    },
  };
}
