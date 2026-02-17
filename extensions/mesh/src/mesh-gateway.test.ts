import type { GatewayRequestHandler, OpenClawPluginApi } from "openclaw/plugin-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

const agentCommandMock = vi.hoisted(() => vi.fn());
const normalizeAgentIdMock = vi.hoisted(() => vi.fn((value: string) => value));
const agentMethodMock = vi.hoisted(() => vi.fn());
const agentWaitMethodMock = vi.hoisted(() => vi.fn());

vi.mock("../../../src/commands/agent.js", () => ({
  agentCommand: agentCommandMock,
}));

vi.mock("../../../src/routing/session-key.js", () => ({
  normalizeAgentId: normalizeAgentIdMock,
}));

vi.mock("../../../src/runtime.js", () => ({
  defaultRuntime: {},
}));

vi.mock("../../../src/gateway/server-methods/agent.js", () => ({
  agentHandlers: {
    agent: agentMethodMock,
    "agent.wait": agentWaitMethodMock,
  },
}));

import { registerMeshGatewayMethods } from "./mesh-gateway.js";

type GatewayCallResult = {
  ok: boolean;
  payload?: unknown;
  error?: unknown;
  meta?: Record<string, unknown>;
};

type TestRespond = (
  ok: boolean,
  payload?: unknown,
  error?: unknown,
  meta?: Record<string, unknown>,
) => void;

function setupHandlers() {
  const handlers: Record<string, GatewayRequestHandler> = {};
  const api = {
    registerGatewayMethod: (method: string, handler: GatewayRequestHandler) => {
      handlers[method] = handler;
    },
  } as unknown as OpenClawPluginApi;
  registerMeshGatewayMethods(api);
  return handlers;
}

async function callHandler(
  handler: GatewayRequestHandler,
  method: string,
  params: Record<string, unknown>,
): Promise<GatewayCallResult> {
  return await new Promise<GatewayCallResult>((resolve) => {
    void handler({
      req: { type: "req", id: `test-${method}`, method, params },
      params,
      respond: (ok: boolean, payload?: unknown, error?: unknown, meta?: Record<string, unknown>) =>
        resolve({ ok, payload, error, meta }),
      client: null,
      isWebchatConnect: false,
      context: { deps: {} },
    } as never);
  });
}

describe("mesh plugin gateway", () => {
  beforeEach(() => {
    agentCommandMock.mockReset();
    normalizeAgentIdMock.mockReset();
    normalizeAgentIdMock.mockImplementation((value: string) => value);
    agentMethodMock.mockReset();
    agentWaitMethodMock.mockReset();
  });

  it("registers all mesh gateway methods", () => {
    const handlers = setupHandlers();
    expect(Object.keys(handlers).sort()).toEqual([
      "mesh.plan",
      "mesh.plan.auto",
      "mesh.retry",
      "mesh.run",
      "mesh.status",
    ]);
  });

  it("returns validation error for invalid mesh.plan", async () => {
    const handlers = setupHandlers();
    const res = await callHandler(handlers["mesh.plan"], "mesh.plan", { goal: "" });
    expect(res.ok).toBe(false);
  });

  it("plans and returns topological order", async () => {
    const handlers = setupHandlers();
    const res = await callHandler(handlers["mesh.plan"], "mesh.plan", {
      goal: "build",
      steps: [
        { id: "a", prompt: "first" },
        { id: "b", prompt: "second", dependsOn: ["a"] },
      ],
    });
    expect(res.ok).toBe(true);
    const payload = res.payload as { order?: string[]; plan?: { steps?: Array<{ id: string }> } };
    expect(payload.order).toEqual(["a", "b"]);
    expect(payload.plan?.steps?.length).toBe(2);
  });

  it("falls back to single-step plan when auto planner fails", async () => {
    const handlers = setupHandlers();
    agentCommandMock.mockRejectedValueOnce(new Error("planner unavailable"));

    const res = await callHandler(handlers["mesh.plan.auto"], "mesh.plan.auto", {
      goal: "ship release",
      agentId: "main",
    });

    expect(res.ok).toBe(true);
    const payload = res.payload as {
      source?: string;
      plan?: { steps?: Array<{ prompt: string }> };
    };
    expect(payload.source).toBe("fallback");
    expect(payload.plan?.steps?.[0]?.prompt).toBe("ship release");
  });

  it("runs mesh workflow and returns completed status", async () => {
    const handlers = setupHandlers();

    agentMethodMock.mockImplementation(({ respond }: { respond: TestRespond }) => {
      respond(true, { runId: "agent-run-1" });
    });
    agentWaitMethodMock.mockImplementation(({ respond }: { respond: TestRespond }) => {
      respond(true, { status: "ok" });
    });

    const res = await callHandler(handlers["mesh.run"], "mesh.run", {
      plan: {
        planId: "mesh-plan-1",
        goal: "do one thing",
        createdAt: Date.now(),
        steps: [{ id: "s1", prompt: "do one thing" }],
      },
    });

    expect(res.ok).toBe(true);
    const payload = res.payload as {
      status?: string;
      stats?: { succeeded?: number; total?: number };
    };
    expect(payload.status).toBe("completed");
    expect(payload.stats?.total).toBe(1);
    expect(payload.stats?.succeeded).toBe(1);
  });
});
