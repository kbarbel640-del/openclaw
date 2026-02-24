import { describe, expect, it, vi } from "vitest";
import {
  loadHandoffTargets,
  loadOrchestrationConfig,
  loadOrchestrationLogs,
  loadSharedContext,
  type OrchestrationState,
} from "./orchestration.ts";

function createState(): { state: OrchestrationState; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn();
  const state: OrchestrationState = {
    client: {
      request,
    } as unknown as OrchestrationState["client"],
    connected: true,
    logsLoading: false,
    logsError: null,
    logsResult: null,
    configLoading: false,
    configError: null,
    configResult: null,
    handoffTargetsLoading: false,
    handoffTargetsError: null,
    handoffTargetsResult: null,
    sharedContextLoading: false,
    sharedContextError: null,
    sharedContextResult: null,
  };
  return { state, request };
}

describe("loadOrchestrationLogs", () => {
  it("loads logs and stores result", async () => {
    const { state, request } = createState();
    const payload = {
      entries: [
        {
          timestamp: Date.now(),
          runId: "run-123",
          sequence: 1,
          eventType: "handoff",
          fromAgent: "agent-a",
          toAgent: "agent-b",
        },
      ],
      total: 1,
    };
    request.mockResolvedValue(payload);

    await loadOrchestrationLogs(state, { limit: 50 });

    expect(request).toHaveBeenCalledWith("orchestration.logs.list", {
      runId: undefined,
      limit: 50,
      offset: 0,
    });
    expect(state.logsResult).toEqual(payload);
    expect(state.logsError).toBeNull();
    expect(state.logsLoading).toBe(false);
  });

  it("uses default limit and offset when not provided", async () => {
    const { state, request } = createState();
    const payload = { entries: [], total: 0 };
    request.mockResolvedValue(payload);

    await loadOrchestrationLogs(state);

    expect(request).toHaveBeenCalledWith("orchestration.logs.list", {
      runId: undefined,
      limit: 100,
      offset: 0,
    });
  });

  it("captures request errors", async () => {
    const { state, request } = createState();
    request.mockRejectedValue(new Error("gateway unavailable"));

    await loadOrchestrationLogs(state);

    expect(state.logsResult).toBeNull();
    expect(state.logsError).toContain("gateway unavailable");
    expect(state.logsLoading).toBe(false);
  });

  it("does nothing if client is null", async () => {
    const { state, request } = createState();
    state.client = null;

    await loadOrchestrationLogs(state);

    expect(request).not.toHaveBeenCalled();
  });

  it("does nothing if not connected", async () => {
    const { state, request } = createState();
    state.connected = false;

    await loadOrchestrationLogs(state);

    expect(request).not.toHaveBeenCalled();
  });

  it("does nothing if already loading", async () => {
    const { state, request } = createState();
    state.logsLoading = true;

    await loadOrchestrationLogs(state);

    expect(request).not.toHaveBeenCalled();
  });
});

describe("loadOrchestrationConfig", () => {
  it("loads config and stores result", async () => {
    const { state, request } = createState();
    const payload = {
      agentId: "agent-a",
      config: {
        agentId: "agent-a",
        supervisor: {
          enabled: true,
          defaultStrategy: "delegate",
        },
        intents: [
          {
            id: "coding",
            keywords: ["code", "debug"],
            categories: ["development"],
          },
        ],
      },
    };
    request.mockResolvedValue(payload);

    await loadOrchestrationConfig(state, "agent-a");

    expect(request).toHaveBeenCalledWith("orchestration.config.get", {
      agentId: "agent-a",
    });
    expect(state.configResult).toEqual(payload);
    expect(state.configError).toBeNull();
    expect(state.configLoading).toBe(false);
  });

  it("captures request errors", async () => {
    const { state, request } = createState();
    request.mockRejectedValue(new Error("agent not found"));

    await loadOrchestrationConfig(state, "unknown");

    expect(state.configResult).toBeNull();
    expect(state.configError).toContain("agent not found");
    expect(state.configLoading).toBe(false);
  });

  it("does nothing if client is null", async () => {
    const { state, request } = createState();
    state.client = null;

    await loadOrchestrationConfig(state, "agent-a");

    expect(request).not.toHaveBeenCalled();
  });

  it("does nothing if not connected", async () => {
    const { state, request } = createState();
    state.connected = false;

    await loadOrchestrationConfig(state, "agent-a");

    expect(request).not.toHaveBeenCalled();
  });

  it("does nothing if already loading", async () => {
    const { state, request } = createState();
    state.configLoading = true;

    await loadOrchestrationConfig(state, "agent-a");

    expect(request).not.toHaveBeenCalled();
  });
});

describe("loadHandoffTargets", () => {
  it("loads handoff targets and stores result", async () => {
    const { state, request } = createState();
    const payload = {
      agentId: "agent-a",
      targets: ["agent-b", "agent-c"],
    };
    request.mockResolvedValue(payload);

    await loadHandoffTargets(state, "agent-a");

    expect(request).toHaveBeenCalledWith("orchestration.handoff.targets", {
      agentId: "agent-a",
    });
    expect(state.handoffTargetsResult).toEqual(payload);
    expect(state.handoffTargetsError).toBeNull();
    expect(state.handoffTargetsLoading).toBe(false);
  });

  it("captures request errors", async () => {
    const { state, request } = createState();
    request.mockRejectedValue(new Error("permission denied"));

    await loadHandoffTargets(state, "agent-a");

    expect(state.handoffTargetsResult).toBeNull();
    expect(state.handoffTargetsError).toContain("permission denied");
    expect(state.handoffTargetsLoading).toBe(false);
  });

  it("does nothing if client is null", async () => {
    const { state, request } = createState();
    state.client = null;

    await loadHandoffTargets(state, "agent-a");

    expect(request).not.toHaveBeenCalled();
  });

  it("does nothing if not connected", async () => {
    const { state, request } = createState();
    state.connected = false;

    await loadHandoffTargets(state, "agent-a");

    expect(request).not.toHaveBeenCalled();
  });

  it("does nothing if already loading", async () => {
    const { state, request } = createState();
    state.handoffTargetsLoading = true;

    await loadHandoffTargets(state, "agent-a");

    expect(request).not.toHaveBeenCalled();
  });
});

describe("loadSharedContext", () => {
  it("loads shared context and stores result", async () => {
    const { state, request } = createState();
    const payload = {
      agentId: "agent-a",
      scope: "global",
      items: [
        {
          key: "user_preferences",
          value: { theme: "dark" },
          scope: "global",
          updatedAt: Date.now(),
        },
      ],
    };
    request.mockResolvedValue(payload);

    await loadSharedContext(state, "agent-a", "global");

    expect(request).toHaveBeenCalledWith("orchestration.sharedContext.list", {
      agentId: "agent-a",
      scope: "global",
      sessionKey: undefined,
    });
    expect(state.sharedContextResult).toEqual(payload);
    expect(state.sharedContextError).toBeNull();
    expect(state.sharedContextLoading).toBe(false);
  });

  it("includes sessionKey when provided", async () => {
    const { state, request } = createState();
    const payload = {
      agentId: "agent-a",
      scope: "session",
      items: [],
    };
    request.mockResolvedValue(payload);

    await loadSharedContext(state, "agent-a", "session", "session-123");

    expect(request).toHaveBeenCalledWith("orchestration.sharedContext.list", {
      agentId: "agent-a",
      scope: "session",
      sessionKey: "session-123",
    });
  });

  it("captures request errors", async () => {
    const { state, request } = createState();
    request.mockRejectedValue(new Error("access denied"));

    await loadSharedContext(state, "agent-a", "global");

    expect(state.sharedContextResult).toBeNull();
    expect(state.sharedContextError).toContain("access denied");
    expect(state.sharedContextLoading).toBe(false);
  });

  it("does nothing if client is null", async () => {
    const { state, request } = createState();
    state.client = null;

    await loadSharedContext(state, "agent-a", "global");

    expect(request).not.toHaveBeenCalled();
  });

  it("does nothing if not connected", async () => {
    const { state, request } = createState();
    state.connected = false;

    await loadSharedContext(state, "agent-a", "global");

    expect(request).not.toHaveBeenCalled();
  });

  it("does nothing if already loading", async () => {
    const { state, request } = createState();
    state.sharedContextLoading = true;

    await loadSharedContext(state, "agent-a", "global");

    expect(request).not.toHaveBeenCalled();
  });
});
