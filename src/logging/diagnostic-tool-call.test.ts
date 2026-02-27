import { beforeEach, describe, expect, it } from "vitest";
import {
  onDiagnosticEvent,
  resetDiagnosticEventsForTest,
  type DiagnosticToolCallEvent,
} from "../infra/diagnostic-events.js";
import { resetDiagnosticSessionStateForTest } from "./diagnostic-session-state.js";
import { logToolCall, logToolCallCompleted } from "./diagnostic.js";

describe("logToolCall diagnostic events", () => {
  beforeEach(() => {
    resetDiagnosticSessionStateForTest();
    resetDiagnosticEventsForTest();
  });

  it("emits tool.call event with tool name and parameters", async () => {
    const emitted: DiagnosticToolCallEvent[] = [];
    const stop = onDiagnosticEvent((evt) => {
      if (evt.type === "tool.call") {
        emitted.push(evt);
      }
    });

    logToolCall({
      sessionKey: "test-session",
      sessionId: "sess-123",
      toolName: "read",
      toolCallId: "call-1",
      params: { path: "/tmp/file.txt", limit: 100 },
    });

    stop();

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      type: "tool.call",
      sessionKey: "test-session",
      sessionId: "sess-123",
      toolName: "read",
      toolCallId: "call-1",
      params: { path: "/tmp/file.txt", limit: 100 },
    });
  });

  it("emits tool.call event without params when not provided", async () => {
    const emitted: DiagnosticToolCallEvent[] = [];
    const stop = onDiagnosticEvent((evt) => {
      if (evt.type === "tool.call") {
        emitted.push(evt);
      }
    });

    logToolCall({
      sessionKey: "test-session",
      toolName: "browser",
      toolCallId: "call-2",
    });

    stop();

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      type: "tool.call",
      toolName: "browser",
      toolCallId: "call-2",
    });
    expect(emitted[0]?.params).toBeUndefined();
  });

  it("emits tool.call.completed event with duration and outcome", async () => {
    const emitted: DiagnosticToolCallEvent[] = [];
    const stop = onDiagnosticEvent((evt) => {
      if (evt.type === "tool.call") {
        emitted.push(evt);
      }
    });

    logToolCallCompleted({
      sessionKey: "test-session",
      sessionId: "sess-123",
      toolName: "exec",
      toolCallId: "call-3",
      durationMs: 150,
      outcome: "success",
    });

    stop();

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      type: "tool.call",
      toolName: "exec",
      toolCallId: "call-3",
      durationMs: 150,
      outcome: "success",
    });
  });

  it("emits tool.call.completed event with error details", async () => {
    const emitted: DiagnosticToolCallEvent[] = [];
    const stop = onDiagnosticEvent((evt) => {
      if (evt.type === "tool.call") {
        emitted.push(evt);
      }
    });

    logToolCallCompleted({
      sessionKey: "test-session",
      toolName: "write",
      toolCallId: "call-4",
      durationMs: 50,
      outcome: "error",
      error: "Permission denied",
    });

    stop();

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      type: "tool.call",
      toolName: "write",
      toolCallId: "call-4",
      durationMs: 50,
      outcome: "error",
      error: "Permission denied",
    });
  });

  it("truncates large params to prevent excessive memory usage", async () => {
    const emitted: DiagnosticToolCallEvent[] = [];
    const stop = onDiagnosticEvent((evt) => {
      if (evt.type === "tool.call") {
        emitted.push(evt);
      }
    });

    const largeContent = "x".repeat(10000);
    logToolCall({
      sessionKey: "test-session",
      toolName: "write",
      toolCallId: "call-5",
      params: { content: largeContent },
    });

    stop();

    expect(emitted).toHaveLength(1);
    // Params should be stringified and truncated if too large
    const paramsStr = JSON.stringify(emitted[0]?.params);
    expect(paramsStr.length).toBeLessThanOrEqual(2048);
  });
});
