import { beforeEach, describe, expect, it, vi } from "vitest";

const agentSpy = vi.fn(async () => ({ runId: "run-main", status: "ok" }));
const embeddedRunMock = {
  isEmbeddedPiRunActive: vi.fn(() => false),
  isEmbeddedPiRunStreaming: vi.fn(() => false),
  queueEmbeddedPiMessage: vi.fn(() => false),
  waitForEmbeddedPiRunEnd: vi.fn(async () => true),
};
let sessionStore: Record<string, Record<string, unknown>> = {};

vi.mock("../gateway/call.js", () => ({
  callGateway: vi.fn(async (req: unknown) => {
    const typed = req as { method?: string; params?: { message?: string; sessionKey?: string } };
    if (typed.method === "agent") {
      return await agentSpy(typed);
    }
    if (typed.method === "agent.wait") {
      return { status: "ok", startedAt: 10, endedAt: 20 };
    }
    if (typed.method === "sessions.patch") {
      return {};
    }
    if (typed.method === "sessions.delete") {
      return {};
    }
    return {};
  }),
}));

vi.mock("./tools/agent-step.js", () => ({
  readLatestAssistantReply: vi.fn(async () => "subagent output"),
}));

vi.mock("../config/sessions.js", () => ({
  loadSessionStore: vi.fn(() => sessionStore),
  resolveAgentIdFromSessionKey: () => "main",
  resolveStorePath: () => "/tmp/sessions.json",
  resolveMainSessionKey: () => "agent:main:main",
  resolveSessionFilePath: () => "/tmp/session.json",
  readSessionUpdatedAt: vi.fn(() => undefined),
  recordSessionMetaFromInbound: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./pi-embedded.js", () => embeddedRunMock);

vi.mock("../config/config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../config/config.js")>();
  return {
    ...actual,
    loadConfig: () => ({
      session: { mainKey: "main", scope: "per-sender" },
    }),
  };
});

describe("subagent steer semantics", () => {
  beforeEach(() => {
    agentSpy.mockClear();
    embeddedRunMock.isEmbeddedPiRunActive.mockReset().mockReturnValue(false);
    embeddedRunMock.isEmbeddedPiRunStreaming.mockReset().mockReturnValue(false);
    embeddedRunMock.queueEmbeddedPiMessage.mockReset().mockReturnValue(false);
    embeddedRunMock.waitForEmbeddedPiRunEnd.mockReset().mockResolvedValue(true);
    sessionStore = {};
  });

  describe("state-preserving steer on active run", () => {
    it("returns mode=message when guidance is injected into active streaming run", async () => {
      const { runSubagentAnnounceFlow } = await import("./subagent-announce.js");
      embeddedRunMock.isEmbeddedPiRunActive.mockReturnValue(true);
      embeddedRunMock.isEmbeddedPiRunStreaming.mockReturnValue(true);
      embeddedRunMock.queueEmbeddedPiMessage.mockReturnValue(true);
      sessionStore = {
        "agent:main:main": {
          sessionId: "session-active",
          lastChannel: "whatsapp",
          queueMode: "steer",
        },
      };

      const result = await runSubagentAnnounceFlow({
        childSessionKey: "agent:main:subagent:test",
        childRunId: "run-steer-ok",
        requesterSessionKey: "main",
        requesterDisplayKey: "main",
        task: "summarize report",
        timeoutMs: 1000,
        cleanup: "keep",
        waitForCompletion: false,
        startedAt: 10,
        endedAt: 20,
        outcome: { status: "ok" },
      });

      expect(result.announced).toBe(true);
      expect(result.steer).toBeDefined();
      expect(result.steer?.mode).toBe("message");
      expect(result.steer?.reason).toBe("steered_into_active_run");
      expect(agentSpy).not.toHaveBeenCalled();
    });

    it("returns mode=queued when steer enqueues for active non-streaming run", async () => {
      const { runSubagentAnnounceFlow } = await import("./subagent-announce.js");
      embeddedRunMock.isEmbeddedPiRunActive.mockReturnValue(true);
      embeddedRunMock.isEmbeddedPiRunStreaming.mockReturnValue(false);
      embeddedRunMock.queueEmbeddedPiMessage.mockReturnValue(false);
      sessionStore = {
        "agent:main:main": {
          sessionId: "session-queued",
          lastChannel: "whatsapp",
          queueMode: "steer",
        },
      };

      const result = await runSubagentAnnounceFlow({
        childSessionKey: "agent:main:subagent:test",
        childRunId: "run-steer-queued",
        requesterSessionKey: "main",
        requesterDisplayKey: "main",
        task: "summarize report",
        timeoutMs: 1000,
        cleanup: "keep",
        waitForCompletion: false,
        startedAt: 10,
        endedAt: 20,
        outcome: { status: "ok" },
      });

      expect(result.announced).toBe(true);
      expect(result.steer?.mode).toBe("queued");
      expect(result.steer?.reason).toBe("enqueued_for_active_run");
    });
  });

  describe("explicit restart path", () => {
    it("returns mode=restart when no run is active and allowRestart is true", async () => {
      const { runSubagentAnnounceFlow } = await import("./subagent-announce.js");
      embeddedRunMock.isEmbeddedPiRunActive.mockReturnValue(false);
      sessionStore = {
        "agent:main:main": {
          sessionId: "session-idle",
          lastChannel: "whatsapp",
          queueMode: "steer",
        },
      };

      const result = await runSubagentAnnounceFlow({
        childSessionKey: "agent:main:subagent:test",
        childRunId: "run-restart",
        requesterSessionKey: "main",
        requesterDisplayKey: "main",
        task: "summarize report",
        timeoutMs: 1000,
        cleanup: "keep",
        waitForCompletion: false,
        startedAt: 10,
        endedAt: 20,
        outcome: { status: "ok" },
        allowRestart: true,
      });

      expect(result.announced).toBe(true);
      expect(result.steer?.mode).toBe("restart");
      expect(result.steer?.reason).toBe("run_not_active");
      expect(agentSpy).toHaveBeenCalledTimes(1);
    });

    it("defaults to allowing restart (backward compat) when allowRestart is undefined", async () => {
      const { runSubagentAnnounceFlow } = await import("./subagent-announce.js");
      embeddedRunMock.isEmbeddedPiRunActive.mockReturnValue(false);
      sessionStore = {
        "agent:main:main": {
          sessionId: "session-idle",
          lastChannel: "whatsapp",
          queueMode: "steer",
        },
      };

      const result = await runSubagentAnnounceFlow({
        childSessionKey: "agent:main:subagent:test",
        childRunId: "run-compat",
        requesterSessionKey: "main",
        requesterDisplayKey: "main",
        task: "summarize report",
        timeoutMs: 1000,
        cleanup: "keep",
        waitForCompletion: false,
        startedAt: 10,
        endedAt: 20,
        outcome: { status: "ok" },
      });

      expect(result.announced).toBe(true);
      expect(result.steer?.mode).toBe("restart");
      expect(agentSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("failure/guard path when restart not allowed", () => {
    it("returns mode=blocked when run not active and allowRestart is false", async () => {
      const { runSubagentAnnounceFlow } = await import("./subagent-announce.js");
      embeddedRunMock.isEmbeddedPiRunActive.mockReturnValue(false);
      sessionStore = {
        "agent:main:main": {
          sessionId: "session-idle",
          lastChannel: "whatsapp",
          queueMode: "steer",
        },
      };

      const result = await runSubagentAnnounceFlow({
        childSessionKey: "agent:main:subagent:test",
        childRunId: "run-blocked",
        requesterSessionKey: "main",
        requesterDisplayKey: "main",
        task: "summarize report",
        timeoutMs: 1000,
        cleanup: "keep",
        waitForCompletion: false,
        startedAt: 10,
        endedAt: 20,
        outcome: { status: "ok" },
        allowRestart: false,
      });

      expect(result.announced).toBe(false);
      expect(result.steer?.mode).toBe("blocked");
      expect(result.steer?.reason).toBe("run_not_active");
      expect(agentSpy).not.toHaveBeenCalled();
    });

    it("returns mode=blocked when no session id and allowRestart is false", async () => {
      const { runSubagentAnnounceFlow } = await import("./subagent-announce.js");
      sessionStore = {};

      const result = await runSubagentAnnounceFlow({
        childSessionKey: "agent:main:subagent:test",
        childRunId: "run-no-session",
        requesterSessionKey: "main",
        requesterDisplayKey: "main",
        task: "summarize report",
        timeoutMs: 1000,
        cleanup: "keep",
        waitForCompletion: false,
        startedAt: 10,
        endedAt: 20,
        outcome: { status: "ok" },
        allowRestart: false,
      });

      expect(result.announced).toBe(false);
      expect(result.steer?.mode).toBe("blocked");
      expect(result.steer?.reason).toBe("no_session_id");
      expect(agentSpy).not.toHaveBeenCalled();
    });
  });

  describe("steer result shape", () => {
    it("always includes mode and reason in steer result", async () => {
      const { runSubagentAnnounceFlow } = await import("./subagent-announce.js");
      embeddedRunMock.isEmbeddedPiRunActive.mockReturnValue(false);
      sessionStore = {
        "agent:main:main": {
          sessionId: "session-payload",
          lastChannel: "whatsapp",
        },
      };

      const result = await runSubagentAnnounceFlow({
        childSessionKey: "agent:main:subagent:test",
        childRunId: "run-payload-test",
        requesterSessionKey: "main",
        requesterDisplayKey: "main",
        task: "check data",
        timeoutMs: 1000,
        cleanup: "keep",
        waitForCompletion: false,
        startedAt: 10,
        endedAt: 20,
        outcome: { status: "ok" },
      });

      expect(result.steer).toEqual(
        expect.objectContaining({
          mode: expect.stringMatching(/^(message|queued|restart|blocked)$/),
          reason: expect.any(String),
        }),
      );
    });
  });
});
