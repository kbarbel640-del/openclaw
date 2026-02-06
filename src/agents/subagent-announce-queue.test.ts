import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runtimeMock = { error: vi.fn() };
vi.mock("../runtime.js", () => ({
  defaultRuntime: runtimeMock,
}));

vi.mock("../utils/delivery-context.js", () => ({
  normalizeDeliveryContext: (v: unknown) => v,
  deliveryContextKey: () => "test-key",
}));

describe("subagent announce queue drain", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    runtimeMock.error.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("processes all items when send completes within deadline", async () => {
    const { enqueueAnnounce } = await import("./subagent-announce-queue.js");

    const sent: string[] = [];
    const send = vi.fn(async (item: { prompt: string }) => {
      sent.push(item.prompt);
    });

    enqueueAnnounce({
      key: "test-fast",
      item: { prompt: "msg-1", enqueuedAt: Date.now(), sessionKey: "s1" },
      settings: { mode: "followup", debounceMs: 0 },
      send,
    });
    enqueueAnnounce({
      key: "test-fast",
      item: { prompt: "msg-2", enqueuedAt: Date.now(), sessionKey: "s1" },
      settings: { mode: "followup", debounceMs: 0 },
      send,
    });
    enqueueAnnounce({
      key: "test-fast",
      item: { prompt: "msg-3", enqueuedAt: Date.now(), sessionKey: "s1" },
      settings: { mode: "followup", debounceMs: 0 },
      send,
    });

    // Let microtasks settle — send resolves instantly so all items drain.
    await vi.advanceTimersByTimeAsync(100);

    expect(sent).toEqual(["msg-1", "msg-2", "msg-3"]);
    expect(runtimeMock.error).not.toHaveBeenCalled();
  });

  it("stops draining and logs when deadline is exceeded", async () => {
    const { enqueueAnnounce } = await import("./subagent-announce-queue.js");

    const send = vi.fn(async () => {
      // Each send takes 50s via a timer-based delay.
      await new Promise<void>((resolve) => setTimeout(resolve, 50_000));
    });

    for (let i = 0; i < 5; i++) {
      enqueueAnnounce({
        key: "test-slow",
        item: { prompt: `slow-${i}`, enqueuedAt: Date.now(), sessionKey: "s1" },
        settings: { mode: "followup", debounceMs: 0 },
        send,
      });
    }

    // Advance in 25s steps (two steps per 50s send) totaling 150s, exceeding the 120s deadline.
    for (let step = 0; step < 6; step++) {
      await vi.advanceTimersByTimeAsync(25_000);
    }

    // Deadline is 120s, each send takes 50s. The check is at loop top:
    // send#1 starts at 0s, send#2 at 50s, send#3 at 100s (<120s so it starts).
    // After send#3 completes at 150s, loop exits (150s > 120s). 2 remaining items discarded.
    expect(send).toHaveBeenCalledTimes(3);

    // Should have logged a timeout warning.
    expect(runtimeMock.error).toHaveBeenCalledWith(
      expect.stringContaining("announce queue drain timed out for test-slow"),
    );
  });
});
