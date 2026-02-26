import { describe, expect, it, vi } from "vitest";
import { createTypingCallbacks } from "./typing.js";

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("createTypingCallbacks", () => {
  it("invokes start on reply start", async () => {
    const start = vi.fn().mockResolvedValue(undefined);
    const onStartError = vi.fn();
    const callbacks = createTypingCallbacks({ start, onStartError });

    await callbacks.onReplyStart();

    expect(start).toHaveBeenCalledTimes(1);
    expect(onStartError).not.toHaveBeenCalled();
  });

  it("reports start errors", async () => {
    const start = vi.fn().mockRejectedValue(new Error("fail"));
    const onStartError = vi.fn();
    const callbacks = createTypingCallbacks({ start, onStartError });

    await callbacks.onReplyStart();

    expect(onStartError).toHaveBeenCalledTimes(1);
  });

  it("invokes stop on idle and reports stop errors", async () => {
    const start = vi.fn().mockResolvedValue(undefined);
    const stop = vi.fn().mockRejectedValue(new Error("stop"));
    const onStartError = vi.fn();
    const onStopError = vi.fn();
    const callbacks = createTypingCallbacks({ start, stop, onStartError, onStopError });

    callbacks.onIdle?.();
    await flushMicrotasks();

    expect(stop).toHaveBeenCalledTimes(1);
    expect(onStopError).toHaveBeenCalledTimes(1);
  });

  it("sends typing keepalive pings until idle cleanup", async () => {
    vi.useFakeTimers();
    try {
      const start = vi.fn().mockResolvedValue(undefined);
      const stop = vi.fn().mockResolvedValue(undefined);
      const onStartError = vi.fn();
      const callbacks = createTypingCallbacks({ start, stop, onStartError });

      await callbacks.onReplyStart();
      expect(start).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(2_999);
      expect(start).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1);
      expect(start).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(3_000);
      expect(start).toHaveBeenCalledTimes(3);

      callbacks.onIdle?.();
      await flushMicrotasks();
      expect(stop).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(9_000);
      expect(start).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops keepalive after consecutive start failures", async () => {
    vi.useFakeTimers();
    try {
      const start = vi.fn().mockRejectedValue(new Error("gone"));
      const onStartError = vi.fn();
      const callbacks = createTypingCallbacks({ start, onStartError });

      // First call fails but keepalive still starts
      await callbacks.onReplyStart();
      expect(start).toHaveBeenCalledTimes(1);
      expect(onStartError).toHaveBeenCalledTimes(1);

      // Second tick: consecutive failure #2 → circuit breaker trips
      await vi.advanceTimersByTimeAsync(3_000);
      expect(start).toHaveBeenCalledTimes(2);
      expect(onStartError).toHaveBeenCalledTimes(2);

      // No more ticks — loop was stopped
      await vi.advanceTimersByTimeAsync(9_000);
      expect(start).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("resets failure counter on success", async () => {
    vi.useFakeTimers();
    try {
      let callCount = 0;
      // Fail, succeed, fail, succeed — never hits 2 consecutive failures
      const start = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount % 2 === 1) {
          return Promise.reject(new Error("flaky"));
        }
        return Promise.resolve();
      });
      const onStartError = vi.fn();
      const callbacks = createTypingCallbacks({ start, onStartError });

      await callbacks.onReplyStart(); // call 1: fail
      await vi.advanceTimersByTimeAsync(3_000); // call 2: success
      await vi.advanceTimersByTimeAsync(3_000); // call 3: fail
      await vi.advanceTimersByTimeAsync(3_000); // call 4: success

      // Loop still running — never hit 2 consecutive failures
      expect(start).toHaveBeenCalledTimes(4);
      expect(onStartError).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(3_000); // call 5: fail
      expect(start).toHaveBeenCalledTimes(5);
    } finally {
      vi.useRealTimers();
    }
  });

  it("resets failure counter on new reply start", async () => {
    vi.useFakeTimers();
    try {
      const start = vi.fn().mockRejectedValue(new Error("gone"));
      const onStartError = vi.fn();
      const callbacks = createTypingCallbacks({ start, onStartError });

      // Trip the circuit breaker
      await callbacks.onReplyStart();
      await vi.advanceTimersByTimeAsync(3_000);
      expect(start).toHaveBeenCalledTimes(2);

      // Loop stopped
      await vi.advanceTimersByTimeAsync(6_000);
      expect(start).toHaveBeenCalledTimes(2);

      // New reply resets counter, loop restarts
      await callbacks.onReplyStart();
      expect(start).toHaveBeenCalledTimes(3);

      // Keepalive ticks again
      await vi.advanceTimersByTimeAsync(3_000);
      expect(start).toHaveBeenCalledTimes(4);
    } finally {
      vi.useRealTimers();
    }
  });

  it("deduplicates stop across idle and cleanup", async () => {
    const start = vi.fn().mockResolvedValue(undefined);
    const stop = vi.fn().mockResolvedValue(undefined);
    const onStartError = vi.fn();
    const callbacks = createTypingCallbacks({ start, stop, onStartError });

    callbacks.onIdle?.();
    callbacks.onCleanup?.();
    await flushMicrotasks();

    expect(stop).toHaveBeenCalledTimes(1);
  });
});
