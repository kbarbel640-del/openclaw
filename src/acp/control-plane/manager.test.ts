import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionAcpMeta } from "../../config/sessions/types.js";
import { AcpRuntimeError } from "../runtime/errors.js";
import type { AcpRuntime } from "../runtime/types.js";

const hoisted = vi.hoisted(() => {
  const readAcpSessionEntryMock = vi.fn();
  const upsertAcpSessionMetaMock = vi.fn();
  const requireAcpRuntimeBackendMock = vi.fn();
  return {
    readAcpSessionEntryMock,
    upsertAcpSessionMetaMock,
    requireAcpRuntimeBackendMock,
  };
});

vi.mock("../runtime/session-meta.js", () => ({
  readAcpSessionEntry: (params: unknown) => hoisted.readAcpSessionEntryMock(params),
  upsertAcpSessionMeta: (params: unknown) => hoisted.upsertAcpSessionMetaMock(params),
}));

vi.mock("../runtime/registry.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../runtime/registry.js")>();
  return {
    ...actual,
    requireAcpRuntimeBackend: (backendId?: string) =>
      hoisted.requireAcpRuntimeBackendMock(backendId),
  };
});

const { AcpSessionManager } = await import("./manager.js");

const baseCfg = {
  acp: {
    enabled: true,
    backend: "acpx",
    dispatch: { enabled: true },
  },
} as const;

function createRuntime(): {
  runtime: AcpRuntime;
  ensureSession: ReturnType<typeof vi.fn>;
  runTurn: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
} {
  const ensureSession = vi.fn(
    async (input: { sessionKey: string; agent: string; mode: "persistent" | "oneshot" }) => ({
      sessionKey: input.sessionKey,
      backend: "acpx",
      runtimeSessionName: `${input.sessionKey}:${input.mode}:runtime`,
    }),
  );
  const runTurn = vi.fn(async function* () {
    yield { type: "done" as const };
  });
  const cancel = vi.fn(async () => {});
  const close = vi.fn(async () => {});
  return {
    runtime: {
      ensureSession,
      runTurn,
      cancel,
      close,
    },
    ensureSession,
    runTurn,
    cancel,
    close,
  };
}

function readySessionMeta() {
  return {
    backend: "acpx",
    agent: "codex",
    runtimeSessionName: "runtime-1",
    mode: "persistent" as const,
    state: "idle" as const,
    lastActivityAt: Date.now(),
  };
}

function extractStatesFromUpserts(): SessionAcpMeta["state"][] {
  const states: SessionAcpMeta["state"][] = [];
  for (const [firstArg] of hoisted.upsertAcpSessionMetaMock.mock.calls) {
    const payload = firstArg as {
      mutate: (
        current: SessionAcpMeta | undefined,
        entry: { acp?: SessionAcpMeta } | undefined,
      ) => SessionAcpMeta | null | undefined;
    };
    const current = readySessionMeta();
    const next = payload.mutate(current, { acp: current });
    if (next?.state) {
      states.push(next.state);
    }
  }
  return states;
}

describe("AcpSessionManager", () => {
  beforeEach(() => {
    hoisted.readAcpSessionEntryMock.mockReset();
    hoisted.upsertAcpSessionMetaMock.mockReset().mockResolvedValue(null);
    hoisted.requireAcpRuntimeBackendMock.mockReset();
  });

  it("marks ACP-shaped sessions without metadata as stale", () => {
    hoisted.readAcpSessionEntryMock.mockReturnValue(null);
    const manager = new AcpSessionManager();

    const resolved = manager.resolveSession({
      cfg: baseCfg,
      sessionKey: "agent:codex:acp:session-1",
    });

    expect(resolved.kind).toBe("stale");
    if (resolved.kind !== "stale") {
      return;
    }
    expect(resolved.error.code).toBe("ACP_SESSION_INIT_FAILED");
    expect(resolved.error.message).toContain("ACP metadata is missing");
  });

  it("serializes concurrent turns for the same ACP session", async () => {
    const runtimeState = createRuntime();
    hoisted.requireAcpRuntimeBackendMock.mockReturnValue({
      id: "acpx",
      runtime: runtimeState.runtime,
    });
    hoisted.readAcpSessionEntryMock.mockReturnValue({
      sessionKey: "agent:codex:acp:session-1",
      storeSessionKey: "agent:codex:acp:session-1",
      acp: readySessionMeta(),
    });

    let inFlight = 0;
    let maxInFlight = 0;
    runtimeState.runTurn.mockImplementation(async function* (_input: { requestId: string }) {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      try {
        await new Promise((resolve) => setTimeout(resolve, 10));
        yield { type: "done" };
      } finally {
        inFlight -= 1;
      }
    });

    const manager = new AcpSessionManager();
    const first = manager.runTurn({
      cfg: baseCfg,
      sessionKey: "agent:codex:acp:session-1",
      text: "first",
      mode: "prompt",
      requestId: "r1",
    });
    const second = manager.runTurn({
      cfg: baseCfg,
      sessionKey: "agent:codex:acp:session-1",
      text: "second",
      mode: "prompt",
      requestId: "r2",
    });
    await Promise.all([first, second]);

    expect(maxInFlight).toBe(1);
    expect(runtimeState.runTurn).toHaveBeenCalledTimes(2);
  });

  it("runs turns for different ACP sessions in parallel", async () => {
    const runtimeState = createRuntime();
    hoisted.requireAcpRuntimeBackendMock.mockReturnValue({
      id: "acpx",
      runtime: runtimeState.runtime,
    });
    hoisted.readAcpSessionEntryMock.mockImplementation((paramsUnknown: unknown) => {
      const sessionKey = (paramsUnknown as { sessionKey?: string }).sessionKey ?? "";
      return {
        sessionKey,
        storeSessionKey: sessionKey,
        acp: {
          ...readySessionMeta(),
          runtimeSessionName: `runtime:${sessionKey}`,
        },
      };
    });

    let inFlight = 0;
    let maxInFlight = 0;
    runtimeState.runTurn.mockImplementation(async function* () {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      try {
        await new Promise((resolve) => setTimeout(resolve, 15));
        yield { type: "done" as const };
      } finally {
        inFlight -= 1;
      }
    });

    const manager = new AcpSessionManager();
    await Promise.all([
      manager.runTurn({
        cfg: baseCfg,
        sessionKey: "agent:codex:acp:session-a",
        text: "first",
        mode: "prompt",
        requestId: "r1",
      }),
      manager.runTurn({
        cfg: baseCfg,
        sessionKey: "agent:codex:acp:session-b",
        text: "second",
        mode: "prompt",
        requestId: "r2",
      }),
    ]);

    expect(maxInFlight).toBe(2);
  });

  it("reuses runtime session handles for repeat turns in the same manager process", async () => {
    const runtimeState = createRuntime();
    hoisted.requireAcpRuntimeBackendMock.mockReturnValue({
      id: "acpx",
      runtime: runtimeState.runtime,
    });
    hoisted.readAcpSessionEntryMock.mockReturnValue({
      sessionKey: "agent:codex:acp:session-1",
      storeSessionKey: "agent:codex:acp:session-1",
      acp: readySessionMeta(),
    });

    const manager = new AcpSessionManager();
    await manager.runTurn({
      cfg: baseCfg,
      sessionKey: "agent:codex:acp:session-1",
      text: "first",
      mode: "prompt",
      requestId: "r1",
    });
    await manager.runTurn({
      cfg: baseCfg,
      sessionKey: "agent:codex:acp:session-1",
      text: "second",
      mode: "prompt",
      requestId: "r2",
    });

    expect(runtimeState.ensureSession).toHaveBeenCalledTimes(1);
    expect(runtimeState.runTurn).toHaveBeenCalledTimes(2);
  });

  it("rehydrates runtime handles after a manager restart", async () => {
    const runtimeState = createRuntime();
    hoisted.requireAcpRuntimeBackendMock.mockReturnValue({
      id: "acpx",
      runtime: runtimeState.runtime,
    });
    hoisted.readAcpSessionEntryMock.mockReturnValue({
      sessionKey: "agent:codex:acp:session-1",
      storeSessionKey: "agent:codex:acp:session-1",
      acp: readySessionMeta(),
    });

    const managerA = new AcpSessionManager();
    await managerA.runTurn({
      cfg: baseCfg,
      sessionKey: "agent:codex:acp:session-1",
      text: "before restart",
      mode: "prompt",
      requestId: "r1",
    });
    const managerB = new AcpSessionManager();
    await managerB.runTurn({
      cfg: baseCfg,
      sessionKey: "agent:codex:acp:session-1",
      text: "after restart",
      mode: "prompt",
      requestId: "r2",
    });

    expect(runtimeState.ensureSession).toHaveBeenCalledTimes(2);
  });

  it("preempts an active turn on cancel and returns to idle state", async () => {
    const runtimeState = createRuntime();
    hoisted.requireAcpRuntimeBackendMock.mockReturnValue({
      id: "acpx",
      runtime: runtimeState.runtime,
    });
    hoisted.readAcpSessionEntryMock.mockReturnValue({
      sessionKey: "agent:codex:acp:session-1",
      storeSessionKey: "agent:codex:acp:session-1",
      acp: readySessionMeta(),
    });

    let enteredRun = false;
    runtimeState.runTurn.mockImplementation(async function* (input: { signal?: AbortSignal }) {
      enteredRun = true;
      await new Promise<void>((resolve) => {
        if (input.signal?.aborted) {
          resolve();
          return;
        }
        input.signal?.addEventListener("abort", () => resolve(), { once: true });
      });
      yield { type: "done" as const, stopReason: "cancel" };
    });

    const manager = new AcpSessionManager();
    const runPromise = manager.runTurn({
      cfg: baseCfg,
      sessionKey: "agent:codex:acp:session-1",
      text: "long task",
      mode: "prompt",
      requestId: "run-1",
    });
    await vi.waitFor(() => {
      expect(enteredRun).toBe(true);
    });

    await manager.cancelSession({
      cfg: baseCfg,
      sessionKey: "agent:codex:acp:session-1",
      reason: "manual-cancel",
    });
    await runPromise;

    expect(runtimeState.cancel).toHaveBeenCalledTimes(1);
    expect(runtimeState.cancel).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "manual-cancel",
      }),
    );
    const states = extractStatesFromUpserts();
    expect(states).toContain("running");
    expect(states).toContain("idle");
    expect(states).not.toContain("error");
  });

  it("can close and clear metadata when backend is unavailable", async () => {
    hoisted.readAcpSessionEntryMock.mockReturnValue({
      sessionKey: "agent:codex:acp:session-1",
      storeSessionKey: "agent:codex:acp:session-1",
      acp: readySessionMeta(),
    });
    hoisted.requireAcpRuntimeBackendMock.mockImplementation(() => {
      throw new AcpRuntimeError(
        "ACP_BACKEND_MISSING",
        "ACP runtime backend is not configured. Install and enable the acpx runtime plugin.",
      );
    });

    const manager = new AcpSessionManager();
    const result = await manager.closeSession({
      cfg: baseCfg,
      sessionKey: "agent:codex:acp:session-1",
      reason: "manual-close",
      allowBackendUnavailable: true,
      clearMeta: true,
    });

    expect(result.runtimeClosed).toBe(false);
    expect(result.runtimeNotice).toContain("not configured");
    expect(result.metaCleared).toBe(true);
    expect(hoisted.upsertAcpSessionMetaMock).toHaveBeenCalled();
  });
});
