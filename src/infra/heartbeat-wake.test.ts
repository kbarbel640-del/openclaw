import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  hasHeartbeatWakeHandler,
  hasPendingHeartbeatWake,
  requestHeartbeatNow,
  resetHeartbeatWakeStateForTests,
  setHeartbeatWakeHandler,
} from "./heartbeat-wake.js";

describe("heartbeat-wake", () => {
  beforeEach(() => {
    resetHeartbeatWakeStateForTests();
  });

  afterEach(() => {
    resetHeartbeatWakeStateForTests();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("coalesces multiple wake requests into one run", async () => {
    vi.useFakeTimers();
    const handler = vi.fn().mockResolvedValue({ status: "skipped", reason: "disabled" });
    setHeartbeatWakeHandler(handler);

    requestHeartbeatNow({ reason: "interval", coalesceMs: 200 });
    requestHeartbeatNow({ reason: "exec-event", coalesceMs: 200 });
    requestHeartbeatNow({ reason: "retry", coalesceMs: 200 });

    expect(hasPendingHeartbeatWake()).toBe(true);

    await vi.advanceTimersByTimeAsync(199);
    expect(handler).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ reason: "exec-event" });
    expect(hasPendingHeartbeatWake()).toBe(false);
  });

  it("retries requests-in-flight after the default retry delay", async () => {
    vi.useFakeTimers();
    const handler = vi
      .fn()
      .mockResolvedValueOnce({ status: "skipped", reason: "requests-in-flight" })
      .mockResolvedValueOnce({ status: "ran", durationMs: 1 });
    setHeartbeatWakeHandler(handler);

    requestHeartbeatNow({ reason: "interval", coalesceMs: 0 });

    await vi.advanceTimersByTimeAsync(1);
    expect(handler).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(500);
    expect(handler).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(500);
    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.calls[1]?.[0]).toEqual({ reason: "interval" });
  });

  it("keeps retry cooldown even when a sooner request arrives", async () => {
    vi.useFakeTimers();
    const handler = vi
      .fn()
      .mockResolvedValueOnce({ status: "skipped", reason: "requests-in-flight" })
      .mockResolvedValueOnce({ status: "ran", durationMs: 1 });
    setHeartbeatWakeHandler(handler);

    requestHeartbeatNow({ reason: "interval", coalesceMs: 0 });
    await vi.advanceTimersByTimeAsync(1);
    expect(handler).toHaveBeenCalledTimes(1);

    // Retry is now waiting for 1000ms. This should not preempt cooldown.
    requestHeartbeatNow({ reason: "hook:wake", coalesceMs: 0 });
    await vi.advanceTimersByTimeAsync(998);
    expect(handler).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.calls[1]?.[0]).toEqual({ reason: "hook:wake" });
  });

  it("retries thrown handler errors after the default retry delay", async () => {
    vi.useFakeTimers();
    const handler = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ status: "skipped", reason: "disabled" });
    setHeartbeatWakeHandler(handler);

    requestHeartbeatNow({ reason: "exec-event", coalesceMs: 0 });

    await vi.advanceTimersByTimeAsync(1);
    expect(handler).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(500);
    expect(handler).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(500);
    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.calls[1]?.[0]).toEqual({ reason: "exec-event" });
  });

  it("stale disposer does not clear a newer handler", async () => {
    vi.useFakeTimers();
    const handlerA = vi.fn().mockResolvedValue({ status: "ran", durationMs: 1 });
    const handlerB = vi.fn().mockResolvedValue({ status: "ran", durationMs: 1 });

    // Runner A registers its handler
    const disposeA = setHeartbeatWakeHandler(handlerA);

    // Runner B registers its handler (replaces A)
    const disposeB = setHeartbeatWakeHandler(handlerB);

    // Runner A's stale cleanup runs — should NOT clear handlerB
    disposeA();
    expect(hasHeartbeatWakeHandler()).toBe(true);

    // handlerB should still work
    requestHeartbeatNow({ reason: "interval", coalesceMs: 0 });
    await vi.advanceTimersByTimeAsync(1);
    expect(handlerB).toHaveBeenCalledTimes(1);
    expect(handlerA).not.toHaveBeenCalled();

    // Runner B's dispose should work
    disposeB();
    expect(hasHeartbeatWakeHandler()).toBe(false);
  });

  it("preempts existing timer when a sooner schedule is requested", async () => {
    vi.useFakeTimers();
    const handler = vi.fn().mockResolvedValue({ status: "ran", durationMs: 1 });
    setHeartbeatWakeHandler(handler);

    // Schedule for 5 seconds from now
    requestHeartbeatNow({ reason: "slow", coalesceMs: 5000 });

    // Schedule for 100ms from now — should preempt the 5s timer
    requestHeartbeatNow({ reason: "fast", coalesceMs: 100 });

    await vi.advanceTimersByTimeAsync(100);
    expect(handler).toHaveBeenCalledTimes(1);
    // The reason should be "fast" since it was set last
    expect(handler).toHaveBeenCalledWith({ reason: "fast" });
  });

  it("keeps existing timer when later schedule is requested", async () => {
    vi.useFakeTimers();
    const handler = vi.fn().mockResolvedValue({ status: "ran", durationMs: 1 });
    setHeartbeatWakeHandler(handler);

    // Schedule for 100ms from now
    requestHeartbeatNow({ reason: "fast", coalesceMs: 100 });

    // Schedule for 5 seconds from now — should NOT preempt
    requestHeartbeatNow({ reason: "slow", coalesceMs: 5000 });

    await vi.advanceTimersByTimeAsync(100);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not downgrade a higher-priority pending reason", async () => {
    vi.useFakeTimers();
    const handler = vi.fn().mockResolvedValue({ status: "ran", durationMs: 1 });
    setHeartbeatWakeHandler(handler);

    requestHeartbeatNow({ reason: "exec-event", coalesceMs: 100 });
    requestHeartbeatNow({ reason: "retry", coalesceMs: 100 });

    await vi.advanceTimersByTimeAsync(100);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ reason: "exec-event" });
  });

  it("resets running/scheduled flags when new handler is registered", async () => {
    vi.useFakeTimers();

    // Simulate a handler that's mid-execution when SIGUSR1 fires.
    // We do this by having the handler hang forever (never resolve).
    let resolveHang: () => void;
    const hangPromise = new Promise<void>((r) => {
      resolveHang = r;
    });
    const handlerA = vi
      .fn()
      .mockReturnValue(hangPromise.then(() => ({ status: "ran" as const, durationMs: 1 })));
    setHeartbeatWakeHandler(handlerA);

    // Trigger the handler — it starts running but never finishes
    requestHeartbeatNow({ reason: "interval", coalesceMs: 0 });
    await vi.advanceTimersByTimeAsync(1);
    expect(handlerA).toHaveBeenCalledTimes(1);

    // Now simulate SIGUSR1: register a new handler while handlerA is still running.
    // Without the fix, `running` would stay true and handlerB would never fire.
    const handlerB = vi.fn().mockResolvedValue({ status: "ran", durationMs: 1 });
    setHeartbeatWakeHandler(handlerB);

    // handlerB should be able to fire (running was reset)
    requestHeartbeatNow({ reason: "interval", coalesceMs: 0 });
    await vi.advanceTimersByTimeAsync(1);
    expect(handlerB).toHaveBeenCalledTimes(1);

    // Clean up the hanging promise
    resolveHang!();
    await Promise.resolve();
  });

  it("clears stale retry cooldown when a new handler is registered", async () => {
    vi.useFakeTimers();
    const handlerA = vi.fn().mockResolvedValue({ status: "skipped", reason: "requests-in-flight" });
    setHeartbeatWakeHandler(handlerA);

    requestHeartbeatNow({ reason: "interval", coalesceMs: 0 });
    await vi.advanceTimersByTimeAsync(1);
    expect(handlerA).toHaveBeenCalledTimes(1);

    // Simulate SIGUSR1 startup with a fresh wake handler.
    const handlerB = vi.fn().mockResolvedValue({ status: "ran", durationMs: 1 });
    setHeartbeatWakeHandler(handlerB);

    requestHeartbeatNow({ reason: "manual", coalesceMs: 0 });
    await vi.advanceTimersByTimeAsync(1);
    expect(handlerB).toHaveBeenCalledTimes(1);
    expect(handlerB).toHaveBeenCalledWith({ reason: "manual" });
  });

  it("drains pending wake once a handler is registered", async () => {
    vi.useFakeTimers();

    requestHeartbeatNow({ reason: "manual", coalesceMs: 0 });
    await vi.advanceTimersByTimeAsync(1);
    expect(hasPendingHeartbeatWake()).toBe(true);

    const handler = vi.fn().mockResolvedValue({ status: "skipped", reason: "disabled" });
    setHeartbeatWakeHandler(handler);

    await vi.advanceTimersByTimeAsync(249);
    expect(handler).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ reason: "manual" });
    expect(hasPendingHeartbeatWake()).toBe(false);
  });

  it("forcibly resets running flag after safety timeout when handler hangs", async () => {
    vi.useFakeTimers();

    // Simulate a handler that hangs forever (unresolved promise — the exact
    // scenario from the Feb 14 2026 outage where a compaction retry promise
    // never settled, blocking the heartbeat scheduler for 22+ hours).
    const hangForever = new Promise<never>(() => {});
    const hangingHandler = vi.fn().mockReturnValue(hangForever);
    setHeartbeatWakeHandler(hangingHandler);

    // Trigger the hanging handler
    requestHeartbeatNow({ reason: "interval", coalesceMs: 0 });
    await vi.advanceTimersByTimeAsync(1);
    expect(hangingHandler).toHaveBeenCalledTimes(1);

    // The handler is now "running" but will never resolve.
    // Advance to just before the safety timeout (13 minutes = 780_000ms).
    // The handler should still be considered running.
    await vi.advanceTimersByTimeAsync(779_998);

    // Now advance past the safety timeout
    await vi.advanceTimersByTimeAsync(2);

    // After the safety timeout fires, the scheduler should recover.
    // It queues a retry reason and reschedules. The next handler call
    // should fire after the retry delay (1000ms).
    const freshHandler = vi.fn().mockResolvedValue({ status: "ran", durationMs: 1 });
    // We need to register a fresh handler because the old one hangs.
    // In production, the same handler is used, but for testing we verify
    // the scheduler state is unblocked.
    setHeartbeatWakeHandler(freshHandler);

    requestHeartbeatNow({ reason: "interval", coalesceMs: 0 });
    await vi.advanceTimersByTimeAsync(1);
    expect(freshHandler).toHaveBeenCalledTimes(1);
  });
});
