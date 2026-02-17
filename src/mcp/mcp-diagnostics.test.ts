import { afterEach, describe, expect, it, vi } from "vitest";
import {
  emitDiagnosticEvent,
  onDiagnosticEvent,
  resetDiagnosticEventsForTest,
} from "../infra/diagnostic-events.js";
import type {
  DiagnosticMcpToolCallEvent,
  DiagnosticMcpToolResultEvent,
} from "../infra/diagnostic-events.js";

describe("MCP diagnostic events", () => {
  afterEach(() => {
    resetDiagnosticEventsForTest();
  });

  it("emits mcp.tool.call events", () => {
    const events: unknown[] = [];
    onDiagnosticEvent((evt) => events.push(evt));

    emitDiagnosticEvent({
      type: "mcp.tool.call",
      serverName: "test-server",
      toolName: "do_thing",
    });

    expect(events).toHaveLength(1);
    const evt = events[0] as DiagnosticMcpToolCallEvent;
    expect(evt.type).toBe("mcp.tool.call");
    expect(evt.serverName).toBe("test-server");
    expect(evt.toolName).toBe("do_thing");
    expect(evt.seq).toBe(1);
    expect(typeof evt.ts).toBe("number");
  });

  it("emits mcp.tool.result events with duration", () => {
    const events: unknown[] = [];
    onDiagnosticEvent((evt) => events.push(evt));

    emitDiagnosticEvent({
      type: "mcp.tool.result",
      serverName: "test-server",
      toolName: "do_thing",
      durationMs: 150,
      isError: false,
    });

    expect(events).toHaveLength(1);
    const evt = events[0] as DiagnosticMcpToolResultEvent;
    expect(evt.type).toBe("mcp.tool.result");
    expect(evt.durationMs).toBe(150);
    expect(evt.isError).toBe(false);
  });

  it("emits mcp.tool.result events with error info", () => {
    const events: unknown[] = [];
    onDiagnosticEvent((evt) => events.push(evt));

    emitDiagnosticEvent({
      type: "mcp.tool.result",
      serverName: "test-server",
      toolName: "do_thing",
      durationMs: 50,
      isError: true,
      error: "connection timeout",
    });

    const evt = events[0] as DiagnosticMcpToolResultEvent;
    expect(evt.isError).toBe(true);
    expect(evt.error).toBe("connection timeout");
  });

  it("includes optional session fields", () => {
    const events: unknown[] = [];
    onDiagnosticEvent((evt) => events.push(evt));

    emitDiagnosticEvent({
      type: "mcp.tool.call",
      serverName: "srv",
      toolName: "tool",
      sessionKey: "session-1",
      sessionId: "sid-abc",
    });

    const evt = events[0] as DiagnosticMcpToolCallEvent;
    expect(evt.sessionKey).toBe("session-1");
    expect(evt.sessionId).toBe("sid-abc");
  });
});
