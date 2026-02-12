import { beforeEach, describe, expect, it } from "vitest";
import {
  createPoll,
  collaborationHandlers,
  resetCollaborationStateForTests,
  submitReview,
  initializeCollaborativeSession,
  publishProposal,
} from "./collaboration.js";

type HandlerResult = {
  ok: boolean;
  payload: unknown;
  error: { code: string; message: string } | undefined;
};

async function invokeCollabHandler(
  method: keyof typeof collaborationHandlers,
  params: unknown,
): Promise<HandlerResult> {
  let result: HandlerResult = { ok: false, payload: undefined, error: undefined };
  await collaborationHandlers[method]?.({
    req: { id: "test", method, params },
    params: (params ?? {}) as Record<string, unknown>,
    client: null,
    isWebchatConnect: () => false,
    context: {} as never,
    respond: (ok, payload, error) => {
      result = {
        ok,
        payload,
        error: error as HandlerResult["error"],
      };
    },
  });
  return result;
}

describe("collaboration authorization", () => {
  beforeEach(() => {
    resetCollaborationStateForTests();
  });

  it("blocks dispute escalation by non-member", async () => {
    const session = initializeCollaborativeSession({
      topic: "Service architecture",
      agents: ["backend", "frontend"],
      moderator: "cto",
    });
    const decision = publishProposal({
      sessionKey: session.sessionKey,
      agentId: "backend",
      decisionTopic: "Caching",
      proposal: "Use Redis",
      reasoning: "Low latency",
    });

    const res = await invokeCollabHandler("collab.dispute.escalate", {
      sessionKey: session.sessionKey,
      decisionId: decision.decisionId,
      escalatingAgentId: "outsider",
      reason: "I want to override",
    });

    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("INVALID_REQUEST");
    expect(res.error?.message).toMatch(/not authorized/i);
  });

  it("blocks session.get for non-member", async () => {
    const session = initializeCollaborativeSession({
      topic: "Security design",
      agents: ["backend", "frontend"],
    });

    const res = await invokeCollabHandler("collab.session.get", {
      sessionKey: session.sessionKey,
      requesterId: "outsider",
    });

    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("INVALID_REQUEST");
    expect(res.error?.message).toMatch(/not authorized/i);
  });

  it("blocks thread.get for non-member", async () => {
    const session = initializeCollaborativeSession({
      topic: "Security design",
      agents: ["backend", "frontend"],
    });
    const proposal = publishProposal({
      sessionKey: session.sessionKey,
      agentId: "backend",
      decisionTopic: "Auth",
      proposal: "Use OIDC",
      reasoning: "Standardized",
    });

    const res = await invokeCollabHandler("collab.thread.get", {
      sessionKey: session.sessionKey,
      decisionId: proposal.decisionId,
      requesterId: "outsider",
    });

    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("INVALID_REQUEST");
    expect(res.error?.message).toMatch(/not authorized/i);
  });

  it("blocks poll.get for agent outside voter set", async () => {
    const poll = await createPoll({
      question: "Pick cache",
      options: ["Redis", "Memcached"],
      voters: ["backend", "frontend"],
      initiatorId: "backend",
    });

    const res = await invokeCollabHandler("collab.poll.get", {
      pollId: poll.id,
      requesterId: "outsider",
    });

    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("INVALID_REQUEST");
    expect(res.error?.message).toMatch(/not authorized/i);
  });

  it("blocks review.get for non-participant", async () => {
    const review = submitReview({
      artifact: "PR #123",
      reviewers: ["security"],
      submitterId: "backend",
    });

    const res = await invokeCollabHandler("collab.review.get", {
      reviewId: review.id,
      requesterId: "outsider",
    });

    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("INVALID_REQUEST");
    expect(res.error?.message).toMatch(/not authorized/i);
  });

  it("filters review.list to only requester participation", async () => {
    submitReview({
      artifact: "PR #1",
      reviewers: ["security"],
      submitterId: "backend",
    });
    await new Promise((resolve) => setTimeout(resolve, 2));
    submitReview({
      artifact: "PR #2",
      reviewers: ["qa"],
      submitterId: "frontend",
    });

    const res = await invokeCollabHandler("collab.review.list", {
      requesterId: "security",
    });

    expect(res.ok).toBe(true);
    const payload = res.payload as { reviews: Array<{ reviewers: string[]; submitterId: string }> };
    expect(payload.reviews.length).toBe(1);
    expect(payload.reviews[0]?.reviewers).toContain("security");
    expect(payload.reviews[0]?.submitterId).toBe("backend");
  });
});
