import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

type LifecycleEvent = {
  stream?: string;
  runId: string;
  data?: {
    phase?: string;
    startedAt?: number;
    endedAt?: number;
    aborted?: boolean;
    error?: string;
  };
};

let lifecycleHandler: ((evt: LifecycleEvent) => void) | undefined;

type GatewayCallResult = { status?: string; startedAt?: number; endedAt?: number };

const callGatewayMock = vi.fn<(request: unknown) => Promise<GatewayCallResult>>(async (request) => {
  const typed = request as { method?: string };
  if (typed.method === "agent.wait") {
    return { status: "ok", startedAt: 100, endedAt: 220 };
  }
  return {};
});

const announceSpy = vi.fn<(...args: unknown[]) => Promise<boolean>>(async () => true);
const triggerInternalHookMock = vi.fn<(event: unknown) => Promise<void>>(async () => {});
const createInternalHookEventMock = vi.fn<
  (
    type: string,
    action: string,
    sessionKey: string,
    context: Record<string, unknown>,
  ) => {
    type: string;
    action: string;
    sessionKey: string;
    context: Record<string, unknown>;
    timestamp: Date;
    messages: string[];
  }
>((type: string, action: string, sessionKey: string, context: Record<string, unknown>) => ({
  type,
  action,
  sessionKey,
  context,
  timestamp: new Date(),
  messages: [] as string[],
}));

vi.mock("../gateway/call.js", () => ({
  callGateway: (request: unknown) => callGatewayMock(request),
}));

vi.mock("../infra/agent-events.js", () => ({
  onAgentEvent: vi.fn((handler: (evt: LifecycleEvent) => void) => {
    lifecycleHandler = handler;
    return () => {};
  }),
}));

vi.mock("../config/config.js", () => ({
  loadConfig: vi.fn(() => ({
    agents: { defaults: { subagents: { archiveAfterMinutes: 0 } } },
  })),
}));

vi.mock("./subagent-announce.js", () => ({
  runSubagentAnnounceFlow: (...args: unknown[]) => announceSpy(...args),
}));

vi.mock("../plugins/hook-runner-global.js", () => ({
  getGlobalHookRunner: vi.fn(() => ({
    hasHooks: () => false,
    runSubagentEnded: vi.fn(),
  })),
}));

vi.mock("./subagent-registry.store.js", () => ({
  loadSubagentRegistryFromDisk: vi.fn(() => new Map()),
  saveSubagentRegistryToDisk: vi.fn(() => {}),
}));

vi.mock("../hooks/internal-hooks.js", () => ({
  createInternalHookEvent: (
    type: string,
    action: string,
    sessionKey: string,
    context: Record<string, unknown>,
  ) => createInternalHookEventMock(type, action, sessionKey, context),
  triggerInternalHook: (event: unknown) => triggerInternalHookMock(event),
}));

describe("subagent registry internal hooks", () => {
  let mod: typeof import("./subagent-registry.js");

  beforeAll(async () => {
    mod = await import("./subagent-registry.js");
  });

  const flush = async () => {
    await new Promise<void>((resolve) => setImmediate(resolve));
    await Promise.resolve();
  };

  afterEach(() => {
    lifecycleHandler = undefined;
    callGatewayMock.mockReset();
    callGatewayMock.mockImplementation(async (request: unknown) => {
      const typed = request as { method?: string };
      if (typed.method === "agent.wait") {
        return { status: "ok", startedAt: 100, endedAt: 220 };
      }
      return {};
    });
    announceSpy.mockReset();
    announceSpy.mockResolvedValue(true);
    triggerInternalHookMock.mockReset();
    triggerInternalHookMock.mockResolvedValue(undefined);
    createInternalHookEventMock.mockClear();
    mod.resetSubagentRegistryForTests({ persist: false });
  });

  it("emits subagent:complete immediately for completion-mode runs before announce resolves", async () => {
    callGatewayMock.mockImplementation(async (request: unknown) => {
      const typed = request as { method?: string };
      if (typed.method === "agent.wait") {
        return new Promise<GatewayCallResult>(() => undefined);
      }
      return {};
    });

    let resolveAnnounce!: (value: boolean) => void;
    announceSpy.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          resolveAnnounce = resolve;
        }),
    );

    mod.registerSubagentRun({
      runId: "run-complete-immediate",
      childSessionKey: "agent:main:subagent:child-immediate",
      requesterSessionKey: "agent:main:main",
      requesterDisplayKey: "main",
      task: "immediate completion signal",
      cleanup: "keep",
      expectsCompletionMessage: true,
    });

    lifecycleHandler?.({
      stream: "lifecycle",
      runId: "run-complete-immediate",
      data: {
        phase: "end",
        startedAt: 1000,
        endedAt: 1180,
      },
    });

    await flush();

    expect(triggerInternalHookMock).toHaveBeenCalledTimes(1);
    const hookEvent = triggerInternalHookMock.mock.calls[0]?.[0] as
      | {
          type: string;
          action: string;
          sessionKey: string;
          context: Record<string, unknown>;
        }
      | undefined;
    expect(hookEvent?.type).toBe("subagent");
    expect(hookEvent?.action).toBe("complete");
    expect(hookEvent?.sessionKey).toBe("agent:main:main");
    expect(hookEvent?.context).toMatchObject({
      childSessionKey: "agent:main:subagent:child-immediate",
      runId: "run-complete-immediate",
      task: "immediate completion signal",
      outcome: { status: "ok" },
      reason: "subagent-complete",
    });
    expect(typeof hookEvent?.context?.startedAt).toBe("number");
    expect(typeof hookEvent?.context?.endedAt).toBe("number");
    expect(typeof hookEvent?.context?.runtimeMs).toBe("number");
    expect(Number(hookEvent?.context?.runtimeMs)).toBeGreaterThanOrEqual(0);

    resolveAnnounce(true);
    await flush();
  });

  it("emits exactly once when lifecycle and agent.wait both report the same completion", async () => {
    mod.registerSubagentRun({
      runId: "run-dedup-both-paths",
      childSessionKey: "agent:main:subagent:child-dedup",
      requesterSessionKey: "agent:main:main",
      requesterDisplayKey: "main",
      task: "dedupe test",
      cleanup: "keep",
      expectsCompletionMessage: true,
    });

    lifecycleHandler?.({
      stream: "lifecycle",
      runId: "run-dedup-both-paths",
      data: {
        phase: "end",
        startedAt: 2000,
        endedAt: 2300,
      },
    });

    await flush();
    await flush();

    expect(triggerInternalHookMock).toHaveBeenCalledTimes(1);
    const hookEvent = triggerInternalHookMock.mock.calls[0]?.[0] as
      | { action?: string; context?: Record<string, unknown> }
      | undefined;
    expect(hookEvent?.action).toBe("complete");
    expect(hookEvent?.context?.runId).toBe("run-dedup-both-paths");
  });

  it("maps agent.wait timeout to subagent:timeout with timeout outcome", async () => {
    callGatewayMock.mockImplementation(async (request: unknown) => {
      const typed = request as { method?: string };
      if (typed.method === "agent.wait") {
        return { status: "timeout", startedAt: 3000, endedAt: 3600 };
      }
      return {};
    });

    mod.registerSubagentRun({
      runId: "run-timeout-action",
      childSessionKey: "agent:main:subagent:child-timeout",
      requesterSessionKey: "agent:main:main",
      requesterDisplayKey: "main",
      task: "timeout mapping",
      cleanup: "keep",
      expectsCompletionMessage: true,
    });

    await flush();
    await flush();

    expect(triggerInternalHookMock).toHaveBeenCalledTimes(1);
    const hookEvent = triggerInternalHookMock.mock.calls[0]?.[0] as
      | { action?: string; context?: Record<string, unknown> }
      | undefined;
    expect(hookEvent?.action).toBe("timeout");
    expect(hookEvent?.context).toMatchObject({
      runId: "run-timeout-action",
      outcome: { status: "timeout" },
      reason: "subagent-complete",
      runtimeMs: 600,
    });
  });

  it("maps explicit termination to subagent:killed and keeps error detail", async () => {
    callGatewayMock.mockImplementation(async (request: unknown) => {
      const typed = request as { method?: string };
      if (typed.method === "agent.wait") {
        return new Promise<GatewayCallResult>(() => undefined);
      }
      return {};
    });

    mod.registerSubagentRun({
      runId: "run-killed-action",
      childSessionKey: "agent:main:subagent:child-killed",
      requesterSessionKey: "agent:main:main",
      requesterDisplayKey: "main",
      task: "kill mapping",
      cleanup: "keep",
    });

    const updated = mod.markSubagentRunTerminated({
      runId: "run-killed-action",
      reason: "manual-stop",
    });
    expect(updated).toBe(1);

    await flush();

    expect(triggerInternalHookMock).toHaveBeenCalledTimes(1);
    const hookEvent = triggerInternalHookMock.mock.calls[0]?.[0] as
      | { action?: string; context?: Record<string, unknown> }
      | undefined;
    expect(hookEvent?.action).toBe("killed");
    expect(hookEvent?.context).toMatchObject({
      runId: "run-killed-action",
      outcome: { status: "error", error: "manual-stop" },
      reason: "subagent-killed",
    });
  });
});
