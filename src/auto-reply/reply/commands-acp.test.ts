import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";

const hoisted = vi.hoisted(() => {
  const callGatewayMock = vi.fn();
  const requireAcpRuntimeBackendMock = vi.fn();
  const readAcpSessionEntryMock = vi.fn();
  const upsertAcpSessionMetaMock = vi.fn();
  const resolveSessionStorePathForAcpMock = vi.fn();
  const loadSessionStoreMock = vi.fn();
  const getThreadBindingManagerMock = vi.fn<(accountId?: string) => unknown>();
  const unbindThreadBindingsBySessionKeyMock = vi.fn<(params: unknown) => unknown[]>(() => []);
  const ensureSessionMock = vi.fn();
  const runTurnMock = vi.fn();
  const cancelMock = vi.fn();
  const closeMock = vi.fn();
  return {
    callGatewayMock,
    requireAcpRuntimeBackendMock,
    readAcpSessionEntryMock,
    upsertAcpSessionMetaMock,
    resolveSessionStorePathForAcpMock,
    loadSessionStoreMock,
    getThreadBindingManagerMock,
    unbindThreadBindingsBySessionKeyMock,
    ensureSessionMock,
    runTurnMock,
    cancelMock,
    closeMock,
  };
});

vi.mock("../../gateway/call.js", () => ({
  callGateway: (args: unknown) => hoisted.callGatewayMock(args),
}));

vi.mock("../../acp/runtime/registry.js", () => ({
  requireAcpRuntimeBackend: (id?: string) => hoisted.requireAcpRuntimeBackendMock(id),
}));

vi.mock("../../acp/runtime/session-meta.js", () => ({
  readAcpSessionEntry: (args: unknown) => hoisted.readAcpSessionEntryMock(args),
  upsertAcpSessionMeta: (args: unknown) => hoisted.upsertAcpSessionMetaMock(args),
  resolveSessionStorePathForAcp: (args: unknown) => hoisted.resolveSessionStorePathForAcpMock(args),
}));

vi.mock("../../config/sessions.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../config/sessions.js")>();
  return {
    ...actual,
    loadSessionStore: (...args: unknown[]) => hoisted.loadSessionStoreMock(...args),
  };
});

vi.mock("../../discord/monitor/thread-bindings.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../discord/monitor/thread-bindings.js")>();
  return {
    ...actual,
    getThreadBindingManager: (accountId?: string) => hoisted.getThreadBindingManagerMock(accountId),
    unbindThreadBindingsBySessionKey: (params: unknown) =>
      hoisted.unbindThreadBindingsBySessionKeyMock(params),
  };
});

// Prevent transitive import chain from reaching discord/monitor which needs https-proxy-agent.
vi.mock("../../discord/monitor/gateway-plugin.js", () => ({
  createDiscordGatewayPlugin: () => ({}),
}));

const { handleAcpCommand } = await import("./commands-acp.js");
const { buildCommandTestParams } = await import("./commands-spawn.test-harness.js");

type FakeBinding = {
  accountId: string;
  channelId: string;
  threadId: string;
  targetKind: "subagent" | "acp";
  targetSessionKey: string;
  agentId: string;
  label?: string;
  boundBy: string;
  boundAt: number;
};

function createThreadBindingManager(overrides?: Partial<Record<string, unknown>>) {
  return {
    accountId: "default",
    getSessionTtlMs: vi.fn(() => 24 * 60 * 60 * 1000),
    getByThreadId: vi.fn(() => undefined),
    getBySessionKey: vi.fn(() => undefined),
    listBySessionKey: vi.fn(() => []),
    listBindings: vi.fn(() => []),
    bindTarget: vi.fn(async (params: Record<string, unknown>) => {
      const threadId =
        typeof params.threadId === "string" && params.threadId.trim()
          ? params.threadId.trim()
          : "thread-created";
      const targetSessionKey =
        typeof params.targetSessionKey === "string" ? params.targetSessionKey : "";
      return {
        accountId: "default",
        channelId: "parent-1",
        threadId,
        targetKind: "acp",
        targetSessionKey,
        agentId: typeof params.agentId === "string" ? params.agentId : "codex",
        label: typeof params.label === "string" ? params.label : undefined,
        boundBy: typeof params.boundBy === "string" ? params.boundBy : "system",
        boundAt: Date.now(),
      } satisfies FakeBinding;
    }),
    unbindThread: vi.fn(() => null),
    unbindBySessionKey: vi.fn(() => []),
    stop: vi.fn(),
    ...overrides,
  };
}

const baseCfg = {
  session: { mainKey: "main", scope: "per-sender" },
  acp: {
    enabled: true,
    dispatch: { enabled: true },
    backend: "acpx",
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

function createDiscordParams(commandBody: string, cfg: OpenClawConfig = baseCfg) {
  const params = buildCommandTestParams(commandBody, cfg, {
    Provider: "discord",
    Surface: "discord",
    OriginatingChannel: "discord",
    OriginatingTo: "channel:parent-1",
    AccountId: "default",
  });
  params.command.senderId = "user-1";
  return params;
}

describe("/acp command", () => {
  beforeEach(() => {
    hoisted.callGatewayMock.mockReset().mockResolvedValue({ ok: true });
    hoisted.readAcpSessionEntryMock.mockReset().mockReturnValue(null);
    hoisted.upsertAcpSessionMetaMock.mockReset().mockResolvedValue({
      sessionId: "session-1",
      updatedAt: Date.now(),
      acp: {
        backend: "acpx",
        agent: "codex",
        runtimeSessionName: "run-1",
        mode: "persistent",
        state: "idle",
        lastActivityAt: Date.now(),
      },
    });
    hoisted.resolveSessionStorePathForAcpMock.mockReset().mockReturnValue({
      cfg: baseCfg,
      storePath: "/tmp/sessions-acp.json",
    });
    hoisted.loadSessionStoreMock.mockReset().mockReturnValue({});
    hoisted.getThreadBindingManagerMock.mockReset().mockReturnValue(createThreadBindingManager());
    hoisted.unbindThreadBindingsBySessionKeyMock.mockReset().mockReturnValue([]);

    hoisted.ensureSessionMock
      .mockReset()
      .mockImplementation(async (input: { sessionKey: string }) => ({
        sessionKey: input.sessionKey,
        backend: "acpx",
        runtimeSessionName: `${input.sessionKey}:runtime`,
      }));
    hoisted.runTurnMock.mockReset().mockImplementation(async function* () {
      yield { type: "done" };
    });
    hoisted.cancelMock.mockReset().mockResolvedValue(undefined);
    hoisted.closeMock.mockReset().mockResolvedValue(undefined);

    hoisted.requireAcpRuntimeBackendMock.mockReset().mockReturnValue({
      id: "acpx",
      runtime: {
        ensureSession: hoisted.ensureSessionMock,
        runTurn: hoisted.runTurnMock,
        cancel: hoisted.cancelMock,
        close: hoisted.closeMock,
      },
    });
  });

  it("returns null when the message is not /acp", async () => {
    const params = createDiscordParams("/status");
    const result = await handleAcpCommand(params, true);
    expect(result).toBeNull();
  });

  it("shows help by default", async () => {
    const params = createDiscordParams("/acp");
    const result = await handleAcpCommand(params, true);
    expect(result?.reply?.text).toContain("ACP commands:");
    expect(result?.reply?.text).toContain("/acp spawn");
  });

  it("spawns an ACP session and binds a Discord thread", async () => {
    const manager = createThreadBindingManager();
    hoisted.getThreadBindingManagerMock.mockReturnValue(manager);

    const params = createDiscordParams("/acp spawn codex");
    const result = await handleAcpCommand(params, true);

    expect(result?.reply?.text).toContain("Spawned ACP session agent:codex:acp:");
    expect(result?.reply?.text).toContain("Created thread thread-created and bound it");
    expect(hoisted.requireAcpRuntimeBackendMock).toHaveBeenCalledWith("acpx");
    expect(hoisted.ensureSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: "codex",
        mode: "persistent",
      }),
    );
    expect(manager.bindTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        targetKind: "acp",
        createThread: true,
      }),
    );
    expect(hoisted.callGatewayMock).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "sessions.patch",
      }),
    );
    expect(hoisted.upsertAcpSessionMetaMock).toHaveBeenCalled();
  });

  it("rejects thread-bound ACP spawn when spawnAcpSessions is disabled", async () => {
    const cfg = {
      ...baseCfg,
      channels: {
        discord: {
          threadBindings: {
            enabled: true,
            spawnAcpSessions: false,
          },
        },
      },
    } satisfies OpenClawConfig;

    const params = createDiscordParams("/acp spawn codex", cfg);
    const result = await handleAcpCommand(params, true);

    expect(result?.reply?.text).toContain("spawnAcpSessions=true");
    expect(hoisted.closeMock).toHaveBeenCalledTimes(1);
    expect(hoisted.callGatewayMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: "sessions.patch" }),
    );
  });

  it("cancels the ACP session bound to the current thread", async () => {
    const manager = createThreadBindingManager({
      getByThreadId: vi.fn(() => ({
        accountId: "default",
        channelId: "parent-1",
        threadId: "thread-1",
        targetKind: "acp",
        targetSessionKey: "agent:codex:acp:s1",
        agentId: "codex",
        boundBy: "user-1",
        boundAt: Date.now(),
      })),
    });
    hoisted.getThreadBindingManagerMock.mockReturnValue(manager);
    hoisted.readAcpSessionEntryMock.mockReturnValue({
      sessionKey: "agent:codex:acp:s1",
      storeSessionKey: "agent:codex:acp:s1",
      acp: {
        backend: "acpx",
        agent: "codex",
        runtimeSessionName: "runtime-1",
        mode: "persistent",
        state: "running",
        lastActivityAt: Date.now(),
      },
    });

    const params = createDiscordParams("/acp cancel", baseCfg);
    params.ctx.MessageThreadId = "thread-1";

    const result = await handleAcpCommand(params, true);
    expect(result?.reply?.text).toContain("Cancel requested for ACP session agent:codex:acp:s1");
    expect(hoisted.cancelMock).toHaveBeenCalledWith({
      handle: {
        sessionKey: "agent:codex:acp:s1",
        backend: "acpx",
        runtimeSessionName: "runtime-1",
      },
      reason: "manual-cancel",
    });
  });

  it("sends steer instructions via ACP runtime", async () => {
    hoisted.callGatewayMock.mockImplementation(async (request: { method?: string }) => {
      if (request.method === "sessions.resolve") {
        return { key: "agent:codex:acp:s1" };
      }
      return { ok: true };
    });
    hoisted.readAcpSessionEntryMock.mockReturnValue({
      sessionKey: "agent:codex:acp:s1",
      storeSessionKey: "agent:codex:acp:s1",
      acp: {
        backend: "acpx",
        agent: "codex",
        runtimeSessionName: "runtime-1",
        mode: "persistent",
        state: "idle",
        lastActivityAt: Date.now(),
      },
    });
    hoisted.runTurnMock.mockImplementation(async function* () {
      yield { type: "text_delta", text: "Applied steering." };
      yield { type: "done" };
    });

    const params = createDiscordParams("/acp steer --session agent:codex:acp:s1 tighten logging");
    const result = await handleAcpCommand(params, true);

    expect(hoisted.runTurnMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "steer",
        text: "tighten logging",
      }),
    );
    expect(result?.reply?.text).toContain("Applied steering.");
  });

  it("closes an ACP session, unbinds thread targets, and clears metadata", async () => {
    const manager = createThreadBindingManager({
      getByThreadId: vi.fn(() => ({
        accountId: "default",
        channelId: "parent-1",
        threadId: "thread-1",
        targetKind: "acp",
        targetSessionKey: "agent:codex:acp:s1",
        agentId: "codex",
        boundBy: "user-1",
        boundAt: Date.now(),
      })),
    });
    hoisted.getThreadBindingManagerMock.mockReturnValue(manager);
    hoisted.readAcpSessionEntryMock.mockReturnValue({
      sessionKey: "agent:codex:acp:s1",
      storeSessionKey: "agent:codex:acp:s1",
      acp: {
        backend: "acpx",
        agent: "codex",
        runtimeSessionName: "runtime-1",
        mode: "persistent",
        state: "idle",
        lastActivityAt: Date.now(),
      },
    });
    hoisted.unbindThreadBindingsBySessionKeyMock.mockReturnValue([
      {
        accountId: "default",
        channelId: "parent-1",
        threadId: "thread-1",
        targetKind: "acp",
        targetSessionKey: "agent:codex:acp:s1",
        agentId: "codex",
        boundBy: "user-1",
        boundAt: Date.now(),
      },
    ] as FakeBinding[]);

    const params = createDiscordParams("/acp close", baseCfg);
    params.ctx.MessageThreadId = "thread-1";

    const result = await handleAcpCommand(params, true);

    expect(hoisted.closeMock).toHaveBeenCalledTimes(1);
    expect(hoisted.unbindThreadBindingsBySessionKeyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        targetKind: "acp",
        targetSessionKey: "agent:codex:acp:s1",
      }),
    );
    expect(hoisted.upsertAcpSessionMetaMock).toHaveBeenCalled();
    expect(result?.reply?.text).toContain("Removed 1 binding");
  });

  it("lists ACP sessions from the session store", async () => {
    const manager = createThreadBindingManager({
      listBySessionKey: vi.fn((key: string) =>
        key === "agent:codex:acp:s1"
          ? [
              {
                accountId: "default",
                channelId: "parent-1",
                threadId: "thread-1",
                targetKind: "acp",
                targetSessionKey: key,
                agentId: "codex",
                boundBy: "user-1",
                boundAt: Date.now(),
              },
            ]
          : [],
      ),
    });
    hoisted.getThreadBindingManagerMock.mockReturnValue(manager);
    hoisted.loadSessionStoreMock.mockReturnValue({
      "agent:codex:acp:s1": {
        sessionId: "sess-1",
        updatedAt: Date.now(),
        label: "codex-main",
        acp: {
          backend: "acpx",
          agent: "codex",
          runtimeSessionName: "runtime-1",
          mode: "persistent",
          state: "idle",
          lastActivityAt: Date.now(),
        },
      },
      "agent:main:main": {
        sessionId: "sess-main",
        updatedAt: Date.now(),
      },
    });

    const params = createDiscordParams("/acp sessions", baseCfg);
    const result = await handleAcpCommand(params, true);

    expect(result?.reply?.text).toContain("ACP sessions:");
    expect(result?.reply?.text).toContain("codex-main");
    expect(result?.reply?.text).toContain("thread:thread-1");
  });
});
