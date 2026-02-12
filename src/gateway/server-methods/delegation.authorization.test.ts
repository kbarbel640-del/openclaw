import { beforeEach, describe, expect, it } from "vitest";
import {
  registerDelegation,
  resetDelegationRegistryForTests,
  updateDelegationState,
} from "../../agents/delegation-registry.js";
import { delegationHandlers } from "./delegation.js";

type HandlerResult = {
  ok: boolean;
  payload: unknown;
  error: { code: string; message: string } | undefined;
};

async function invokeDelegationHandler(
  method: keyof typeof delegationHandlers,
  params: unknown,
): Promise<HandlerResult> {
  let result: HandlerResult = { ok: false, payload: undefined, error: undefined };
  await delegationHandlers[method]?.({
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

describe("delegation authorization", () => {
  beforeEach(() => {
    resetDelegationRegistryForTests();
  });

  it("blocks review by non-target reviewer", async () => {
    const record = registerDelegation({
      fromAgentId: "worker",
      fromSessionKey: "agent:worker:main",
      fromRole: "worker",
      toAgentId: "lead",
      toRole: "lead",
      task: "Need decision",
    });

    expect(record.state).toBe("pending_review");

    const res = await invokeDelegationHandler("delegation.review", {
      delegationId: record.id,
      reviewerId: "random-specialist",
      decision: "approve",
      reasoning: "Looks fine",
    });

    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("INVALID_REQUEST");
    expect(res.error?.message).toMatch(/not authorized/i);
  });

  it("blocks completion by agent that is not the assignee", async () => {
    const record = registerDelegation({
      fromAgentId: "lead",
      fromSessionKey: "agent:lead:main",
      fromRole: "lead",
      toAgentId: "worker",
      toRole: "worker",
      task: "Implement feature",
    });

    expect(record.state).toBe("assigned");
    updateDelegationState(record.id, "in_progress");

    const res = await invokeDelegationHandler("delegation.complete", {
      delegationId: record.id,
      agentId: "other-worker",
      resultStatus: "success",
      resultSummary: "Done",
    });

    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("INVALID_REQUEST");
    expect(res.error?.message).toMatch(/not authorized/i);
  });

  it("accepts legacy completion aliases status/summary", async () => {
    const record = registerDelegation({
      fromAgentId: "lead",
      fromSessionKey: "agent:lead:main",
      fromRole: "lead",
      toAgentId: "worker",
      toRole: "worker",
      task: "Implement feature",
    });

    updateDelegationState(record.id, "in_progress");

    const res = await invokeDelegationHandler("delegation.complete", {
      delegationId: record.id,
      agentId: "worker",
      status: "success",
      summary: "Done",
    });

    expect(res.ok).toBe(true);
    const payload = res.payload as {
      delegation?: { state?: string; result?: { status?: string } };
    };
    expect(payload.delegation?.state).toBe("completed");
    expect(payload.delegation?.result?.status).toBe("success");
  });
});
