import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  initProgressState,
  getProgressState,
  cleanupProgressState,
  queueProgressUpdate,
  flushProgressDigest,
  buildBriefSummary,
  buildCompletionMessage,
  resetProgressStatesForTests,
} from "./subagent-progress-stream.js";

// Mock the external dependencies
vi.mock("../discord/send.outbound.js", () => ({
  sendMessageDiscord: vi
    .fn()
    .mockResolvedValue({ messageId: "mock-msg-123", channelId: "mock-ch" }),
}));

vi.mock("../discord/send.messages.js", () => ({
  createThreadDiscord: vi.fn().mockResolvedValue({ id: "mock-thread-123" }),
}));

vi.mock("../slack/send.js", () => ({
  sendMessageSlack: vi.fn().mockResolvedValue({ messageId: "mock-ts", channelId: "mock-ch" }),
  createSlackThread: vi
    .fn()
    .mockResolvedValue({ threadTs: "mock-thread-ts", channelId: "mock-ch" }),
}));

vi.mock("../runtime.js", () => ({
  defaultRuntime: {
    error: vi.fn(),
  },
}));

describe("subagent-progress-stream", () => {
  beforeEach(() => {
    resetProgressStatesForTests();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    resetProgressStatesForTests();
    vi.useRealTimers();
  });

  describe("initProgressState", () => {
    it("creates new state for a run", () => {
      const state = initProgressState({
        runId: "run-1",
        label: "test task",
        origin: { channel: "discord", to: "user-123" },
      });

      expect(state.runId).toBe("run-1");
      expect(state.label).toBe("test task");
      expect(state.channel).toBe("discord");
      expect(state.supportsThreads).toBe(true);
      expect(state.pendingTools).toHaveLength(0);
    });

    it("returns existing state if already initialized", () => {
      const state1 = initProgressState({
        runId: "run-1",
        label: "test task",
      });
      state1.pendingTools.push({ name: "tool1", phase: "start", timestamp: Date.now() });

      const state2 = initProgressState({
        runId: "run-1",
        label: "different label",
      });

      expect(state2).toBe(state1);
      expect(state2.pendingTools).toHaveLength(1);
    });

    it("identifies threaded vs non-threaded channels", () => {
      const discordState = initProgressState({
        runId: "run-discord",
        label: "test",
        origin: { channel: "discord" },
      });
      expect(discordState.supportsThreads).toBe(true);

      const slackState = initProgressState({
        runId: "run-slack",
        label: "test",
        origin: { channel: "slack" },
      });
      expect(slackState.supportsThreads).toBe(true);

      const smsState = initProgressState({
        runId: "run-sms",
        label: "test",
        origin: { channel: "sms" },
      });
      expect(smsState.supportsThreads).toBe(false);

      const noChannelState = initProgressState({
        runId: "run-none",
        label: "test",
      });
      expect(noChannelState.supportsThreads).toBe(false);
    });
  });

  describe("getProgressState", () => {
    it("returns undefined for unknown runId", () => {
      expect(getProgressState("unknown")).toBeUndefined();
    });

    it("returns state after initialization", () => {
      initProgressState({ runId: "run-1", label: "test" });
      const state = getProgressState("run-1");
      expect(state).toBeDefined();
      expect(state?.runId).toBe("run-1");
    });
  });

  describe("cleanupProgressState", () => {
    it("removes state for a run", () => {
      initProgressState({ runId: "run-1", label: "test" });
      expect(getProgressState("run-1")).toBeDefined();

      cleanupProgressState("run-1");
      expect(getProgressState("run-1")).toBeUndefined();
    });

    it("clears pending timers", () => {
      initProgressState({ runId: "run-1", label: "test" });
      queueProgressUpdate("run-1", "read", "start");

      const state = getProgressState("run-1");
      expect(state?.flushTimer).toBeDefined();

      cleanupProgressState("run-1");
      // Timer should be cleared (no error when advancing time)
      vi.advanceTimersByTime(10000);
    });
  });

  describe("queueProgressUpdate", () => {
    it("adds tool to pending list", () => {
      initProgressState({ runId: "run-1", label: "test" });
      queueProgressUpdate("run-1", "read", "start");

      const state = getProgressState("run-1");
      expect(state?.pendingTools).toHaveLength(1);
      expect(state?.pendingTools[0]?.name).toBe("read");
      expect(state?.pendingTools[0]?.phase).toBe("start");
    });

    it("does nothing for unknown runId", () => {
      queueProgressUpdate("unknown", "read", "start");
      // Should not throw
    });

    it("schedules debounced flush", () => {
      initProgressState({ runId: "run-1", label: "test" });
      queueProgressUpdate("run-1", "read", "start");

      const state = getProgressState("run-1");
      expect(state?.flushTimer).toBeDefined();
    });

    it("flushes immediately when max tools reached", async () => {
      initProgressState({
        runId: "run-1",
        label: "test",
        origin: { channel: "discord", to: "user-1" },
      });

      // Queue 5 tools (max)
      for (let i = 0; i < 5; i++) {
        queueProgressUpdate("run-1", `tool${i}`, "start");
      }

      // Should have flushed immediately
      await vi.runAllTimersAsync();
      const state = getProgressState("run-1");
      expect(state?.pendingTools).toHaveLength(0);
    });
  });

  describe("flushProgressDigest", () => {
    it("does nothing if no pending tools", async () => {
      initProgressState({ runId: "run-1", label: "test" });
      await flushProgressDigest("run-1");
      // Should not throw
    });

    it("clears pending tools after flush", async () => {
      initProgressState({
        runId: "run-1",
        label: "test",
        origin: { channel: "discord", to: "user-1" },
      });
      queueProgressUpdate("run-1", "read", "start");
      queueProgressUpdate("run-1", "write", "result");

      const state = getProgressState("run-1");
      expect(state?.pendingTools).toHaveLength(2);

      await flushProgressDigest("run-1");
      expect(state?.pendingTools).toHaveLength(0);
    });

    it("updates lastFlushAt", async () => {
      initProgressState({
        runId: "run-1",
        label: "test",
        origin: { channel: "discord", to: "user-1" },
      });
      queueProgressUpdate("run-1", "read", "start");

      const state = getProgressState("run-1");
      expect(state?.lastFlushAt).toBe(0);

      await flushProgressDigest("run-1");
      expect(state?.lastFlushAt).toBeGreaterThan(0);
    });
  });

  describe("buildBriefSummary", () => {
    it("returns (no output) for empty/undefined input", () => {
      expect(buildBriefSummary(undefined)).toBe("(no output)");
      expect(buildBriefSummary("")).toBe("(no output)");
      expect(buildBriefSummary("   ")).toBe("(no output)");
    });

    it("returns full text if under limit", () => {
      const shortText = "This is a short summary.";
      expect(buildBriefSummary(shortText, 300)).toBe(shortText);
    });

    it("truncates at sentence boundary when possible", () => {
      const text =
        "First sentence here. Second sentence that makes it longer. Third sentence to push over the limit and force truncation.";
      const result = buildBriefSummary(text, 60);
      expect(result).toMatch(/\.\.\.$/);
      expect(result.length).toBeLessThanOrEqual(65); // Some margin for "..."
    });

    it("truncates at word boundary if no sentence break", () => {
      const text = "This is a very long text without any periods that goes on and on and on";
      const result = buildBriefSummary(text, 30);
      expect(result).toMatch(/\.\.\.$/);
      expect(result).not.toMatch(/\s\.\.\.$/); // Should not have trailing space before ...
    });
  });

  describe("buildCompletionMessage", () => {
    it("builds completed message", () => {
      const msg = buildCompletionMessage({
        label: "research task",
        briefSummary: "Found 3 relevant files.",
        hasProgressThread: false,
        statusLabel: "completed successfully",
      });
      expect(msg).toContain("research task");
      expect(msg).toContain("completed");
      expect(msg).toContain("Found 3 relevant files.");
    });

    it("includes thread reference when progress thread exists", () => {
      const msg = buildCompletionMessage({
        label: "research task",
        briefSummary: "Found 3 relevant files.",
        hasProgressThread: true,
        statusLabel: "completed successfully",
      });
      expect(msg).toContain("progress thread");
    });

    it("handles timeout status", () => {
      const msg = buildCompletionMessage({
        label: "research task",
        briefSummary: "Partial results.",
        hasProgressThread: false,
        statusLabel: "timed out",
      });
      expect(msg).toContain("timed out");
    });

    it("handles failed status", () => {
      const msg = buildCompletionMessage({
        label: "research task",
        briefSummary: "Error occurred.",
        hasProgressThread: false,
        statusLabel: "failed: connection error",
      });
      expect(msg).toContain("failed");
      expect(msg).toContain("connection error");
    });
  });

  describe("parallel subagents", () => {
    it("maintains separate state per runId", () => {
      initProgressState({ runId: "run-1", label: "task 1" });
      initProgressState({ runId: "run-2", label: "task 2" });
      initProgressState({ runId: "run-3", label: "task 3" });

      queueProgressUpdate("run-1", "read", "start");
      queueProgressUpdate("run-2", "write", "start");
      queueProgressUpdate("run-3", "exec", "start");

      const state1 = getProgressState("run-1");
      const state2 = getProgressState("run-2");
      const state3 = getProgressState("run-3");

      expect(state1?.pendingTools[0]?.name).toBe("read");
      expect(state2?.pendingTools[0]?.name).toBe("write");
      expect(state3?.pendingTools[0]?.name).toBe("exec");
    });

    it("cleans up individual runs without affecting others", () => {
      initProgressState({ runId: "run-1", label: "task 1" });
      initProgressState({ runId: "run-2", label: "task 2" });

      cleanupProgressState("run-1");

      expect(getProgressState("run-1")).toBeUndefined();
      expect(getProgressState("run-2")).toBeDefined();
    });
  });

  describe("edge cases", () => {
    it("handles fast subagent (<3s) gracefully", async () => {
      initProgressState({
        runId: "run-1",
        label: "fast task",
        origin: { channel: "discord", to: "user-1" },
      });
      queueProgressUpdate("run-1", "read", "start");

      // Immediately complete before debounce fires
      await flushProgressDigest("run-1");
      cleanupProgressState("run-1");

      // Should not throw when timers advance
      await vi.advanceTimersByTimeAsync(5000);
    });

    it("handles multiple flushes", async () => {
      initProgressState({
        runId: "run-1",
        label: "test",
        origin: { channel: "discord", to: "user-1" },
      });

      queueProgressUpdate("run-1", "read", "start");
      await flushProgressDigest("run-1");

      queueProgressUpdate("run-1", "write", "start");
      await flushProgressDigest("run-1");

      const state = getProgressState("run-1");
      expect(state?.pendingTools).toHaveLength(0);
    });
  });
});
