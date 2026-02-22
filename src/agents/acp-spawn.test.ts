import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../config/config.js";

const hoisted = vi.hoisted(() => {
  const callGatewayMock = vi.fn();
  const upsertAcpSessionMetaMock = vi.fn();
  const getThreadBindingManagerMock = vi.fn();
  const unbindThreadBindingsBySessionKeyMock = vi.fn((_params?: unknown) => []);
  const state = {
    cfg: {
      acp: {
        enabled: true,
        backend: "acpx",
        allowedAgents: ["codex"],
      },
      session: {
        mainKey: "main",
        scope: "per-sender",
      },
      channels: {
        discord: {
          threadBindings: {
            enabled: true,
            spawnAcpSessions: true,
          },
        },
      },
    } as OpenClawConfig,
  };
  return {
    callGatewayMock,
    upsertAcpSessionMetaMock,
    getThreadBindingManagerMock,
    unbindThreadBindingsBySessionKeyMock,
    state,
  };
});

vi.mock("../config/config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../config/config.js")>();
  return {
    ...actual,
    loadConfig: () => hoisted.state.cfg,
  };
});

vi.mock("../gateway/call.js", () => ({
  callGateway: (opts: unknown) => hoisted.callGatewayMock(opts),
}));

vi.mock("../acp/runtime/session-meta.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../acp/runtime/session-meta.js")>();
  return {
    ...actual,
    upsertAcpSessionMeta: (args: unknown) => hoisted.upsertAcpSessionMetaMock(args),
  };
});

vi.mock("../discord/monitor/thread-bindings.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../discord/monitor/thread-bindings.js")>();
  return {
    ...actual,
    getThreadBindingManager: (accountId?: string) => hoisted.getThreadBindingManagerMock(accountId),
    resolveThreadBindingThreadName: () => "codex-session",
    resolveThreadBindingIntroText: () => "intro",
    unbindThreadBindingsBySessionKey: (params: unknown) =>
      hoisted.unbindThreadBindingsBySessionKeyMock(params),
  };
});

const { spawnAcpDirect } = await import("./acp-spawn.js");

function createManager() {
  return {
    accountId: "default",
    getSessionTtlMs: vi.fn(() => 24 * 60 * 60 * 1000),
    getByThreadId: vi.fn(() => ({
      accountId: "default",
      channelId: "parent-channel",
      threadId: "requester-thread",
      targetKind: "subagent",
      targetSessionKey: "agent:main:subagent:1",
      agentId: "main",
      boundBy: "user-1",
      boundAt: Date.now(),
    })),
    getBySessionKey: vi.fn(() => undefined),
    listBySessionKey: vi.fn(() => []),
    listBindings: vi.fn(() => []),
    bindTarget: vi.fn(async (params: { targetSessionKey: string; agentId?: string }) => ({
      accountId: "default",
      channelId: "parent-channel",
      threadId: "child-thread",
      targetKind: "acp",
      targetSessionKey: params.targetSessionKey,
      agentId: params.agentId ?? "codex",
      boundBy: "system",
      boundAt: Date.now(),
    })),
    unbindThread: vi.fn(() => null),
    unbindBySessionKey: vi.fn(() => []),
    stop: vi.fn(),
  };
}

describe("spawnAcpDirect", () => {
  beforeEach(() => {
    hoisted.state.cfg = {
      acp: {
        enabled: true,
        backend: "acpx",
        allowedAgents: ["codex"],
      },
      session: {
        mainKey: "main",
        scope: "per-sender",
      },
      channels: {
        discord: {
          threadBindings: {
            enabled: true,
            spawnAcpSessions: true,
          },
        },
      },
    } satisfies OpenClawConfig;

    hoisted.callGatewayMock.mockReset().mockImplementation(async (argsUnknown: unknown) => {
      const args = argsUnknown as { method?: string };
      if (args.method === "sessions.patch") {
        return { ok: true };
      }
      if (args.method === "agent") {
        return { runId: "run-1" };
      }
      if (args.method === "sessions.delete") {
        return { ok: true };
      }
      return {};
    });

    hoisted.upsertAcpSessionMetaMock
      .mockReset()
      .mockImplementation(async (argsUnknown: unknown) => {
        const args = argsUnknown as {
          mutate: (
            current: unknown,
            entry: { sessionId: string; updatedAt: number },
          ) => Record<string, unknown> | undefined;
        };
        const now = Date.now();
        const acp = args.mutate(undefined, { sessionId: "session-1", updatedAt: now });
        return {
          sessionId: "session-1",
          updatedAt: now,
          acp,
        };
      });

    hoisted.getThreadBindingManagerMock.mockReset().mockReturnValue(createManager());
    hoisted.unbindThreadBindingsBySessionKeyMock.mockReset().mockReturnValue([]);
  });

  it("spawns ACP session, binds a new thread, and dispatches initial task", async () => {
    const manager = createManager();
    hoisted.getThreadBindingManagerMock.mockReturnValue(manager);

    const result = await spawnAcpDirect(
      {
        task: "Investigate flaky tests",
        agentId: "codex",
        mode: "session",
        thread: true,
      },
      {
        agentSessionKey: "agent:main:main",
        agentChannel: "discord",
        agentAccountId: "default",
        agentTo: "channel:parent-channel",
        agentThreadId: "requester-thread",
      },
    );

    expect(result.status).toBe("accepted");
    expect(result.childSessionKey).toMatch(/^agent:codex:acp:/);
    expect(result.runId).toBe("run-1");
    expect(result.mode).toBe("session");
    expect(manager.bindTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        createThread: true,
        targetKind: "acp",
      }),
    );

    const agentCall = hoisted.callGatewayMock.mock.calls
      .map((call: unknown[]) => call[0] as { method?: string; params?: Record<string, unknown> })
      .find((request) => request.method === "agent");
    expect(agentCall?.params?.sessionKey).toMatch(/^agent:codex:acp:/);
    expect(agentCall?.params?.threadId).toBe("child-thread");
    expect(agentCall?.params?.deliver).toBe(true);

    const upsertArgs = hoisted.upsertAcpSessionMetaMock.mock.calls[0]?.[0] as
      | {
          sessionKey: string;
          mutate: (current: unknown, entry: { sessionId: string; updatedAt: number }) => unknown;
        }
      | undefined;
    expect(upsertArgs?.sessionKey).toMatch(/^agent:codex:acp:/);
    const seededMeta = upsertArgs?.mutate(undefined, {
      sessionId: "session-1",
      updatedAt: Date.now(),
    }) as
      | {
          backend?: string;
          runtimeSessionName?: string;
        }
      | undefined;
    expect(seededMeta?.backend).toBe("acpx");
    expect(seededMeta?.runtimeSessionName).toBe(upsertArgs?.sessionKey);
  });

  it("rejects disallowed ACP agents", async () => {
    hoisted.state.cfg = {
      ...hoisted.state.cfg,
      acp: {
        enabled: true,
        backend: "acpx",
        allowedAgents: ["claudecode"],
      },
    };

    const result = await spawnAcpDirect(
      {
        task: "hello",
        agentId: "codex",
      },
      {
        agentSessionKey: "agent:main:main",
      },
    );

    expect(result).toMatchObject({
      status: "forbidden",
    });
  });

  it("requires an explicit ACP agent when no config default exists", async () => {
    const result = await spawnAcpDirect(
      {
        task: "hello",
      },
      {
        agentSessionKey: "agent:main:main",
      },
    );

    expect(result.status).toBe("error");
    expect(result.error).toContain("set `acp.defaultAgent`");
  });

  it("fails fast when Discord ACP thread spawn is disabled", async () => {
    hoisted.state.cfg = {
      ...hoisted.state.cfg,
      channels: {
        discord: {
          threadBindings: {
            enabled: true,
            spawnAcpSessions: false,
          },
        },
      },
    };

    const result = await spawnAcpDirect(
      {
        task: "hello",
        agentId: "codex",
        thread: true,
        mode: "session",
      },
      {
        agentChannel: "discord",
        agentAccountId: "default",
        agentTo: "channel:parent-channel",
      },
    );

    expect(result.status).toBe("error");
    expect(result.error).toContain("spawnAcpSessions=true");
  });
});
