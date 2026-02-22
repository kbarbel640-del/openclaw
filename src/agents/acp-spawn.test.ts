import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../config/config.js";

const hoisted = vi.hoisted(() => {
  const callGatewayMock = vi.fn();
  const getThreadBindingManagerMock = vi.fn();
  const unbindThreadBindingsBySessionKeyMock = vi.fn((_params?: unknown) => []);
  const initializeSessionMock = vi.fn();
  const closeSessionMock = vi.fn();
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
    getThreadBindingManagerMock,
    unbindThreadBindingsBySessionKeyMock,
    initializeSessionMock,
    closeSessionMock,
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

vi.mock("../acp/control-plane/manager.js", () => {
  return {
    getAcpSessionManager: () => ({
      initializeSession: (params: unknown) => hoisted.initializeSessionMock(params),
      closeSession: (params: unknown) => hoisted.closeSessionMock(params),
    }),
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

    hoisted.initializeSessionMock.mockReset().mockImplementation(async (argsUnknown: unknown) => {
      const args = argsUnknown as {
        sessionKey: string;
        agent: string;
        mode: "persistent" | "oneshot";
      };
      return {
        runtime: {
          close: vi.fn(async () => {}),
        },
        handle: {
          sessionKey: args.sessionKey,
          backend: "acpx",
          runtimeSessionName: `${args.sessionKey}:runtime`,
        },
        meta: {
          backend: "acpx",
          agent: args.agent,
          runtimeSessionName: `${args.sessionKey}:runtime`,
          mode: args.mode,
          state: "idle",
          lastActivityAt: Date.now(),
        },
      };
    });
    hoisted.closeSessionMock.mockReset().mockResolvedValue({
      runtimeClosed: true,
      metaCleared: false,
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
    expect(hoisted.initializeSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionKey: expect.stringMatching(/^agent:codex:acp:/),
        agent: "codex",
        mode: "persistent",
      }),
    );
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
