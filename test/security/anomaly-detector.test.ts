import { describe, it, expect, beforeEach } from "vitest";
import { AnomalyDetector, type AnomalyEvent } from "../../src/security/anomaly-detector.js";

describe("EO-002: Anomaly Detector", () => {
  let detector: AnomalyDetector;

  beforeEach(() => {
    detector = new AnomalyDetector({ toolCallsPerMinute: 5, spawnsPerHour: 3, messageRatePerMinute: 10 });
  });

  it("allows normal tool call rate", () => {
    const event: AnomalyEvent = {
      timestamp: Date.now(),
      category: "tool_call",
      sessionId: "session-1",
      detail: "bash",
    };
    const alerts = detector.record(event);
    expect(alerts.length).toBe(0);
  });

  it("triggers alert on excessive tool calls", () => {
    const sessionId = "session-2";
    let alerts: ReturnType<AnomalyDetector["record"]> = [];
    for (let i = 0; i < 6; i++) {
      alerts = detector.record({
        timestamp: Date.now(),
        category: "tool_call",
        sessionId,
        detail: "bash",
      });
    }
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0].severity).toBeDefined();
  });

  it("triggers alert on excessive spawns", () => {
    const sessionId = "session-3";
    let alerts: ReturnType<AnomalyDetector["record"]> = [];
    for (let i = 0; i < 4; i++) {
      alerts = detector.record({
        timestamp: Date.now(),
        category: "spawn",
        sessionId,
        detail: "agent-spawn",
      });
    }
    expect(alerts.length).toBeGreaterThan(0);
  });

  it("resets counters for session", () => {
    const sessionId = "session-4";
    detector.record({ timestamp: Date.now(), category: "tool_call", sessionId, detail: "bash" });
    detector.reset(sessionId);
    const stats = detector.getStats(sessionId);
    expect(stats.toolCallsLastMinute).toBe(0);
  });
});