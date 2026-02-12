import type { AgentRole } from "../../config/types.agents.js";
import type { GatewayRequestContext, GatewayRequestHandlers } from "./types.js";
import { resolveAgentRole } from "../../agents/agent-scope.js";
import { getAllDelegations } from "../../agents/delegation-registry.js";
import { AGENT_ROLE_CHAIN, resolvePreferredSuperior } from "../../agents/hierarchy-superior.js";
import { resolveAgentIdentity } from "../../agents/identity.js";
import { listAllSubagentRuns } from "../../agents/subagent-registry.js";
import { recordTeamDecision } from "../../agents/team-workspace.js";
import { loadConfig } from "../../config/config.js";
import {
  resolveAgentMainSessionKey,
  resolveMainSessionKey,
} from "../../config/sessions/main-session.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import { broadcastHierarchyFullRefresh } from "../server-hierarchy-events.js";
import { injectChatMessage } from "./chat.js";

/**
 * COLLABORATION SYSTEM
 *
 * Enables true multi-agent teamwork:
 * - Shared sessions where multiple agents collaborate
 * - Agent-to-agent messaging
 * - Collective decision making
 * - Consensus tracking
 */

export type CollaborativeSession = {
  sessionKey: string;
  topic: string;
  createdAt: number;
  members: string[]; // agent IDs
  status: "planning" | "debating" | "decided" | "archived";
  /** Current debate round (incremented on each proposal/challenge). */
  roundCount: number;
  /** Minimum rounds before finalization is allowed. Default: 3. */
  minRounds: number;
  /** Maximum rounds before auto-escalation. Default: 7. */
  maxRounds: number;
  /** True when maxRounds was hit and escalation was triggered. */
  autoEscalated?: boolean;
  decisions: Array<{
    id: string;
    topic: string;
    proposals: Array<{
      from: string; // agent ID
      proposal: string;
      reasoning: string;
      timestamp: number;
    }>;
    consensus?: {
      agreed: string[]; // agents that agreed
      disagreed: string[]; // agents that disagreed
      finalDecision: string;
      decidedAt: number;
      decidedBy?: string; // moderator agent
    };
  }>;
  messages: Array<{
    from: string; // agent ID or "moderator"
    type: "proposal" | "challenge" | "clarification" | "agreement" | "decision";
    content: string;
    referencesDecision?: string; // decision ID
    timestamp: number;
  }>;
  moderator?: string; // CTO or designated lead
};

const collaborativeSessions = new Map<string, CollaborativeSession>();

/**
 * POLL SYSTEM
 *
 * Lightweight yes/no or multi-choice polls for quick decisions.
 */

export type PollRecord = {
  id: string;
  question: string;
  options: string[];
  voters: string[];
  votes: Record<string, string>;
  createdAt: number;
  timeoutAt?: number;
  initiatorId: string;
  completed: boolean;
};

const polls = new Map<string, PollRecord>();

/**
 * REVIEW REQUEST SYSTEM
 *
 * Async review requests where an agent submits work for review.
 */

export type ReviewRequest = {
  id: string;
  artifact: string;
  reviewers: string[];
  submitterId: string;
  context?: string;
  reviews: Array<{
    reviewerId: string;
    approved: boolean;
    feedback?: string;
    timestamp: number;
  }>;
  createdAt: number;
  completed: boolean;
};

const reviewRequests = new Map<string, ReviewRequest>();

function notifyCollaborationParticipants(params: {
  context: Pick<GatewayRequestContext, "broadcast" | "nodeSendToSession" | "agentRunSeq">;
  cfg: ReturnType<typeof loadConfig>;
  recipients: string[];
  message: string;
  senderAgentId?: string;
  label?: string;
}) {
  const uniqueRecipients = Array.from(
    new Set(params.recipients.map((v) => v.trim()).filter(Boolean)),
  );
  if (uniqueRecipients.length === 0) {
    return;
  }
  const senderId = params.senderAgentId?.trim();
  const senderIdentity = senderId ? resolveAgentIdentity(params.cfg, senderId) : undefined;
  for (const agentId of uniqueRecipients) {
    const sessionKey = resolveAgentMainSessionKey({ cfg: params.cfg, agentId });
    injectChatMessage({
      context: params.context,
      sessionKey,
      label: params.label ?? "collaboration",
      message: params.message,
      senderIdentity: senderId
        ? {
            agentId: senderId,
            name: senderIdentity?.name ?? senderId,
            emoji: senderIdentity?.emoji,
            avatar: senderIdentity?.avatar,
          }
        : undefined,
    });
  }
}

function assertSessionMember(params: {
  session: CollaborativeSession;
  agentId: string;
  action: "challenge" | "agree" | "escalate";
}): void {
  if (!params.session.members.includes(params.agentId)) {
    throw new Error(
      `Agent ${params.agentId} is not authorized to ${params.action} in session ${params.session.sessionKey}`,
    );
  }
}

function assertDecisionExists(params: {
  session: CollaborativeSession;
  decisionId: string;
}): NonNullable<CollaborativeSession["decisions"][number]> {
  const decision = params.session.decisions.find((d) => d.id === params.decisionId);
  if (!decision) {
    throw new Error(`Decision not found: ${params.decisionId}`);
  }
  return decision;
}

function assertSessionFinalizer(params: {
  session: CollaborativeSession;
  moderatorId: string;
}): void {
  const designatedModerator = params.session.moderator?.trim();
  if (designatedModerator) {
    if (params.moderatorId !== designatedModerator) {
      throw new Error(
        `Moderator ${params.moderatorId} is not authorized to finalize session ${params.session.sessionKey}`,
      );
    }
    return;
  }

  if (!params.session.members.includes(params.moderatorId)) {
    throw new Error(
      `Agent ${params.moderatorId} is not authorized to finalize session ${params.session.sessionKey}`,
    );
  }
}

function assertPollReader(params: { poll: PollRecord; requesterId: string }): void {
  if (params.poll.initiatorId === params.requesterId) {
    return;
  }
  if (params.poll.voters.includes(params.requesterId)) {
    return;
  }
  throw new Error(`Agent ${params.requesterId} is not authorized to read poll ${params.poll.id}`);
}

function assertReviewReader(params: { request: ReviewRequest; requesterId: string }): void {
  if (params.request.submitterId === params.requesterId) {
    return;
  }
  if (params.request.reviewers.includes(params.requesterId)) {
    return;
  }
  throw new Error(
    `Agent ${params.requesterId} is not authorized to read review ${params.request.id}`,
  );
}

/**
 * Initialize a collaborative session where multiple agents can debate
 *
 * Example: OAuth2 design with Backend, Frontend, Security
 */
export function initializeCollaborativeSession(params: {
  topic: string;
  agents: string[];
  moderator?: string;
  sessionKey?: string;
  minRounds?: number;
  maxRounds?: number;
}): CollaborativeSession {
  const sessionKey = params.sessionKey || `collab:${params.topic}:${Date.now()}`;

  const session: CollaborativeSession = {
    sessionKey,
    topic: params.topic,
    createdAt: Date.now(),
    members: params.agents,
    status: "planning",
    roundCount: 0,
    minRounds: params.minRounds ?? 3,
    maxRounds: params.maxRounds ?? 7,
    decisions: [],
    messages: [],
    moderator: params.moderator,
  };

  collaborativeSessions.set(sessionKey, session);
  return session;
}

/**
 * Agent publishes a proposal to the collaborative session
 */
export function publishProposal(params: {
  sessionKey: string;
  agentId: string;
  decisionTopic: string;
  proposal: string;
  reasoning: string;
}): { decisionId: string; sessionKey: string } {
  const session = collaborativeSessions.get(params.sessionKey);
  if (!session) {
    throw new Error(`Collaborative session not found: ${params.sessionKey}`);
  }

  if (!session.members.includes(params.agentId)) {
    throw new Error(`Agent ${params.agentId} not a member of this session`);
  }

  let decision = session.decisions.find((d) => d.topic === params.decisionTopic);
  if (!decision) {
    decision = {
      id: `decision:${params.decisionTopic}:${Date.now()}`,
      topic: params.decisionTopic,
      proposals: [],
    };
    session.decisions.push(decision);
  }

  decision.proposals.push({
    from: params.agentId,
    proposal: params.proposal,
    reasoning: params.reasoning,
    timestamp: Date.now(),
  });

  session.messages.push({
    from: params.agentId,
    type: "proposal",
    content: `Proposal: ${params.proposal}. Reasoning: ${params.reasoning}`,
    referencesDecision: decision.id,
    timestamp: Date.now(),
  });

  // Increment debate round counter
  session.roundCount = (session.roundCount ?? 0) + 1;
  if (session.status === "planning") {
    session.status = "debating";
  }

  return {
    decisionId: decision.id,
    sessionKey: params.sessionKey,
  };
}

/**
 * Agent challenges or questions a proposal
 */
export function challengeProposal(params: {
  sessionKey: string;
  decisionId: string;
  agentId: string;
  challenge: string;
  suggestedAlternative?: string;
}): void {
  const session = collaborativeSessions.get(params.sessionKey);
  if (!session) {
    throw new Error(`Collaborative session not found: ${params.sessionKey}`);
  }
  assertSessionMember({ session, agentId: params.agentId, action: "challenge" });
  assertDecisionExists({ session, decisionId: params.decisionId });

  session.messages.push({
    from: params.agentId,
    type: "challenge",
    content:
      params.challenge +
      (params.suggestedAlternative ? ` Alternative: ${params.suggestedAlternative}` : ""),
    referencesDecision: params.decisionId,
    timestamp: Date.now(),
  });

  // Increment debate round counter
  session.roundCount = (session.roundCount ?? 0) + 1;
  if (session.status === "planning") {
    session.status = "debating";
  }
}

/**
 * Agent agrees to a proposal
 */
export function agreeToProposal(params: {
  sessionKey: string;
  decisionId: string;
  agentId: string;
}): void {
  const session = collaborativeSessions.get(params.sessionKey);
  if (!session) {
    throw new Error(`Collaborative session not found: ${params.sessionKey}`);
  }
  assertSessionMember({ session, agentId: params.agentId, action: "agree" });

  const decision = assertDecisionExists({ session, decisionId: params.decisionId });

  if (!decision.consensus) {
    decision.consensus = {
      agreed: [params.agentId],
      disagreed: [],
      finalDecision: "",
      decidedAt: 0,
    };
  } else if (!decision.consensus.agreed.includes(params.agentId)) {
    decision.consensus.agreed.push(params.agentId);
    const disagreedIdx = decision.consensus.disagreed.indexOf(params.agentId);
    if (disagreedIdx >= 0) {
      decision.consensus.disagreed.splice(disagreedIdx, 1);
    }
  }

  session.messages.push({
    from: params.agentId,
    type: "agreement",
    content: `Agrees with decision`,
    referencesDecision: params.decisionId,
    timestamp: Date.now(),
  });
  if (session.status === "planning") {
    session.status = "debating";
  }
}

/**
 * Moderator finalizes a decision after consensus
 */
export function finalizeDecision(params: {
  sessionKey: string;
  decisionId: string;
  finalDecision: string;
  moderatorId: string;
}): void {
  const session = collaborativeSessions.get(params.sessionKey);
  if (!session) {
    throw new Error(`Collaborative session not found: ${params.sessionKey}`);
  }
  assertSessionFinalizer({ session, moderatorId: params.moderatorId });

  const decision = assertDecisionExists({ session, decisionId: params.decisionId });

  // Enforce minimum debate rounds before finalization (skip if auto-escalated)
  const minRounds = session.minRounds ?? 3;
  if ((session.roundCount ?? 0) < minRounds && !session.autoEscalated) {
    throw new Error(
      `Cannot finalize: minimum ${minRounds} debate rounds required, only ${session.roundCount ?? 0} completed.`,
    );
  }

  decision.consensus = {
    agreed: session.members,
    disagreed: [],
    finalDecision: params.finalDecision,
    decidedAt: Date.now(),
    decidedBy: params.moderatorId,
  };

  session.messages.push({
    from: params.moderatorId,
    type: "decision",
    content: `DECISION: ${params.finalDecision}`,
    referencesDecision: params.decisionId,
    timestamp: Date.now(),
  });
  session.status = "decided";
}

/**
 * Get full collaboration session context
 */
export function getCollaborationContext(sessionKey: string): CollaborativeSession | null {
  return collaborativeSessions.get(sessionKey) || null;
}

/**
 * Return all active collaboration sessions (for hierarchy visualization)
 */
export function getAllCollaborativeSessions(): CollaborativeSession[] {
  return [...collaborativeSessions.values()];
}

/**
 * Get all messages in a decision thread (for an agent to read)
 */
export function getDecisionThread(params: { sessionKey: string; decisionId: string }): Array<{
  from: string;
  type: string;
  content: string;
  timestamp: number;
}> {
  const session = collaborativeSessions.get(params.sessionKey);
  if (!session) {
    return [];
  }

  return session.messages.filter((msg) => msg.referencesDecision === params.decisionId);
}

/**
 * Agent-to-agent direct messaging (simpler than sessions)
 */
export function sendAgentMessage(params: {
  fromAgentId: string;
  toAgentId: string;
  topic: string;
  message: string;
  timestamp?: number;
}): string {
  const messageId = `msg:${params.fromAgentId}:${params.toAgentId}:${Date.now()}`;

  // In a full impl, this would be persisted somewhere that the target agent can read
  // For now, return the messageId as acknowledgement

  return messageId;
}

/**
 * Create a poll and notify voters
 */
export async function createPoll(params: {
  question: string;
  options: string[];
  voters: string[];
  timeoutSeconds?: number;
  initiatorId: string;
}): Promise<{ id: string; result?: string; votes: Record<string, string>; unanimous: boolean }> {
  const pollId = `poll:${Date.now()}`;
  const timeoutAt =
    typeof params.timeoutSeconds === "number" && params.timeoutSeconds > 0
      ? Date.now() + params.timeoutSeconds * 1000
      : undefined;

  const poll: PollRecord = {
    id: pollId,
    question: params.question,
    options: params.options,
    voters: params.voters,
    votes: {},
    createdAt: Date.now(),
    timeoutAt,
    initiatorId: params.initiatorId,
    completed: false,
  };

  polls.set(pollId, poll);

  // NOTE: Poll delivery + vote collection is handled by RPC methods (collab.poll.*).
  // This function only creates the record.

  return {
    id: pollId,
    votes: poll.votes,
    unanimous: false,
  };
}

export function recordPollVote(params: { pollId: string; agentId: string; choice: string }): {
  ok: boolean;
  error?: string;
} {
  const poll = polls.get(params.pollId);
  if (!poll) {
    return { ok: false, error: "poll not found" };
  }
  if (poll.completed) {
    return { ok: false, error: "poll already completed" };
  }
  if (!poll.voters.includes(params.agentId)) {
    return { ok: false, error: "agent not allowed to vote in this poll" };
  }
  if (!poll.options.includes(params.choice)) {
    return { ok: false, error: "invalid choice" };
  }
  poll.votes[params.agentId] = params.choice;
  // Auto-complete when all votes are in (or timeout is reached later by caller).
  if (Object.keys(poll.votes).length >= poll.voters.length) {
    poll.completed = true;
  }
  return { ok: true };
}

export function getPollStatus(pollId: string): {
  ok: boolean;
  poll?: PollRecord & { tally: Record<string, number> };
  error?: string;
} {
  const poll = polls.get(pollId);
  if (!poll) {
    return { ok: false, error: "poll not found" };
  }
  const tally: Record<string, number> = {};
  for (const opt of poll.options) {
    tally[opt] = 0;
  }
  for (const vote of Object.values(poll.votes)) {
    tally[vote] = (tally[vote] ?? 0) + 1;
  }
  return { ok: true, poll: { ...poll, tally } };
}

/**
 * Submit work for review
 */
export function submitReview(params: {
  artifact: string;
  reviewers: string[];
  context?: string;
  submitterId: string;
}): { id: string } {
  const reviewId = `review:${Date.now()}`;

  const request: ReviewRequest = {
    id: reviewId,
    artifact: params.artifact,
    reviewers: params.reviewers,
    submitterId: params.submitterId,
    context: params.context,
    reviews: [],
    createdAt: Date.now(),
    completed: false,
  };

  reviewRequests.set(reviewId, request);

  return { id: reviewId };
}

export function submitReviewFeedback(params: {
  reviewId: string;
  reviewerId: string;
  approved: boolean;
  feedback?: string;
}): { ok: boolean; error?: string } {
  const req = reviewRequests.get(params.reviewId);
  if (!req) {
    return { ok: false, error: "review request not found" };
  }
  if (!req.reviewers.includes(params.reviewerId)) {
    return { ok: false, error: "reviewer not in reviewer list" };
  }
  req.reviews.push({
    reviewerId: params.reviewerId,
    approved: params.approved,
    feedback: params.feedback,
    timestamp: Date.now(),
  });
  // Mark complete when all reviewers responded.
  const uniqueReviewers = new Set(req.reviews.map((r) => r.reviewerId));
  if (uniqueReviewers.size >= req.reviewers.length) {
    req.completed = true;
  }
  return { ok: true };
}

export function getReviewRequest(reviewId: string): ReviewRequest | null {
  return reviewRequests.get(reviewId) ?? null;
}

export function listReviewRequests(filter?: { completed?: boolean }): ReviewRequest[] {
  const results: ReviewRequest[] = [];
  for (const req of reviewRequests.values()) {
    if (typeof filter?.completed === "boolean" && req.completed !== filter.completed) {
      continue;
    }
    results.push(req);
  }
  return results.toSorted((a, b) => b.createdAt - a.createdAt);
}

/**
 * Generate aggregated standup status of all active agents
 */
export function generateStandup(): {
  agents: Array<{
    agentId: string;
    status: string;
    task?: string;
    progress?: string;
    duration?: number;
  }>;
} {
  const now = Date.now();
  const agentMap = new Map<
    string,
    {
      agentId: string;
      status: string;
      task?: string;
      progress?: string;
      duration?: number;
    }
  >();

  // Gather from subagent runs
  const subagentRuns = listAllSubagentRuns();
  for (const run of subagentRuns) {
    const agentId = run.childSessionKey.split(":")[1] || "unknown";
    const duration = run.endedAt
      ? run.endedAt - run.createdAt
      : run.startedAt
        ? now - run.startedAt
        : undefined;

    const status = run.outcome ? run.outcome.status : run.startedAt ? "in_progress" : "pending";

    agentMap.set(agentId, {
      agentId,
      status,
      task: run.task,
      progress: run.progress?.status,
      duration,
    });
  }

  // Gather from delegation registry
  const delegations = getAllDelegations();
  for (const deleg of delegations) {
    if (deleg.state === "completed" || deleg.state === "rejected") {
      continue;
    }

    const agentId = deleg.toAgentId;
    const existing = agentMap.get(agentId);
    if (existing) {
      continue; // Subagent data takes precedence
    }

    const duration = deleg.startedAt ? now - deleg.startedAt : undefined;

    agentMap.set(agentId, {
      agentId,
      status: deleg.state,
      task: deleg.task,
      duration,
    });
  }

  return {
    agents: Array.from(agentMap.values()),
  };
}

export function resolveDisputeEscalationSuperior(
  cfg: ReturnType<typeof loadConfig>,
  escalatingAgentId: string,
): { superiorId: string; superiorRole: AgentRole } | null {
  const escalatingRole = resolveAgentRole(cfg, escalatingAgentId);
  const currentIdx = AGENT_ROLE_CHAIN.indexOf(escalatingRole);
  if (currentIdx < 0 || currentIdx >= AGENT_ROLE_CHAIN.length - 1) {
    return null;
  }

  const target = resolvePreferredSuperior(cfg, escalatingAgentId);
  if (!target) {
    return null;
  }

  return {
    superiorId: target.superiorId,
    superiorRole: target.superiorRole,
  };
}

export function resetCollaborationStateForTests(): void {
  collaborativeSessions.clear();
  polls.clear();
  reviewRequests.clear();
}

/**
 * Export RPC handlers for the gateway
 */
export const collaborationHandlers: GatewayRequestHandlers = {
  "collab.session.init": ({ params, respond, context }) => {
    try {
      const p = params as {
        topic: string;
        agents: string[];
        moderator?: string;
      };

      if (!p.topic || !Array.isArray(p.agents) || p.agents.length < 2) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "topic and at least 2 agents required"),
        );
        return;
      }

      const session = initializeCollaborativeSession(p);
      broadcastHierarchyFullRefresh();
      // Slack-like visibility: announce new debate session.
      try {
        const cfg = loadConfig();
        const teamChatKey = resolveMainSessionKey(cfg);
        const moderatorId = p.moderator?.trim();
        const moderatorIdentity = moderatorId ? resolveAgentIdentity(cfg, moderatorId) : undefined;
        const senderIdentity = moderatorId
          ? {
              agentId: moderatorId,
              name: moderatorIdentity?.name ?? moderatorId,
              emoji: moderatorIdentity?.emoji,
              avatar: moderatorIdentity?.avatar,
            }
          : undefined;
        injectChatMessage({
          context,
          sessionKey: teamChatKey,
          label: "collaboration",
          message: `Debate started: ${session.topic}\nMembers: ${session.members.join(", ")}\nSession: ${session.sessionKey}`,
          senderIdentity,
        });
        notifyCollaborationParticipants({
          context,
          cfg,
          recipients: session.members,
          senderAgentId: moderatorId,
          message:
            `Collaboration session started: ${session.topic}\n` +
            `Session key: ${session.sessionKey}\n` +
            "Next action: publish your proposal with explicit trade-offs.",
        });
      } catch {
        // Non-critical
      }
      respond(true, session, undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code = message.includes("not authorized")
        ? ErrorCodes.INVALID_REQUEST
        : ErrorCodes.UNAVAILABLE;
      respond(false, undefined, errorShape(code, message));
    }
  },

  "collab.proposal.publish": ({ params, respond, context }) => {
    try {
      const p = params as {
        sessionKey: string;
        agentId: string;
        decisionTopic: string;
        proposal: string;
        reasoning: string;
      };

      const result = publishProposal(p);
      broadcastHierarchyFullRefresh();
      try {
        const cfg = loadConfig();
        const teamChatKey = resolveMainSessionKey(cfg);
        const identity = resolveAgentIdentity(cfg, p.agentId);
        injectChatMessage({
          context,
          sessionKey: teamChatKey,
          label: "collaboration",
          message: `Proposal by ${identity?.name ?? p.agentId} in ${p.sessionKey}\nTopic: ${p.decisionTopic}\n${p.proposal}`,
          senderIdentity: {
            agentId: p.agentId,
            name: identity?.name ?? p.agentId,
            emoji: identity?.emoji,
            avatar: identity?.avatar,
          },
        });
        const session = collaborativeSessions.get(p.sessionKey);
        if (session) {
          notifyCollaborationParticipants({
            context,
            cfg,
            recipients: session.members.filter((agentId) => agentId !== p.agentId),
            senderAgentId: p.agentId,
            message:
              `${identity?.name ?? p.agentId} published a proposal in ${p.sessionKey}.\n` +
              `Decision topic: ${p.decisionTopic}\n` +
              "Next action: challenge or agree with reasoning.",
          });
        }
      } catch {
        // Non-critical
      }
      // Auto-escalate when max rounds are reached
      try {
        const session = collaborativeSessions.get(p.sessionKey);
        if (session) {
          const maxRounds = session.maxRounds ?? 7;
          if ((session.roundCount ?? 0) >= maxRounds && !session.autoEscalated) {
            session.autoEscalated = true;
            const cfg2 = loadConfig();
            const teamChatKey2 = resolveMainSessionKey(cfg2);
            injectChatMessage({
              context,
              sessionKey: teamChatKey2,
              label: "collaboration",
              message: `AUTO-ESCALATION: Debate "${session.topic}" reached ${maxRounds} rounds without consensus. Moderator ${session.moderator ?? "orchestrator"} must finalize now.`,
            });
          }
        }
      } catch {
        // Non-critical
      }
      respond(true, result, undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code = message.includes("not authorized")
        ? ErrorCodes.INVALID_REQUEST
        : ErrorCodes.UNAVAILABLE;
      respond(false, undefined, errorShape(code, message));
    }
  },

  "collab.proposal.challenge": ({ params, respond, context }) => {
    try {
      const p = params as {
        sessionKey: string;
        decisionId: string;
        agentId: string;
        challenge: string;
        suggestedAlternative?: string;
      };

      challengeProposal(p);
      broadcastHierarchyFullRefresh();
      try {
        const cfg = loadConfig();
        const teamChatKey = resolveMainSessionKey(cfg);
        const identity = resolveAgentIdentity(cfg, p.agentId);
        injectChatMessage({
          context,
          sessionKey: teamChatKey,
          label: "collaboration",
          message: `Challenge by ${identity?.name ?? p.agentId} in ${p.sessionKey}\nDecision: ${p.decisionId}\n${p.challenge}${p.suggestedAlternative ? `\nAlt: ${p.suggestedAlternative}` : ""}`,
          senderIdentity: {
            agentId: p.agentId,
            name: identity?.name ?? p.agentId,
            emoji: identity?.emoji,
            avatar: identity?.avatar,
          },
        });
        const session = collaborativeSessions.get(p.sessionKey);
        if (session) {
          notifyCollaborationParticipants({
            context,
            cfg,
            recipients: session.members.filter((agentId) => agentId !== p.agentId),
            senderAgentId: p.agentId,
            message:
              `${identity?.name ?? p.agentId} challenged decision ${p.decisionId} in ${p.sessionKey}.\n` +
              "Next action: respond with revised proposal or explicit agreement.",
          });
        }
      } catch {
        // Non-critical
      }
      // Auto-escalate when max rounds are reached
      try {
        const session = collaborativeSessions.get(p.sessionKey);
        if (session) {
          const maxRounds = session.maxRounds ?? 7;
          if ((session.roundCount ?? 0) >= maxRounds && !session.autoEscalated) {
            session.autoEscalated = true;
            const cfg2 = loadConfig();
            const teamChatKey2 = resolveMainSessionKey(cfg2);
            injectChatMessage({
              context,
              sessionKey: teamChatKey2,
              label: "collaboration",
              message: `AUTO-ESCALATION: Debate "${session.topic}" reached ${maxRounds} rounds without consensus. Moderator ${session.moderator ?? "orchestrator"} must finalize now.`,
            });
          }
        }
      } catch {
        // Non-critical
      }
      respond(true, { ok: true }, undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code = message.includes("not authorized")
        ? ErrorCodes.INVALID_REQUEST
        : ErrorCodes.UNAVAILABLE;
      respond(false, undefined, errorShape(code, message));
    }
  },

  "collab.proposal.agree": ({ params, respond, context }) => {
    try {
      const p = params as {
        sessionKey: string;
        decisionId: string;
        agentId: string;
      };

      agreeToProposal(p);
      broadcastHierarchyFullRefresh();
      try {
        const cfg = loadConfig();
        const teamChatKey = resolveMainSessionKey(cfg);
        const identity = resolveAgentIdentity(cfg, p.agentId);
        injectChatMessage({
          context,
          sessionKey: teamChatKey,
          label: "collaboration",
          message: `${identity?.name ?? p.agentId} agrees (session ${p.sessionKey}, decision ${p.decisionId}).`,
          senderIdentity: {
            agentId: p.agentId,
            name: identity?.name ?? p.agentId,
            emoji: identity?.emoji,
            avatar: identity?.avatar,
          },
        });
        const session = collaborativeSessions.get(p.sessionKey);
        if (session) {
          notifyCollaborationParticipants({
            context,
            cfg,
            recipients: session.members.filter((agentId) => agentId !== p.agentId),
            senderAgentId: p.agentId,
            message:
              `${identity?.name ?? p.agentId} agreed with ${p.decisionId}.\n` +
              "Next action: if consensus is enough, moderator should finalize.",
          });
        }
      } catch {
        // Non-critical
      }
      respond(true, { ok: true }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  "collab.decision.finalize": async ({ params, respond, context }) => {
    try {
      const p = params as {
        sessionKey: string;
        decisionId: string;
        finalDecision: string;
        moderatorId: string;
      };

      try {
        finalizeDecision(p);
      } catch (finalizeErr) {
        const msg = finalizeErr instanceof Error ? finalizeErr.message : String(finalizeErr);
        if (msg.includes("minimum") && msg.includes("debate rounds required")) {
          respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, msg));
          return;
        }
        throw finalizeErr;
      }
      broadcastHierarchyFullRefresh();
      try {
        const cfg = loadConfig();
        const teamChatKey = resolveMainSessionKey(cfg);
        const identity = resolveAgentIdentity(cfg, p.moderatorId);
        injectChatMessage({
          context,
          sessionKey: teamChatKey,
          label: "collaboration",
          message: `Decision finalized by ${identity?.name ?? p.moderatorId} (session ${p.sessionKey})\nDecision: ${p.decisionId}\n${p.finalDecision}`,
          senderIdentity: {
            agentId: p.moderatorId,
            name: identity?.name ?? p.moderatorId,
            emoji: identity?.emoji,
            avatar: identity?.avatar,
          },
        });
        const session = collaborativeSessions.get(p.sessionKey);
        if (session) {
          notifyCollaborationParticipants({
            context,
            cfg,
            recipients: session.members,
            senderAgentId: p.moderatorId,
            message:
              `Final decision recorded for ${p.decisionId} in ${p.sessionKey}.\n` +
              "Next action: execute your assigned tasks and publish progress checkpoints.",
          });
        }
      } catch {
        // Non-critical
      }

      // Persist finalized decisions into the team workspace for long-term memory.
      try {
        const cfg = loadConfig();
        const teamChatKey = resolveMainSessionKey(cfg);
        const session = getCollaborationContext(p.sessionKey);
        const decision = session?.decisions.find((d) => d.id === p.decisionId);
        const topic = decision?.topic ?? p.decisionId;
        await recordTeamDecision({
          requesterSessionKey: teamChatKey,
          topic,
          decision: p.finalDecision,
          participants: session?.members ?? [],
          metadata: {
            sessionKey: p.sessionKey,
            proposals: decision?.proposals?.map((pp) => ({
              from: pp.from,
              proposal: pp.proposal,
              reasoning: pp.reasoning,
            })),
          },
        });
      } catch {
        // Non-critical
      }
      respond(true, { ok: true }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  "collab.session.get": ({ params, respond }) => {
    try {
      const p = params as { sessionKey: string; requesterId: string };
      if (!p.sessionKey || !p.requesterId) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "sessionKey and requesterId required"),
        );
        return;
      }
      const session = getCollaborationContext(p.sessionKey);

      if (!session) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Session not found"));
        return;
      }
      assertSessionMember({ session, agentId: p.requesterId, action: "agree" });

      respond(true, session, undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code = message.includes("not authorized")
        ? ErrorCodes.INVALID_REQUEST
        : ErrorCodes.UNAVAILABLE;
      respond(false, undefined, errorShape(code, message));
    }
  },

  "collab.thread.get": ({ params, respond }) => {
    try {
      const p = params as {
        sessionKey: string;
        decisionId: string;
        requesterId: string;
      };
      if (!p.sessionKey || !p.decisionId || !p.requesterId) {
        respond(
          false,
          undefined,
          errorShape(
            ErrorCodes.INVALID_REQUEST,
            "sessionKey, decisionId, and requesterId required",
          ),
        );
        return;
      }
      const session = collaborativeSessions.get(p.sessionKey);
      if (!session) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Session not found"));
        return;
      }
      assertSessionMember({ session, agentId: p.requesterId, action: "agree" });
      assertDecisionExists({ session, decisionId: p.decisionId });

      const thread = getDecisionThread(p);
      respond(true, { thread }, undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code = message.includes("not authorized")
        ? ErrorCodes.INVALID_REQUEST
        : ErrorCodes.UNAVAILABLE;
      respond(false, undefined, errorShape(code, message));
    }
  },

  "collab.standup": ({ respond }) => {
    try {
      respond(true, generateStandup(), undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  "collab.poll": async ({ params, respond, context }) => {
    try {
      const p = params as {
        question: string;
        options: string[];
        voters: string[];
        timeoutSeconds?: number;
        initiatorId: string;
      };
      if (
        !p.question ||
        !Array.isArray(p.options) ||
        p.options.length < 2 ||
        !Array.isArray(p.voters) ||
        p.voters.length < 1
      ) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "question, >=2 options, and >=1 voter required"),
        );
        return;
      }
      const created = await createPoll(p);
      broadcastHierarchyFullRefresh();
      try {
        const cfg = loadConfig();
        const teamChatKey = resolveMainSessionKey(cfg);
        const identity = resolveAgentIdentity(cfg, p.initiatorId);
        const optsText = p.options.map((opt) => `- ${opt}`).join("\n");
        injectChatMessage({
          context,
          sessionKey: teamChatKey,
          label: "poll",
          message: `Poll created by ${identity?.name ?? p.initiatorId}: ${p.question}\nOptions:\n${optsText}\nVoters: ${p.voters.join(", ")}\nPoll: ${created.id}`,
          senderIdentity: {
            agentId: p.initiatorId,
            name: identity?.name ?? p.initiatorId,
            emoji: identity?.emoji,
            avatar: identity?.avatar,
          },
        });
      } catch {
        // Non-critical
      }
      respond(true, created, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  "collab.poll.vote": ({ params, respond, context }) => {
    try {
      const p = params as { pollId: string; agentId: string; choice: string };
      if (!p.pollId || !p.agentId || !p.choice) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "pollId, agentId, choice required"),
        );
        return;
      }
      const res = recordPollVote(p);
      if (!res.ok) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, res.error ?? "vote rejected"),
        );
        return;
      }
      broadcastHierarchyFullRefresh();
      try {
        const cfg = loadConfig();
        const teamChatKey = resolveMainSessionKey(cfg);
        const identity = resolveAgentIdentity(cfg, p.agentId);
        injectChatMessage({
          context,
          sessionKey: teamChatKey,
          label: "poll",
          message: `${identity?.name ?? p.agentId} voted in ${p.pollId}: ${p.choice}`,
          senderIdentity: {
            agentId: p.agentId,
            name: identity?.name ?? p.agentId,
            emoji: identity?.emoji,
            avatar: identity?.avatar,
          },
        });
      } catch {
        // Non-critical
      }
      respond(true, { ok: true }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  "collab.poll.get": ({ params, respond }) => {
    try {
      const p = params as { pollId: string; requesterId: string };
      if (!p.pollId || !p.requesterId) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "pollId and requesterId required"),
        );
        return;
      }
      const status = getPollStatus(p.pollId);
      if (!status.ok) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, status.error ?? "poll not found"),
        );
        return;
      }
      if (status.poll) {
        assertPollReader({ poll: status.poll, requesterId: p.requesterId });
      }
      respond(true, status.poll, undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code = message.includes("not authorized")
        ? ErrorCodes.INVALID_REQUEST
        : ErrorCodes.UNAVAILABLE;
      respond(false, undefined, errorShape(code, message));
    }
  },

  "collab.submit_review": ({ params, respond, context }) => {
    try {
      const p = params as {
        artifact: string;
        reviewers: string[];
        context?: string;
        submitterId: string;
      };
      if (!p.artifact || !Array.isArray(p.reviewers) || p.reviewers.length < 1 || !p.submitterId) {
        respond(
          false,
          undefined,
          errorShape(
            ErrorCodes.INVALID_REQUEST,
            "artifact, submitterId, and >=1 reviewer required",
          ),
        );
        return;
      }
      const created = submitReview(p);
      broadcastHierarchyFullRefresh();
      try {
        const cfg = loadConfig();
        const teamChatKey = resolveMainSessionKey(cfg);
        const identity = resolveAgentIdentity(cfg, p.submitterId);
        injectChatMessage({
          context,
          sessionKey: teamChatKey,
          label: "review",
          message: `Review requested by ${identity?.name ?? p.submitterId} (id: ${created.id})\nReviewers: ${p.reviewers.join(", ")}\nArtifact:\n${p.artifact}${p.context ? `\nContext: ${p.context}` : ""}`,
          senderIdentity: {
            agentId: p.submitterId,
            name: identity?.name ?? p.submitterId,
            emoji: identity?.emoji,
            avatar: identity?.avatar,
          },
        });
      } catch {
        // Non-critical
      }
      respond(true, created, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  "collab.review.submit": ({ params, respond, context }) => {
    try {
      const p = params as {
        reviewId: string;
        reviewerId: string;
        approved: boolean;
        feedback?: string;
      };
      if (!p.reviewId || !p.reviewerId || typeof p.approved !== "boolean") {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "reviewId, reviewerId, approved required"),
        );
        return;
      }
      const res = submitReviewFeedback(p);
      if (!res.ok) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, res.error ?? "submit failed"),
        );
        return;
      }
      broadcastHierarchyFullRefresh();
      try {
        const cfg = loadConfig();
        const teamChatKey = resolveMainSessionKey(cfg);
        const identity = resolveAgentIdentity(cfg, p.reviewerId);
        injectChatMessage({
          context,
          sessionKey: teamChatKey,
          label: "review",
          message: `Review ${p.reviewId} by ${identity?.name ?? p.reviewerId}: ${p.approved ? "approved" : "changes requested"}${p.feedback ? `\nFeedback: ${p.feedback}` : ""}`,
          senderIdentity: {
            agentId: p.reviewerId,
            name: identity?.name ?? p.reviewerId,
            emoji: identity?.emoji,
            avatar: identity?.avatar,
          },
        });
      } catch {
        // Non-critical
      }
      respond(true, { ok: true }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  "collab.review.get": ({ params, respond }) => {
    try {
      const p = params as { reviewId: string; requesterId: string };
      if (!p.reviewId || !p.requesterId) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "reviewId and requesterId required"),
        );
        return;
      }
      const req = getReviewRequest(p.reviewId);
      if (!req) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "review not found"));
        return;
      }
      assertReviewReader({ request: req, requesterId: p.requesterId });
      respond(true, req, undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code = message.includes("not authorized")
        ? ErrorCodes.INVALID_REQUEST
        : ErrorCodes.UNAVAILABLE;
      respond(false, undefined, errorShape(code, message));
    }
  },

  "collab.review.list": ({ params, respond }) => {
    try {
      const p = params as { completed?: boolean; requesterId: string };
      if (!p.requesterId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "requesterId required"));
        return;
      }
      const list = listReviewRequests({
        completed: typeof p.completed === "boolean" ? p.completed : undefined,
      });
      const visible = list.filter(
        (req) => req.submitterId === p.requesterId || req.reviewers.includes(p.requesterId),
      );
      respond(true, { reviews: visible }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  "collab.dispute.escalate": ({ params, respond, context }) => {
    try {
      const p = params as {
        sessionKey: string;
        decisionId: string;
        escalatingAgentId: string;
        reason: string;
      };

      if (!p.sessionKey || !p.decisionId || !p.escalatingAgentId || !p.reason) {
        respond(
          false,
          undefined,
          errorShape(
            ErrorCodes.INVALID_REQUEST,
            "sessionKey, decisionId, escalatingAgentId, and reason required",
          ),
        );
        return;
      }

      const session = collaborativeSessions.get(p.sessionKey);
      if (!session) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Session not found"));
        return;
      }
      assertSessionMember({ session, agentId: p.escalatingAgentId, action: "escalate" });

      const cfg = loadConfig();
      const escalatingRole = resolveAgentRole(cfg, p.escalatingAgentId);
      const currentIdx = AGENT_ROLE_CHAIN.indexOf(escalatingRole);

      if (currentIdx >= AGENT_ROLE_CHAIN.length - 1) {
        respond(
          false,
          undefined,
          errorShape(
            ErrorCodes.INVALID_REQUEST,
            "Already at highest rank. Orchestrator makes the binding decision.",
          ),
        );
        return;
      }

      const escalationTarget = resolveDisputeEscalationSuperior(cfg, p.escalatingAgentId);
      if (!escalationTarget) {
        const targetRole = AGENT_ROLE_CHAIN[currentIdx + 1];
        respond(
          false,
          undefined,
          errorShape(
            ErrorCodes.UNAVAILABLE,
            `No agent with role "${targetRole}" found for escalation.`,
          ),
        );
        return;
      }
      const { superiorId, superiorRole: targetRole } = escalationTarget;

      // Add superior to session as moderator
      if (!session.members.includes(superiorId)) {
        session.members.push(superiorId);
      }
      session.moderator = superiorId;

      // Record escalation in messages
      session.messages.push({
        from: p.escalatingAgentId,
        type: "clarification",
        content: `DISPUTE ESCALATED to ${superiorId} (${targetRole}). Reason: ${p.reason}. Their decision is BINDING.`,
        timestamp: Date.now(),
      });

      // Announce in team chat
      try {
        const teamChatKey = resolveMainSessionKey(cfg);
        const identity = resolveAgentIdentity(cfg, p.escalatingAgentId);
        injectChatMessage({
          context,
          sessionKey: teamChatKey,
          label: "dispute",
          message: `Dispute escalated by ${identity?.name ?? p.escalatingAgentId} in "${session.topic}" → ${superiorId} (${targetRole}) now moderates with binding authority.`,
          senderIdentity: {
            agentId: p.escalatingAgentId,
            name: identity?.name ?? p.escalatingAgentId,
            emoji: identity?.emoji,
            avatar: identity?.avatar,
          },
        });
      } catch {
        // Non-critical
      }
      broadcastHierarchyFullRefresh();
      respond(true, { superiorId, superiorRole: targetRole }, undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code = message.includes("not authorized")
        ? ErrorCodes.INVALID_REQUEST
        : ErrorCodes.UNAVAILABLE;
      respond(false, undefined, errorShape(code, message));
    }
  },

  "collab.session.create_focused": ({ params, respond }) => {
    try {
      const p = params as {
        topic: string;
        agents: string[];
        createdBy?: string;
      };

      if (!p.topic || !Array.isArray(p.agents) || p.agents.length < 2) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "topic and at least 2 agents required"),
        );
        return;
      }

      const sanitizedTopic = p.topic.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
      const session = initializeCollaborativeSession({
        topic: p.topic,
        agents: p.agents,
        sessionKey: `focused:${sanitizedTopic}:${Date.now()}`,
      });

      // Focused sessions do NOT broadcast to team chat (private)
      broadcastHierarchyFullRefresh();
      respond(true, session, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  "collab.session.invite": ({ params, respond, context }) => {
    try {
      const p = params as {
        sessionKey: string;
        agentId: string;
        invitedBy: string;
      };

      if (!p.sessionKey || !p.agentId || !p.invitedBy) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "sessionKey, agentId, invitedBy required"),
        );
        return;
      }

      const session = collaborativeSessions.get(p.sessionKey);
      if (!session) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Session not found"));
        return;
      }

      if (!session.members.includes(p.invitedBy)) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "Inviter is not a member of this session"),
        );
        return;
      }

      if (session.members.includes(p.agentId)) {
        respond(true, { alreadyMember: true }, undefined);
        return;
      }

      session.members.push(p.agentId);
      session.messages.push({
        from: p.invitedBy,
        type: "clarification",
        content: `Invited ${p.agentId} to join the session`,
        timestamp: Date.now(),
      });

      // Announce in team chat (unless focused/private session)
      if (!p.sessionKey.startsWith("focused:")) {
        try {
          const cfg = loadConfig();
          const teamChatKey = resolveMainSessionKey(cfg);
          const inviterIdentity = resolveAgentIdentity(cfg, p.invitedBy);
          const inviteeIdentity = resolveAgentIdentity(cfg, p.agentId);
          injectChatMessage({
            context,
            sessionKey: teamChatKey,
            label: "collaboration",
            message: `${inviterIdentity?.name ?? p.invitedBy} invited ${inviteeIdentity?.name ?? p.agentId} to session "${session.topic}"`,
            senderIdentity: {
              agentId: p.invitedBy,
              name: inviterIdentity?.name ?? p.invitedBy,
              emoji: inviterIdentity?.emoji,
              avatar: inviterIdentity?.avatar,
            },
          });
        } catch {
          // Non-critical
        }
      }
      broadcastHierarchyFullRefresh();
      respond(true, { ok: true }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },
};
