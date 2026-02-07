import { describe, expect, it } from "vitest";
import {
  normalizeToolResult,
  normalizeSessionBoundary,
  normalizeBootstrap,
  normalizeManualCapture,
  extractConfig,
} from "./normalizer.js";

function toolResultEvent(ctx: Record<string, unknown> = {}) {
  return {
    type: "agent",
    action: "tool:result",
    timestamp: new Date(),
    sessionKey: "hook-session",
    context: {
      toolName: "bash",
      toolCallId: "tc-1",
      sessionId: "sid-1",
      sessionKey: "sk-1",
      runId: "run-1",
      meta: "some-meta",
      isError: false,
      args: { cmd: "ls" },
      result: { output: "file.txt" },
      ...ctx,
    },
  };
}

describe("event normalizer", () => {
  // ── normalizeToolResult ───────────────────────────────────────────────
  describe("normalizeToolResult", () => {
    it("normalizes a valid tool:result event", () => {
      const event = toolResultEvent();
      const result = normalizeToolResult(event);

      expect(result).not.toBeNull();
      expect(result!.kind).toBe("tool_result");
      expect(result!.tool?.name).toBe("bash");
      expect(result!.tool?.callId).toBe("tc-1");
      expect(result!.tool?.isError).toBe(false);
      expect(result!.tool?.meta).toBe("some-meta");
      expect(result!.session?.id).toBe("sid-1");
      expect(result!.session?.key).toBe("sk-1");
      expect(result!.session?.runId).toBe("run-1");
      expect(result!.provenance.source).toBe("hook");
      expect(result!.id).toBeTruthy();
      expect(result!.ts).toBeTruthy();
    });

    it("returns null for non-agent events", () => {
      const event = { type: "command", action: "tool:result", timestamp: new Date() };
      expect(normalizeToolResult(event)).toBeNull();
    });

    it("returns null for non-tool:result actions", () => {
      const event = { type: "agent", action: "bootstrap", timestamp: new Date() };
      expect(normalizeToolResult(event)).toBeNull();
    });

    it("returns null when toolName is missing", () => {
      const event = toolResultEvent({ toolName: undefined });
      expect(normalizeToolResult(event)).toBeNull();
    });

    it("returns null when toolCallId is missing", () => {
      const event = toolResultEvent({ toolCallId: undefined });
      expect(normalizeToolResult(event)).toBeNull();
    });

    it("returns null when context is null", () => {
      const event = { type: "agent", action: "tool:result", timestamp: new Date(), context: null };
      expect(normalizeToolResult(event)).toBeNull();
    });

    it("extracts isError correctly", () => {
      const event = toolResultEvent({ isError: true });
      const result = normalizeToolResult(event);
      expect(result!.tool?.isError).toBe(true);
    });

    it("falls back to event.sessionKey when context lacks it", () => {
      const event = toolResultEvent({ sessionKey: undefined });
      const result = normalizeToolResult(event);
      expect(result!.session?.key).toBe("hook-session");
    });

    it("includes args and result in payload", () => {
      const event = toolResultEvent();
      const result = normalizeToolResult(event);
      const payload = result!.payload as { args: unknown; result: unknown };
      expect(payload.args).toEqual({ cmd: "ls" });
      expect(payload.result).toEqual({ output: "file.txt" });
    });

    it("ignores whitespace-only strings", () => {
      const event = toolResultEvent({ toolName: "  ", toolCallId: "  " });
      expect(normalizeToolResult(event)).toBeNull();
    });
  });

  // ── normalizeSessionBoundary ──────────────────────────────────────────
  describe("normalizeSessionBoundary", () => {
    it("normalizes a command:new event", () => {
      const event = {
        type: "command",
        action: "new",
        timestamp: new Date(),
        context: { sessionId: "s1", sessionKey: "k1", runId: "r1" },
      };
      const result = normalizeSessionBoundary(event);
      expect(result).not.toBeNull();
      expect(result!.kind).toBe("session_boundary");
      expect(result!.session?.id).toBe("s1");
    });

    it("normalizes a command:stop event", () => {
      const event = {
        type: "command",
        action: "stop",
        timestamp: new Date(),
        context: { sessionKey: "k1" },
      };
      const result = normalizeSessionBoundary(event);
      expect(result).not.toBeNull();
      expect(result!.kind).toBe("session_boundary");
    });

    it("returns null for non-command type", () => {
      const event = { type: "agent", action: "new", timestamp: new Date() };
      expect(normalizeSessionBoundary(event)).toBeNull();
    });

    it("returns null for non-new/stop action", () => {
      const event = { type: "command", action: "run", timestamp: new Date() };
      expect(normalizeSessionBoundary(event)).toBeNull();
    });
  });

  // ── normalizeBootstrap ────────────────────────────────────────────────
  describe("normalizeBootstrap", () => {
    it("normalizes a bootstrap event", () => {
      const event = {
        type: "agent",
        action: "bootstrap",
        timestamp: new Date(),
        sessionKey: "sk-boot",
        context: { sessionKey: "ctx-key", bootstrapFiles: [], cfg: { key: "val" } },
      };
      const result = normalizeBootstrap(event);
      expect(result).not.toBeNull();
      expect(result!.kind).toBe("session_boundary");
      expect(result!.session?.key).toBe("ctx-key");
    });

    it("falls back to event.sessionKey when context lacks it", () => {
      const event = {
        type: "agent",
        action: "bootstrap",
        timestamp: new Date(),
        sessionKey: "fallback-key",
        context: {},
      };
      const result = normalizeBootstrap(event);
      expect(result!.session?.key).toBe("fallback-key");
    });

    it("returns null for non-bootstrap action", () => {
      const event = { type: "agent", action: "tool:result", timestamp: new Date() };
      expect(normalizeBootstrap(event)).toBeNull();
    });
  });

  // ── normalizeManualCapture ────────────────────────────────────────────
  describe("normalizeManualCapture", () => {
    it("creates a manual capture event", () => {
      const result = normalizeManualCapture({
        topic: "breakthrough",
        reason: "solved the bug",
        significance: 0.9,
        sessionKey: "s1",
        tags: ["debugging"],
      });
      expect(result.kind).toBe("manual_capture");
      expect(result.tool?.name).toBe("experience_capture");
      expect(result.provenance.source).toBe("tool");
      expect(result.session?.key).toBe("s1");
      expect(result.id).toBeTruthy();
    });

    it("uses custom tool name", () => {
      const result = normalizeManualCapture({ topic: "test", toolName: "custom_tool" });
      expect(result.tool?.name).toBe("custom_tool");
    });

    it("defaults tool name to experience_capture", () => {
      const result = normalizeManualCapture({ topic: "test" });
      expect(result.tool?.name).toBe("experience_capture");
    });
  });

  // ── extractConfig ─────────────────────────────────────────────────────
  describe("extractConfig", () => {
    it("extracts cfg from context", () => {
      const event = {
        type: "agent",
        action: "tool:result",
        timestamp: new Date(),
        context: { cfg: { hooks: {} } },
      };
      expect(extractConfig(event)).toEqual({ hooks: {} });
    });

    it("returns undefined for null context", () => {
      const event = { type: "agent", action: "tool:result", timestamp: new Date(), context: null };
      expect(extractConfig(event)).toBeUndefined();
    });

    it("returns undefined when cfg is absent", () => {
      const event = { type: "agent", action: "tool:result", timestamp: new Date(), context: {} };
      expect(extractConfig(event)).toBeUndefined();
    });
  });
});
