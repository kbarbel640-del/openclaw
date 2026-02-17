/**
 * DELEGATION GATEWAY HANDLERS
 *
 * RPC handlers for the hierarchical delegation system.
 * Pattern follows collaboration.ts.
 */

import { AGENT_ROLE_RANK, resolveAgentRole } from "../../agents/agent-scope.js";
import { evaluateDelegationRequest } from "../../agents/delegation-decision-tree.js";
import {
  completeDelegation,
  getAgentDelegationMetrics,
  getDelegation,
  listDelegationsForAgent,
  listPendingReviewsForAgent,
  registerDelegation,
  reviewDelegation,
  updateDelegationState,
} from "../../agents/delegation-registry.js";
import type { DelegationDirection, DelegationReview } from "../../agents/delegation-types.js";
import type { DelegationRecord } from "../../agents/delegation-types.js";
import { resolvePreferredSuperior } from "../../agents/hierarchy-superior.js";
import { resolveAgentIdentity } from "../../agents/identity.js";
import { loadConfig } from "../../config/config.js";
import {
  resolveAgentMainSessionKey,
  resolveMainSessionKey,
} from "../../config/sessions/main-session.js";
import { defaultRuntime } from "../../runtime.js";
import { delegationAutoRunScheduler } from "../delegation-auto-run.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import { broadcastHierarchyFullRefresh } from "../server-hierarchy-events.js";
import { injectChatMessage } from "./chat.js";
import type { GatewayRequestContext, GatewayRequestHandlers } from "./types.js";

function assertDelegationReviewer(params: { record: DelegationRecord; reviewerId: string }): void {
  if (params.record.toAgentId !== params.reviewerId) {
    throw new Error(
      `Reviewer ${params.reviewerId} is not authorized to review delegation ${params.record.id}`,
    );
  }
}

function assertDelegationAssignee(params: {
  record: DelegationRecord;
  agentId: string;
  action: "accept" | "complete" | "reject";
}): void {
  if (params.record.toAgentId !== params.agentId) {
    throw new Error(
      `Agent ${params.agentId} is not authorized to ${params.action} delegation ${params.record.id}`,
    );
  }
}

function notifyAgentSession(params: {
  context: Pick<GatewayRequestContext, "broadcast" | "nodeSendToSession" | "agentRunSeq">;
  cfg: ReturnType<typeof loadConfig>;
  agentId: string;
  message: string;
  senderAgentId?: string;
  label?: string;
}): void {
  const targetSessionKey = resolveAgentMainSessionKey({ cfg: params.cfg, agentId: params.agentId });
  const senderId = params.senderAgentId ?? params.agentId;
  const senderIdentity = resolveAgentIdentity(params.cfg, senderId);
  injectChatMessage({
    context: params.context,
    sessionKey: targetSessionKey,
    label: params.label ?? "delegation",
    message: params.message,
    senderIdentity: {
      agentId: senderId,
      name: senderIdentity?.name ?? senderId,
      emoji: senderIdentity?.emoji,
      avatar: senderIdentity?.avatar,
    },
  });
}

export function resolveDelegationCreateTarget(params: {
  cfg: ReturnType<typeof loadConfig>;
  fromAgentId: string;
  toAgentId?: string;
  mode?: "delegate" | "request";
}): { toAgentId: string; toRole: ReturnType<typeof resolveAgentRole>; rerouted: boolean } {
  const { cfg, fromAgentId, mode } = params;
  const fromRole = resolveAgentRole(cfg, fromAgentId);
  const requestedTarget = params.toAgentId?.trim() || undefined;

  if (!requestedTarget && mode !== "request") {
    throw new Error("toAgentId is required for delegation.create");
  }

  if (!requestedTarget && mode === "request") {
    const preferred = resolvePreferredSuperior(cfg, fromAgentId);
    if (!preferred) {
      throw new Error("No superior available for upward request");
    }
    return {
      toAgentId: preferred.superiorId,
      toRole: preferred.superiorRole,
      rerouted: true,
    };
  }

  const target = requestedTarget as string;
  const targetRole = resolveAgentRole(cfg, target);
  const upward = AGENT_ROLE_RANK[fromRole] < AGENT_ROLE_RANK[targetRole] || mode === "request";

  if (!upward) {
    return {
      toAgentId: target,
      toRole: targetRole,
      rerouted: false,
    };
  }

  const preferred = resolvePreferredSuperior(cfg, fromAgentId);
  if (!preferred) {
    return {
      toAgentId: target,
      toRole: targetRole,
      rerouted: false,
    };
  }
  if (preferred.superiorId === target) {
    return {
      toAgentId: target,
      toRole: targetRole,
      rerouted: false,
    };
  }

  return {
    toAgentId: preferred.superiorId,
    toRole: preferred.superiorRole,
    rerouted: true,
  };
}

export const delegationHandlers: GatewayRequestHandlers = {
  "delegation.create": ({ params, respond, context }) => {
    try {
      const p = params as {
        fromAgentId: string;
        fromSessionKey: string;
        toAgentId?: string;
        task: string;
        priority?: string;
        justification?: string;
        mode?: "delegate" | "request";
      };

      if (!p.fromAgentId || !p.task) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "fromAgentId and task are required"),
        );
        return;
      }

      const cfg = loadConfig();
      const fromRole = resolveAgentRole(cfg, p.fromAgentId);
      const target = resolveDelegationCreateTarget({
        cfg,
        fromAgentId: p.fromAgentId,
        toAgentId: p.toAgentId,
        mode: p.mode,
      });
      const toRole = target.toRole;
      const toAgentId = target.toAgentId;

      const record = registerDelegation({
        fromAgentId: p.fromAgentId,
        fromSessionKey: p.fromSessionKey || `agent:${p.fromAgentId}:main`,
        fromRole,
        toAgentId,
        toRole,
        task: p.task,
        priority: (p.priority as "critical" | "high" | "normal" | "low") ?? "normal",
        justification: p.justification,
      });

      // Opt-in: automatically kick off the target agent so work starts immediately.
      // This preserves default OpenClaw behavior unless enabled in config.
      try {
        delegationAutoRunScheduler.schedule({
          cfg,
          targetAgentId: record.toAgentId,
          item: {
            delegationId: record.id,
            direction: record.direction,
            priority: record.priority,
            fromAgentId: record.fromAgentId,
            task: record.task,
            state: record.state,
          },
          deps: context.deps,
          runtime: defaultRuntime,
        });
      } catch {
        // Best-effort
      }

      // Slack-like visibility: announce in shared team chat.
      try {
        const teamChatKey = resolveMainSessionKey(cfg);
        const fromIdentity = resolveAgentIdentity(cfg, p.fromAgentId);
        const toIdentity = resolveAgentIdentity(cfg, toAgentId);
        const toName = toIdentity?.name ?? toAgentId;
        const fromName = fromIdentity?.name ?? p.fromAgentId;
        const routingInfo = target.rerouted
          ? `\n(routed to immediate superior: ${toAgentId}${p.toAgentId ? `; requested: ${p.toAgentId}` : ""})`
          : "";
        injectChatMessage({
          context,
          sessionKey: teamChatKey,
          label: "delegation",
          message: `@${toName} assigned by ${fromName} (${record.priority}, ${record.direction}): ${record.task}\n(id: ${record.id}, state: ${record.state})${routingInfo}`,
          senderIdentity: {
            agentId: p.fromAgentId,
            name: fromIdentity?.name ?? p.fromAgentId,
            emoji: fromIdentity?.emoji,
            avatar: fromIdentity?.avatar,
          },
        });

        // Ensure both participants receive actionable context in their own sessions.
        const stateHint =
          record.state === "pending_review"
            ? "Use delegation.review to approve/reject/redirect."
            : "Use delegation.accept, execute, then delegation.complete.";
        notifyAgentSession({
          context,
          cfg,
          agentId: record.toAgentId,
          senderAgentId: record.fromAgentId,
          message: `New delegation ${record.id} from ${fromName} (${record.priority}, ${record.direction}).\nTask: ${record.task}\n${stateHint}`,
        });
        notifyAgentSession({
          context,
          cfg,
          agentId: record.fromAgentId,
          senderAgentId: record.fromAgentId,
          message: `Delegation registered: ${record.id} -> @${toName} (state: ${record.state}).`,
        });
      } catch {
        // Non-critical
      }

      // For upward requests, provide decision tree evaluation context
      let evaluation = undefined;
      if (record.direction === "upward") {
        evaluation = evaluateDelegationRequest({
          request: record,
          superiorRole: toRole,
          superiorAgentId: toAgentId,
        });
      }

      broadcastHierarchyFullRefresh();
      respond(
        true,
        {
          delegation: record,
          evaluation,
          routing: {
            appliedToAgentId: toAgentId,
            requestedToAgentId: p.toAgentId ?? null,
            reroutedToImmediateSuperior: target.rerouted,
          },
        },
        undefined,
      );
    } catch (err) {
      const message = String(err);
      const code = message.includes("required")
        ? ErrorCodes.INVALID_REQUEST
        : ErrorCodes.UNAVAILABLE;
      respond(false, undefined, errorShape(code, message));
    }
  },

  "delegation.review": ({ params, respond, context }) => {
    try {
      const p = params as {
        delegationId: string;
        reviewerId: string;
        decision: string;
        reasoning: string;
        redirectToAgentId?: string;
        redirectReason?: string;
      };

      if (!p.delegationId || !p.reviewerId || !p.decision || !p.reasoning) {
        respond(
          false,
          undefined,
          errorShape(
            ErrorCodes.INVALID_REQUEST,
            "delegationId, reviewerId, decision, and reasoning are required",
          ),
        );
        return;
      }

      const review: DelegationReview = {
        reviewerId: p.reviewerId,
        decision: p.decision as "approve" | "reject" | "redirect",
        reasoning: p.reasoning,
        evaluations: {
          withinScope: true,
          requiresEscalation: false,
          canDelegateToOther: p.decision === "redirect",
          suggestedAlternative: p.redirectToAgentId,
        },
      };

      const pendingRecord = getDelegation(p.delegationId);
      if (!pendingRecord) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Delegation not found"));
        return;
      }
      assertDelegationReviewer({
        record: pendingRecord,
        reviewerId: p.reviewerId,
      });

      const record = reviewDelegation(p.delegationId, review);
      if (!record) {
        respond(
          false,
          undefined,
          errorShape(
            ErrorCodes.INVALID_REQUEST,
            "Delegation not found or not in pending_review state",
          ),
        );
        return;
      }

      // Slack-like visibility: announce review outcome.
      try {
        const cfg = loadConfig();
        const teamChatKey = resolveMainSessionKey(cfg);
        const reviewerIdentity = resolveAgentIdentity(cfg, p.reviewerId);
        const fromIdentity = resolveAgentIdentity(cfg, record.fromAgentId);
        const toIdentity = resolveAgentIdentity(cfg, record.toAgentId);
        const fromName = fromIdentity?.name ?? record.fromAgentId;
        const toName = toIdentity?.name ?? record.toAgentId;
        injectChatMessage({
          context,
          sessionKey: teamChatKey,
          label: "delegation",
          message: `Review by ${reviewerIdentity?.name ?? p.reviewerId}: ${p.decision} for request ${record.id}\nFrom: ${fromName} → To: @${toName}\nReason: ${p.reasoning}`,
          senderIdentity: {
            agentId: p.reviewerId,
            name: reviewerIdentity?.name ?? p.reviewerId,
            emoji: reviewerIdentity?.emoji,
            avatar: reviewerIdentity?.avatar,
          },
        });

        // Direct feedback loop for requester/assignee sessions.
        notifyAgentSession({
          context,
          cfg,
          agentId: record.fromAgentId,
          senderAgentId: p.reviewerId,
          message: `Your request ${record.id} was ${p.decision} by ${reviewerIdentity?.name ?? p.reviewerId}.\nReason: ${p.reasoning}`,
        });
        if (record.state === "assigned") {
          notifyAgentSession({
            context,
            cfg,
            agentId: record.toAgentId,
            senderAgentId: p.reviewerId,
            message: `Delegation ${record.id} is approved and assigned.\nNext: delegation.accept -> execute -> delegation.complete.`,
          });
        }
      } catch {
        // Non-critical
      }

      broadcastHierarchyFullRefresh();
      respond(true, { delegation: record }, undefined);
    } catch (err) {
      const message = String(err);
      const code = message.includes("not authorized")
        ? ErrorCodes.INVALID_REQUEST
        : ErrorCodes.UNAVAILABLE;
      respond(false, undefined, errorShape(code, message));
    }
  },

  "delegation.accept": ({ params, respond, context }) => {
    try {
      const p = params as { delegationId: string; agentId: string };

      if (!p.delegationId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "delegationId required"));
        return;
      }
      if (!p.agentId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "agentId required"));
        return;
      }

      const existing = getDelegation(p.delegationId);
      if (!existing) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Delegation not found"));
        return;
      }
      assertDelegationAssignee({ record: existing, agentId: p.agentId, action: "accept" });

      const record = updateDelegationState(p.delegationId, "in_progress");
      if (!record) {
        respond(
          false,
          undefined,
          errorShape(
            ErrorCodes.INVALID_REQUEST,
            "Delegation not found or invalid state transition",
          ),
        );
        return;
      }

      try {
        const cfg = loadConfig();
        const teamChatKey = resolveMainSessionKey(cfg);
        const agentIdentity = resolveAgentIdentity(cfg, p.agentId);
        const fromIdentity = resolveAgentIdentity(cfg, record.fromAgentId);
        const fromName = fromIdentity?.name ?? record.fromAgentId;
        injectChatMessage({
          context,
          sessionKey: teamChatKey,
          label: "delegation",
          message: `${agentIdentity?.name ?? p.agentId} accepted ${record.id} (from ${fromName}) and started work.`,
          senderIdentity: {
            agentId: p.agentId,
            name: agentIdentity?.name ?? p.agentId,
            emoji: agentIdentity?.emoji,
            avatar: agentIdentity?.avatar,
          },
        });
        notifyAgentSession({
          context,
          cfg,
          agentId: record.fromAgentId,
          senderAgentId: p.agentId,
          message: `${agentIdentity?.name ?? p.agentId} accepted ${record.id} and started work.`,
        });
      } catch {
        // Non-critical
      }

      broadcastHierarchyFullRefresh();
      respond(true, { delegation: record }, undefined);
    } catch (err) {
      const message = String(err);
      const code = message.includes("not authorized")
        ? ErrorCodes.INVALID_REQUEST
        : ErrorCodes.UNAVAILABLE;
      respond(false, undefined, errorShape(code, message));
    }
  },

  "delegation.complete": ({ params, respond, context }) => {
    try {
      const p = params as {
        delegationId: string;
        agentId: string;
        resultStatus: string;
        resultSummary: string;
        status?: string;
        summary?: string;
      };
      const resultStatus = p.resultStatus || p.status || "";
      const resultSummary = p.resultSummary || p.summary || "";

      if (!p.delegationId || !p.agentId || !resultStatus || !resultSummary) {
        respond(
          false,
          undefined,
          errorShape(
            ErrorCodes.INVALID_REQUEST,
            "delegationId, agentId, and completion result required (resultStatus/resultSummary or status/summary)",
          ),
        );
        return;
      }

      const existing = getDelegation(p.delegationId);
      if (!existing) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Delegation not found"));
        return;
      }
      assertDelegationAssignee({ record: existing, agentId: p.agentId, action: "complete" });

      const record = completeDelegation(p.delegationId, {
        status: resultStatus as "success" | "failure" | "partial",
        summary: resultSummary,
      });

      if (!record) {
        respond(
          false,
          undefined,
          errorShape(
            ErrorCodes.INVALID_REQUEST,
            "Delegation not found or invalid state for completion",
          ),
        );
        return;
      }

      try {
        const cfg = loadConfig();
        const teamChatKey = resolveMainSessionKey(cfg);
        const toIdentity = resolveAgentIdentity(cfg, record.toAgentId);
        injectChatMessage({
          context,
          sessionKey: teamChatKey,
          label: "delegation",
          message: `${toIdentity?.name ?? record.toAgentId} completed ${record.id}: ${resultStatus}\nSummary: ${resultSummary}`,
          senderIdentity: {
            agentId: record.toAgentId,
            name: toIdentity?.name ?? record.toAgentId,
            emoji: toIdentity?.emoji,
            avatar: toIdentity?.avatar,
          },
        });
        notifyAgentSession({
          context,
          cfg,
          agentId: record.fromAgentId,
          senderAgentId: record.toAgentId,
          message: `${toIdentity?.name ?? record.toAgentId} completed ${record.id}: ${resultStatus}.\nSummary: ${resultSummary}`,
        });
      } catch {
        // Non-critical
      }

      broadcastHierarchyFullRefresh();
      respond(true, { delegation: record }, undefined);
    } catch (err) {
      const message = String(err);
      const code = message.includes("not authorized")
        ? ErrorCodes.INVALID_REQUEST
        : ErrorCodes.UNAVAILABLE;
      respond(false, undefined, errorShape(code, message));
    }
  },

  "delegation.reject": ({ params, respond, context }) => {
    try {
      const p = params as { delegationId: string; agentId: string; reasoning?: string };

      if (!p.delegationId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "delegationId required"));
        return;
      }
      if (!p.agentId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "agentId required"));
        return;
      }

      const existing = getDelegation(p.delegationId);
      if (!existing) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Delegation not found"));
        return;
      }
      assertDelegationAssignee({ record: existing, agentId: p.agentId, action: "reject" });

      const record = updateDelegationState(p.delegationId, "rejected");
      if (!record) {
        respond(
          false,
          undefined,
          errorShape(
            ErrorCodes.INVALID_REQUEST,
            "Delegation not found or invalid state transition",
          ),
        );
        return;
      }

      try {
        const cfg = loadConfig();
        const teamChatKey = resolveMainSessionKey(cfg);
        const agentIdentity = resolveAgentIdentity(cfg, p.agentId);
        injectChatMessage({
          context,
          sessionKey: teamChatKey,
          label: "delegation",
          message: `${agentIdentity?.name ?? p.agentId} rejected ${record.id}.\nReason: ${p.reasoning ?? "(none)"}`,
          senderIdentity: {
            agentId: p.agentId,
            name: agentIdentity?.name ?? p.agentId,
            emoji: agentIdentity?.emoji,
            avatar: agentIdentity?.avatar,
          },
        });
        notifyAgentSession({
          context,
          cfg,
          agentId: record.fromAgentId,
          senderAgentId: p.agentId,
          message: `${agentIdentity?.name ?? p.agentId} rejected ${record.id}.\nReason: ${p.reasoning ?? "(none)"}`,
        });
      } catch {
        // Non-critical
      }

      broadcastHierarchyFullRefresh();
      respond(true, { delegation: record }, undefined);
    } catch (err) {
      const message = String(err);
      const code = message.includes("not authorized")
        ? ErrorCodes.INVALID_REQUEST
        : ErrorCodes.UNAVAILABLE;
      respond(false, undefined, errorShape(code, message));
    }
  },

  "delegation.get": ({ params, respond }) => {
    try {
      const p = params as { delegationId: string };

      if (!p.delegationId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "delegationId required"));
        return;
      }

      const record = getDelegation(p.delegationId);
      if (!record) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Delegation not found"));
        return;
      }

      respond(true, { delegation: record }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  "delegation.list": ({ params, respond }) => {
    try {
      const p = params as { agentId: string; direction?: string };

      if (!p.agentId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "agentId required"));
        return;
      }

      const records = listDelegationsForAgent(p.agentId, {
        direction: p.direction as DelegationDirection | undefined,
      });

      respond(true, { delegations: records }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  "delegation.pending": ({ params, respond }) => {
    try {
      const p = params as { agentId: string };

      if (!p.agentId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "agentId required"));
        return;
      }

      const records = listPendingReviewsForAgent(p.agentId);
      respond(true, { delegations: records }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  "delegation.metrics": ({ params, respond }) => {
    try {
      const p = params as { agentId: string };

      if (!p.agentId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "agentId required"));
        return;
      }

      const metrics = getAgentDelegationMetrics(p.agentId);
      respond(true, { metrics }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },
};
