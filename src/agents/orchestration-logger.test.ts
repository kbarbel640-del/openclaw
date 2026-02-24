import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  emitOrchestrationEvent,
  onOrchestrationEvent,
  registerOrchestrationContext,
  getOrchestrationContext,
  clearOrchestrationContext,
  resetOrchestrationLoggerForTest,
  logHandoff,
  logDelegation,
  logContextShare,
  logIntentRoute,
  type OrchestrationEventPayload,
} from "./orchestration-logger.js";

describe("orchestration-logger", () => {
  beforeEach(() => {
    resetOrchestrationLoggerForTest();
  });

  describe("emitOrchestrationEvent", () => {
    it("should emit event with monotonic sequence numbers", () => {
      const events: OrchestrationEventPayload[] = [];
      onOrchestrationEvent((evt) => events.push(evt));

      emitOrchestrationEvent({
        runId: "run-1",
        type: "handoff",
        fromAgent: "agent-a",
        toAgent: "agent-b",
        data: {},
      });

      emitOrchestrationEvent({
        runId: "run-1",
        type: "delegate",
        fromAgent: "agent-a",
        toAgent: "agent-c",
        data: {},
      });

      expect(events).toHaveLength(2);
      expect(events[0]?.seq).toBe(1);
      expect(events[1]?.seq).toBe(2);
    });

    it("should maintain separate sequence counters per runId", () => {
      const events: OrchestrationEventPayload[] = [];
      onOrchestrationEvent((evt) => events.push(evt));

      emitOrchestrationEvent({
        runId: "run-1",
        type: "handoff",
        fromAgent: "agent-a",
        data: {},
      });

      emitOrchestrationEvent({
        runId: "run-2",
        type: "handoff",
        fromAgent: "agent-b",
        data: {},
      });

      emitOrchestrationEvent({
        runId: "run-1",
        type: "delegate",
        fromAgent: "agent-a",
        data: {},
      });

      expect(events).toHaveLength(3);
      expect(events[0]?.runId).toBe("run-1");
      expect(events[0]?.seq).toBe(1);
      expect(events[1]?.runId).toBe("run-2");
      expect(events[1]?.seq).toBe(1);
      expect(events[2]?.runId).toBe("run-1");
      expect(events[2]?.seq).toBe(2);
    });

    it("should add timestamp to events", () => {
      const events: OrchestrationEventPayload[] = [];
      onOrchestrationEvent((evt) => events.push(evt));

      const before = Date.now();
      emitOrchestrationEvent({
        runId: "run-1",
        type: "handoff",
        fromAgent: "agent-a",
        data: {},
      });
      const after = Date.now();

      expect(events).toHaveLength(1);
      expect(events[0]?.ts).toBeGreaterThanOrEqual(before);
      expect(events[0]?.ts).toBeLessThanOrEqual(after);
    });

    it("should enrich events with registered context sessionKey", () => {
      const events: OrchestrationEventPayload[] = [];
      onOrchestrationEvent((evt) => events.push(evt));

      registerOrchestrationContext("run-1", {
        sessionKey: "session-123",
        userId: "user-456",
      });

      emitOrchestrationEvent({
        runId: "run-1",
        type: "handoff",
        fromAgent: "agent-a",
        data: {},
      });

      expect(events).toHaveLength(1);
      expect(events[0]?.sessionKey).toBe("session-123");
    });

    it("should prefer explicit sessionKey over context sessionKey", () => {
      const events: OrchestrationEventPayload[] = [];
      onOrchestrationEvent((evt) => events.push(evt));

      registerOrchestrationContext("run-1", {
        sessionKey: "session-default",
      });

      emitOrchestrationEvent({
        runId: "run-1",
        type: "handoff",
        fromAgent: "agent-a",
        sessionKey: "session-explicit",
        data: {},
      });

      expect(events).toHaveLength(1);
      expect(events[0]?.sessionKey).toBe("session-explicit");
    });

    it("should ignore empty string sessionKey in event", () => {
      const events: OrchestrationEventPayload[] = [];
      onOrchestrationEvent((evt) => events.push(evt));

      registerOrchestrationContext("run-1", {
        sessionKey: "session-default",
      });

      emitOrchestrationEvent({
        runId: "run-1",
        type: "handoff",
        fromAgent: "agent-a",
        sessionKey: "  ",
        data: {},
      });

      expect(events).toHaveLength(1);
      expect(events[0]?.sessionKey).toBe("session-default");
    });

    it("should continue emitting when listener throws", () => {
      const events: OrchestrationEventPayload[] = [];
      const errorListener = vi.fn(() => {
        throw new Error("listener error");
      });
      const successListener = vi.fn((evt) => events.push(evt));

      onOrchestrationEvent(errorListener);
      onOrchestrationEvent(successListener);

      emitOrchestrationEvent({
        runId: "run-1",
        type: "handoff",
        fromAgent: "agent-a",
        data: {},
      });

      expect(errorListener).toHaveBeenCalledTimes(1);
      expect(successListener).toHaveBeenCalledTimes(1);
      expect(events).toHaveLength(1);
    });
  });

  describe("onOrchestrationEvent", () => {
    it("should register listener and receive events", () => {
      const events: OrchestrationEventPayload[] = [];
      onOrchestrationEvent((evt) => events.push(evt));

      emitOrchestrationEvent({
        runId: "run-1",
        type: "handoff",
        fromAgent: "agent-a",
        data: {},
      });

      expect(events).toHaveLength(1);
      expect(events[0]?.type).toBe("handoff");
    });

    it("should return unsubscribe function", () => {
      const events: OrchestrationEventPayload[] = [];
      const unsubscribe = onOrchestrationEvent((evt) => events.push(evt));

      emitOrchestrationEvent({
        runId: "run-1",
        type: "handoff",
        fromAgent: "agent-a",
        data: {},
      });

      expect(events).toHaveLength(1);

      unsubscribe();

      emitOrchestrationEvent({
        runId: "run-1",
        type: "delegate",
        fromAgent: "agent-a",
        data: {},
      });

      expect(events).toHaveLength(1);
    });

    it("should support multiple listeners", () => {
      const events1: OrchestrationEventPayload[] = [];
      const events2: OrchestrationEventPayload[] = [];

      onOrchestrationEvent((evt) => events1.push(evt));
      onOrchestrationEvent((evt) => events2.push(evt));

      emitOrchestrationEvent({
        runId: "run-1",
        type: "handoff",
        fromAgent: "agent-a",
        data: {},
      });

      expect(events1).toHaveLength(1);
      expect(events2).toHaveLength(1);
    });
  });

  describe("registerOrchestrationContext", () => {
    it("should register new context", () => {
      registerOrchestrationContext("run-1", {
        sessionKey: "session-123",
        userId: "user-456",
        channelId: "channel-789",
      });

      const context = getOrchestrationContext("run-1");
      expect(context).toEqual({
        sessionKey: "session-123",
        userId: "user-456",
        channelId: "channel-789",
      });
    });

    it("should merge updates to existing context", () => {
      registerOrchestrationContext("run-1", {
        sessionKey: "session-123",
        userId: "user-456",
      });

      registerOrchestrationContext("run-1", {
        channelId: "channel-789",
      });

      const context = getOrchestrationContext("run-1");
      expect(context).toEqual({
        sessionKey: "session-123",
        userId: "user-456",
        channelId: "channel-789",
      });
    });

    it("should update individual fields in existing context", () => {
      registerOrchestrationContext("run-1", {
        sessionKey: "session-old",
        userId: "user-456",
      });

      registerOrchestrationContext("run-1", {
        sessionKey: "session-new",
      });

      const context = getOrchestrationContext("run-1");
      expect(context?.sessionKey).toBe("session-new");
      expect(context?.userId).toBe("user-456");
    });

    it("should do nothing when runId is empty", () => {
      registerOrchestrationContext("", {
        sessionKey: "session-123",
      });

      const context = getOrchestrationContext("");
      expect(context).toBeUndefined();
    });
  });

  describe("getOrchestrationContext", () => {
    it("should return undefined for unknown runId", () => {
      const context = getOrchestrationContext("unknown");
      expect(context).toBeUndefined();
    });

    it("should return registered context", () => {
      registerOrchestrationContext("run-1", {
        sessionKey: "session-123",
      });

      const context = getOrchestrationContext("run-1");
      expect(context).toEqual({
        sessionKey: "session-123",
      });
    });
  });

  describe("clearOrchestrationContext", () => {
    it("should clear context for runId", () => {
      registerOrchestrationContext("run-1", {
        sessionKey: "session-123",
      });

      clearOrchestrationContext("run-1");

      const context = getOrchestrationContext("run-1");
      expect(context).toBeUndefined();
    });

    it("should reset sequence counter for runId", () => {
      const events: OrchestrationEventPayload[] = [];
      onOrchestrationEvent((evt) => events.push(evt));

      emitOrchestrationEvent({
        runId: "run-1",
        type: "handoff",
        fromAgent: "agent-a",
        data: {},
      });

      expect(events[0]?.seq).toBe(1);

      clearOrchestrationContext("run-1");

      emitOrchestrationEvent({
        runId: "run-1",
        type: "handoff",
        fromAgent: "agent-a",
        data: {},
      });

      expect(events[1]?.seq).toBe(1);
    });
  });

  describe("logHandoff", () => {
    it("should emit handoff event with required fields", () => {
      const events: OrchestrationEventPayload[] = [];
      onOrchestrationEvent((evt) => events.push(evt));

      logHandoff({
        runId: "run-1",
        fromAgent: "agent-a",
        toAgent: "agent-b",
      });

      expect(events).toHaveLength(1);
      expect(events[0]?.type).toBe("handoff");
      expect(events[0]?.fromAgent).toBe("agent-a");
      expect(events[0]?.toAgent).toBe("agent-b");
      expect(events[0]?.data.contextTransferred).toBe(false);
    });

    it("should include optional fields when provided", () => {
      const events: OrchestrationEventPayload[] = [];
      onOrchestrationEvent((evt) => events.push(evt));

      logHandoff({
        runId: "run-1",
        fromAgent: "agent-a",
        toAgent: "agent-b",
        reason: "user request",
        contextTransferred: true,
        sessionKey: "session-123",
      });

      expect(events).toHaveLength(1);
      expect(events[0]?.data.reason).toBe("user request");
      expect(events[0]?.data.contextTransferred).toBe(true);
      expect(events[0]?.sessionKey).toBe("session-123");
    });
  });

  describe("logDelegation", () => {
    it("should emit delegate event with required fields", () => {
      const events: OrchestrationEventPayload[] = [];
      onOrchestrationEvent((evt) => events.push(evt));

      logDelegation({
        runId: "run-1",
        fromAgent: "supervisor",
        toAgent: "agent-coding",
      });

      expect(events).toHaveLength(1);
      expect(events[0]?.type).toBe("delegate");
      expect(events[0]?.fromAgent).toBe("supervisor");
      expect(events[0]?.toAgent).toBe("agent-coding");
    });

    it("should include intent and confidence when provided", () => {
      const events: OrchestrationEventPayload[] = [];
      onOrchestrationEvent((evt) => events.push(evt));

      logDelegation({
        runId: "run-1",
        fromAgent: "supervisor",
        toAgent: "agent-coding",
        intent: "coding",
        confidence: 0.95,
        sessionKey: "session-123",
      });

      expect(events).toHaveLength(1);
      expect(events[0]?.data.intent).toBe("coding");
      expect(events[0]?.data.confidence).toBe(0.95);
      expect(events[0]?.sessionKey).toBe("session-123");
    });
  });

  describe("logContextShare", () => {
    it("should emit context_share event", () => {
      const events: OrchestrationEventPayload[] = [];
      onOrchestrationEvent((evt) => events.push(evt));

      logContextShare({
        runId: "run-1",
        fromAgent: "agent-a",
        toAgent: "agent-b",
        scope: "session",
        key: "user-preference",
      });

      expect(events).toHaveLength(1);
      expect(events[0]?.type).toBe("context_share");
      expect(events[0]?.fromAgent).toBe("agent-a");
      expect(events[0]?.toAgent).toBe("agent-b");
      expect(events[0]?.data.scope).toBe("session");
      expect(events[0]?.data.key).toBe("user-preference");
    });

    it("should support global scope", () => {
      const events: OrchestrationEventPayload[] = [];
      onOrchestrationEvent((evt) => events.push(evt));

      logContextShare({
        runId: "run-1",
        fromAgent: "agent-a",
        toAgent: "agent-b",
        scope: "global",
        key: "api-token",
        sessionKey: "session-123",
      });

      expect(events).toHaveLength(1);
      expect(events[0]?.data.scope).toBe("global");
      expect(events[0]?.sessionKey).toBe("session-123");
    });
  });

  describe("logIntentRoute", () => {
    it("should emit intent_route event", () => {
      const events: OrchestrationEventPayload[] = [];
      onOrchestrationEvent((evt) => events.push(evt));

      logIntentRoute({
        runId: "run-1",
        fromAgent: "supervisor",
        toAgent: "agent-coding",
        intent: "coding",
        confidence: 0.95,
      });

      expect(events).toHaveLength(1);
      expect(events[0]?.type).toBe("intent_route");
      expect(events[0]?.fromAgent).toBe("supervisor");
      expect(events[0]?.toAgent).toBe("agent-coding");
      expect(events[0]?.data.intent).toBe("coding");
      expect(events[0]?.data.confidence).toBe(0.95);
    });

    it("should include sessionKey when provided", () => {
      const events: OrchestrationEventPayload[] = [];
      onOrchestrationEvent((evt) => events.push(evt));

      logIntentRoute({
        runId: "run-1",
        fromAgent: "supervisor",
        toAgent: "agent-research",
        intent: "research",
        confidence: 0.88,
        sessionKey: "session-456",
      });

      expect(events).toHaveLength(1);
      expect(events[0]?.sessionKey).toBe("session-456");
    });
  });

  describe("resetOrchestrationLoggerForTest", () => {
    it("should clear all state", () => {
      const events: OrchestrationEventPayload[] = [];
      onOrchestrationEvent((evt) => events.push(evt));

      registerOrchestrationContext("run-1", {
        sessionKey: "session-123",
      });

      emitOrchestrationEvent({
        runId: "run-1",
        type: "handoff",
        fromAgent: "agent-a",
        data: {},
      });

      expect(events).toHaveLength(1);

      resetOrchestrationLoggerForTest();

      emitOrchestrationEvent({
        runId: "run-1",
        type: "handoff",
        fromAgent: "agent-a",
        data: {},
      });

      // No new events because listeners were cleared
      expect(events).toHaveLength(1);

      // Context was cleared
      const context = getOrchestrationContext("run-1");
      expect(context).toBeUndefined();
    });
  });
});
