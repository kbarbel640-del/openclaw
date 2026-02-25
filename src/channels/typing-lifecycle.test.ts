import { describe, expect, it, vi } from "vitest";
import { createTypingKeepaliveLoop } from "./typing-lifecycle.js";

describe("createTypingKeepaliveLoop", () => {
  it("calls onTick with an AbortSignal", async () => {
    const onTick = vi.fn<(signal: AbortSignal) => Promise<void>>().mockResolvedValue(undefined);
    const loop = createTypingKeepaliveLoop({ intervalMs: 100, onTick });

    await loop.tick();

    expect(onTick).toHaveBeenCalledTimes(1);
    const signal = onTick.mock.calls[0][0];
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal.aborted).toBe(false);
  });

  it("prevents concurrent ticks via tickInFlight guard", async () => {
    let resolve: (() => void) | undefined;
    const barrier = new Promise<void>((r) => {
      resolve = r;
    });
    const onTick = vi.fn<(signal: AbortSignal) => Promise<void>>().mockReturnValue(barrier);
    const loop = createTypingKeepaliveLoop({ intervalMs: 100, onTick });

    const first = loop.tick();
    const second = loop.tick();

    // Second tick should be a no-op because first is still in-flight.
    expect(onTick).toHaveBeenCalledTimes(1);

    resolve!();
    await first;
    await second;

    expect(onTick).toHaveBeenCalledTimes(1);
  });

  it("aborts in-flight tick when stop() is called", async () => {
    let capturedSignal: AbortSignal | undefined;
    let resolve: (() => void) | undefined;
    const barrier = new Promise<void>((r) => {
      resolve = r;
    });
    const onTick = vi
      .fn<(signal: AbortSignal) => Promise<void>>()
      .mockImplementation(async (signal: AbortSignal) => {
        capturedSignal = signal;
        await barrier;
      });

    const loop = createTypingKeepaliveLoop({ intervalMs: 100, onTick });
    const tickPromise = loop.tick();

    expect(capturedSignal).toBeDefined();
    expect(capturedSignal!.aborted).toBe(false);

    // Stop should abort the in-flight request.
    loop.stop();
    expect(capturedSignal!.aborted).toBe(true);

    // Resolve the barrier so the tick promise settles.
    resolve!();
    await tickPromise;
  });

  it("swallows AbortError thrown by aborted tick", async () => {
    const onTick = vi
      .fn<(signal: AbortSignal) => Promise<void>>()
      .mockImplementation(async (signal: AbortSignal) => {
        // Simulate an HTTP request that checks the signal and throws AbortError.
        if (signal.aborted) {
          throw new DOMException("The operation was aborted.", "AbortError");
        }
        await new Promise<void>((resolve, reject) => {
          const onAbort = () => {
            signal.removeEventListener("abort", onAbort);
            reject(new DOMException("The operation was aborted.", "AbortError"));
          };
          signal.addEventListener("abort", onAbort);
          // Simulate async work; will be aborted before resolving.
          setTimeout(resolve, 10_000);
        });
      });

    const loop = createTypingKeepaliveLoop({ intervalMs: 100, onTick });
    const tickPromise = loop.tick();

    // Give the tick a moment to start, then stop (abort).
    await Promise.resolve();
    loop.stop();

    // Should not throw — AbortError is swallowed.
    await expect(tickPromise).resolves.toBeUndefined();
  });

  it("re-throws non-abort errors", async () => {
    const onTick = vi
      .fn<(signal: AbortSignal) => Promise<void>>()
      .mockRejectedValue(new Error("network"));
    const loop = createTypingKeepaliveLoop({ intervalMs: 100, onTick });

    await expect(loop.tick()).rejects.toThrow("network");
  });

  it("starts and stops interval correctly", async () => {
    vi.useFakeTimers();
    try {
      const onTick = vi.fn<(signal: AbortSignal) => Promise<void>>().mockResolvedValue(undefined);
      const loop = createTypingKeepaliveLoop({ intervalMs: 1000, onTick });

      expect(loop.isRunning()).toBe(false);

      loop.start();
      expect(loop.isRunning()).toBe(true);

      await vi.advanceTimersByTimeAsync(999);
      expect(onTick).toHaveBeenCalledTimes(0);

      await vi.advanceTimersByTimeAsync(1);
      expect(onTick).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1000);
      expect(onTick).toHaveBeenCalledTimes(2);

      loop.stop();
      expect(loop.isRunning()).toBe(false);

      await vi.advanceTimersByTimeAsync(5000);
      expect(onTick).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not start if intervalMs is zero or negative", () => {
    const onTick = vi.fn<(signal: AbortSignal) => Promise<void>>().mockResolvedValue(undefined);
    const loop = createTypingKeepaliveLoop({ intervalMs: 0, onTick });

    loop.start();
    expect(loop.isRunning()).toBe(false);

    const loop2 = createTypingKeepaliveLoop({ intervalMs: -1, onTick });
    loop2.start();
    expect(loop2.isRunning()).toBe(false);
  });

  it("stop is idempotent", () => {
    const onTick = vi.fn<(signal: AbortSignal) => Promise<void>>().mockResolvedValue(undefined);
    const loop = createTypingKeepaliveLoop({ intervalMs: 100, onTick });

    // Stopping without starting should not throw.
    loop.stop();
    loop.stop();
    expect(loop.isRunning()).toBe(false);
  });
});
