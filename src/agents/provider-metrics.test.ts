import { describe, it, expect, beforeEach } from "vitest";
import {
  createProviderMetrics,
  createNoopProviderMetrics,
  getProviderMetrics,
  resetGlobalProviderMetrics,
  setProviderMetrics,
} from "./provider-metrics.js";

describe("ProviderMetrics", () => {
  beforeEach(() => {
    resetGlobalProviderMetrics();
  });

  it("should track request.started", () => {
    const metrics = createProviderMetrics();
    metrics.emit("request.started", 1, { provider: "openai", model: "gpt-4o" });

    const snapshot = metrics.getSnapshot();
    expect(snapshot.providers.openai.models["gpt-4o"].requests.started).toBe(1);
    expect(snapshot.global.requests.started).toBe(1);
  });

  it("should track request.success and calculate success rate", () => {
    const metrics = createProviderMetrics();
    metrics.emit("request.started", 1, { provider: "openai", model: "gpt-4o" });
    metrics.emit("request.success", 1, { provider: "openai", model: "gpt-4o" });

    const snapshot = metrics.getSnapshot();
    expect(snapshot.providers.openai.models["gpt-4o"].requests.success).toBe(1);
    expect(snapshot.providers.openai.models["gpt-4o"].requests.successRate).toBe(1);
  });

  it("should track request.error and error types", () => {
    const metrics = createProviderMetrics();
    metrics.emit("request.started", 1, { provider: "openai", model: "gpt-4o" });
    metrics.emit("request.error", 1, {
      provider: "openai",
      model: "gpt-4o",
      error_type: "RateLimitError",
    });

    const snapshot = metrics.getSnapshot();
    expect(snapshot.providers.openai.models["gpt-4o"].requests.error).toBe(1);
    expect(snapshot.providers.openai.models["gpt-4o"].errors.RateLimitError).toBe(1);
    expect(snapshot.providers.openai.models["gpt-4o"].requests.errorRate).toBe(1);
  });

  it("should track latency and calculate percentiles", () => {
    const metrics = createProviderMetrics();
    const samples = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];

    for (const latency of samples) {
      metrics.emit("request.latency", latency, { provider: "openai", model: "gpt-4o" });
    }

    const snapshot = metrics.getSnapshot();
    const latency = snapshot.providers.openai.models["gpt-4o"].latency;

    expect(latency.count).toBe(10);
    expect(latency.p50).toBeGreaterThanOrEqual(400);
    expect(latency.p50).toBeLessThanOrEqual(600);
    expect(latency.p95).toBeGreaterThanOrEqual(900);
    expect(latency.p99).toBeGreaterThanOrEqual(900);
  });

  it("should track tokens", () => {
    const metrics = createProviderMetrics();
    metrics.emit("tokens.input", 100, { provider: "openai", model: "gpt-4o" });
    metrics.emit("tokens.output", 50, { provider: "openai", model: "gpt-4o" });

    const snapshot = metrics.getSnapshot();
    expect(snapshot.providers.openai.models["gpt-4o"].tokens.input).toBe(100);
    expect(snapshot.providers.openai.models["gpt-4o"].tokens.output).toBe(50);
    expect(snapshot.providers.openai.models["gpt-4o"].tokens.total).toBe(150);
  });

  it("should track cost", () => {
    const metrics = createProviderMetrics();
    metrics.emit("cost.estimated", 0.05, { provider: "openai", model: "gpt-4o" });

    const snapshot = metrics.getSnapshot();
    expect(snapshot.providers.openai.models["gpt-4o"].cost.estimated).toBe(0.05);
  });

  it("should track fallbacks", () => {
    const metrics = createProviderMetrics();
    metrics.emit("fallback.triggered", 1, {
      provider: "openai",
      model: "gpt-4o",
      fallback_to: "google/gemini-2.0-flash-exp",
    });

    const snapshot = metrics.getSnapshot();
    expect(snapshot.providers.openai.models["gpt-4o"].fallbacks.triggered).toBe(1);
    expect(
      snapshot.providers.openai.models["gpt-4o"].fallbacks.targets["google/gemini-2.0-flash-exp"],
    ).toBe(1);
  });

  it("should track rate limits", () => {
    const metrics = createProviderMetrics();
    metrics.emit("rate_limit.hit", 1, { provider: "openai", model: "gpt-4o" });

    const snapshot = metrics.getSnapshot();
    expect(snapshot.providers.openai.models["gpt-4o"].rateLimits).toBe(1);
  });

  it("should aggregate provider totals", () => {
    const metrics = createProviderMetrics();

    metrics.emit("request.started", 1, { provider: "openai", model: "gpt-4o" });
    metrics.emit("request.success", 1, { provider: "openai", model: "gpt-4o" });
    metrics.emit("tokens.input", 100, { provider: "openai", model: "gpt-4o" });

    metrics.emit("request.started", 1, { provider: "openai", model: "gpt-4o-mini" });
    metrics.emit("request.success", 1, { provider: "openai", model: "gpt-4o-mini" });
    metrics.emit("tokens.input", 50, { provider: "openai", model: "gpt-4o-mini" });

    const snapshot = metrics.getSnapshot();
    expect(snapshot.providers.openai.totals.requests.started).toBe(2);
    expect(snapshot.providers.openai.totals.tokens.input).toBe(150);
  });

  it("should aggregate global totals across providers", () => {
    const metrics = createProviderMetrics();

    metrics.emit("request.started", 1, { provider: "openai", model: "gpt-4o" });
    metrics.emit("request.success", 1, { provider: "openai", model: "gpt-4o" });

    metrics.emit("request.started", 1, { provider: "anthropic", model: "claude-sonnet-4-5" });
    metrics.emit("request.success", 1, { provider: "anthropic", model: "claude-sonnet-4-5" });

    const snapshot = metrics.getSnapshot();
    expect(snapshot.global.requests.started).toBe(2);
    expect(snapshot.global.requests.success).toBe(2);
    expect(snapshot.global.activeProviders).toBe(2);
    expect(snapshot.global.activeModels).toBe(2);
  });

  it("should reset all metrics", () => {
    const metrics = createProviderMetrics();
    metrics.emit("request.started", 1, { provider: "openai", model: "gpt-4o" });

    metrics.reset();

    const snapshot = metrics.getSnapshot();
    expect(snapshot.global.requests.started).toBe(0);
    expect(snapshot.providers).toEqual({});
  });

  it("should reset specific provider", () => {
    const metrics = createProviderMetrics();
    metrics.emit("request.started", 1, { provider: "openai", model: "gpt-4o" });
    metrics.emit("request.started", 1, { provider: "anthropic", model: "claude-sonnet-4-5" });

    metrics.resetProvider("openai");

    const snapshot = metrics.getSnapshot();
    expect(snapshot.providers.openai).toBeUndefined();
    expect(snapshot.providers.anthropic).toBeDefined();
  });

  it("should reset specific model", () => {
    const metrics = createProviderMetrics();
    metrics.emit("request.started", 1, { provider: "openai", model: "gpt-4o" });
    metrics.emit("request.started", 1, { provider: "openai", model: "gpt-4o-mini" });

    metrics.resetProvider("openai", "gpt-4o");

    const snapshot = metrics.getSnapshot();
    expect(snapshot.providers.openai.models["gpt-4o"]).toBeUndefined();
    expect(snapshot.providers.openai.models["gpt-4o-mini"]).toBeDefined();
  });

  it("should handle noop metrics", () => {
    const metrics = createNoopProviderMetrics();
    metrics.emit("request.started", 1, { provider: "openai", model: "gpt-4o" });

    const snapshot = metrics.getSnapshot();
    expect(snapshot.global.requests.started).toBe(0);
  });

  it("should manage global singleton", () => {
    const metrics1 = getProviderMetrics();
    const metrics2 = getProviderMetrics();

    expect(metrics1).toBe(metrics2); // Same instance

    metrics1.emit("request.started", 1, { provider: "openai", model: "gpt-4o" });

    const snapshot = metrics2.getSnapshot();
    expect(snapshot.global.requests.started).toBe(1);
  });

  it("should allow setting custom global metrics", () => {
    const custom = createProviderMetrics();
    setProviderMetrics(custom);

    const instance = getProviderMetrics();
    expect(instance).toBe(custom);
  });

  it("should track lastRequestAt timestamp", () => {
    const metrics = createProviderMetrics();
    const before = Date.now();

    metrics.emit("request.started", 1, { provider: "openai", model: "gpt-4o" });

    const after = Date.now();
    const snapshot = metrics.getSnapshot();
    const lastRequest = snapshot.providers.openai.models["gpt-4o"].lastRequestAt;

    expect(lastRequest).toBeGreaterThanOrEqual(before);
    expect(lastRequest).toBeLessThanOrEqual(after);
  });

  it("should call onMetric callback when provided", () => {
    let callbackInvoked = false;
    let receivedEvent: unknown = null;

    const metrics = createProviderMetrics((event) => {
      callbackInvoked = true;
      receivedEvent = event;
    });

    metrics.emit("request.started", 1, { provider: "openai", model: "gpt-4o" });

    expect(callbackInvoked).toBe(true);
    const evt = receivedEvent as {
      name: string;
      value: number;
      labels: { provider: string; model: string };
    };
    expect(evt.name).toBe("request.started");
    expect(evt.value).toBe(1);
    expect(evt.labels.provider).toBe("openai");
    expect(evt.labels.model).toBe("gpt-4o");
  });

  it("should calculate success rate correctly with mixed success/error", () => {
    const metrics = createProviderMetrics();

    // 8 success, 2 error
    for (let i = 0; i < 8; i++) {
      metrics.emit("request.started", 1, { provider: "openai", model: "gpt-4o" });
      metrics.emit("request.success", 1, { provider: "openai", model: "gpt-4o" });
    }
    for (let i = 0; i < 2; i++) {
      metrics.emit("request.started", 1, { provider: "openai", model: "gpt-4o" });
      metrics.emit("request.error", 1, { provider: "openai", model: "gpt-4o" });
    }

    const snapshot = metrics.getSnapshot();
    expect(snapshot.providers.openai.models["gpt-4o"].requests.successRate).toBe(0.8);
    expect(snapshot.providers.openai.models["gpt-4o"].requests.errorRate).toBe(0.2);
  });
});
