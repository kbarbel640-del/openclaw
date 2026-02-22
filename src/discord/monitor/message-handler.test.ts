import { describe, expect, it, vi } from "vitest";
import { createProcessingGate } from "./message-handler.js";

function createDeferred() {
  let resolve: (() => void) | null = null;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return {
    promise,
    resolve: () => {
      if (typeof resolve === "function") {
        (resolve as () => void)();
      }
    },
  };
}

describe("createProcessingGate", () => {
  it("limits concurrent tasks to maxConcurrent", async () => {
    const gate = createProcessingGate({
      maxConcurrent: 2,
      maxQueued: 10,
      timeoutMs: 60_000,
    });

    const d1 = createDeferred();
    const d2 = createDeferred();
    let task3Started = false;

    const p1 = gate.run(() => d1.promise);
    const p2 = gate.run(() => d2.promise);
    const p3 = gate.run(async () => {
      task3Started = true;
    });

    // Let microtasks settle
    await Promise.resolve();

    expect(gate.activeCount).toBe(2);
    expect(gate.queuedCount).toBe(1);
    expect(task3Started).toBe(false);

    // Free one slot — task3 should start and immediately complete
    d1.resolve();
    await p1;
    await p3;

    expect(task3Started).toBe(true);

    d2.resolve();
    await p2;
  });

  it("drops messages when wait queue is full", async () => {
    const onDrop = vi.fn();
    const gate = createProcessingGate({
      maxConcurrent: 1,
      maxQueued: 1,
      timeoutMs: 60_000,
      onDrop,
    });

    const blocker = createDeferred();
    void gate.run(() => blocker.promise); // fills the active slot
    void gate.run(async () => {}); // fills the wait queue

    await Promise.resolve();
    expect(gate.activeCount).toBe(1);
    expect(gate.queuedCount).toBe(1);

    // This should be dropped
    await gate.run(async () => {});
    expect(onDrop).toHaveBeenCalledOnce();

    blocker.resolve();
  });

  it("calls onTimeout and frees slot when task exceeds timeoutMs", async () => {
    vi.useFakeTimers();
    try {
      const onTimeout = vi.fn();
      const gate = createProcessingGate({
        maxConcurrent: 2,
        maxQueued: 10,
        timeoutMs: 1000,
        onTimeout,
      });

      const neverResolve = new Promise<void>(() => {});
      const runPromise = gate.run(() => neverResolve);

      expect(gate.activeCount).toBe(1);

      // Advance past the timeout
      await vi.advanceTimersByTimeAsync(1100);
      await runPromise;

      expect(onTimeout).toHaveBeenCalledOnce();
      // Slot should be freed
      expect(gate.activeCount).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not call onTimeout for fast tasks", async () => {
    const onTimeout = vi.fn();
    const gate = createProcessingGate({
      maxConcurrent: 2,
      maxQueued: 10,
      timeoutMs: 60_000,
      onTimeout,
    });

    await gate.run(async () => {});
    expect(onTimeout).not.toHaveBeenCalled();
    expect(gate.activeCount).toBe(0);
  });

  it("propagates errors from the task function", async () => {
    const gate = createProcessingGate({
      maxConcurrent: 2,
      maxQueued: 10,
      timeoutMs: 60_000,
    });

    await expect(
      gate.run(async () => {
        throw new Error("task error");
      }),
    ).rejects.toThrow("task error");

    // Slot should still be freed after error
    expect(gate.activeCount).toBe(0);
  });

  it("releases queued tasks in FIFO order", async () => {
    const gate = createProcessingGate({
      maxConcurrent: 1,
      maxQueued: 10,
      timeoutMs: 60_000,
    });

    const order: number[] = [];
    const blocker = createDeferred();

    void gate.run(() => blocker.promise);

    const p1 = gate.run(async () => {
      order.push(1);
    });
    const p2 = gate.run(async () => {
      order.push(2);
    });
    const p3 = gate.run(async () => {
      order.push(3);
    });

    blocker.resolve();
    await Promise.all([p1, p2, p3]);

    expect(order).toEqual([1, 2, 3]);
  });
});
