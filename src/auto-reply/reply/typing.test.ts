import { describe, expect, it, vi } from "vitest";
import { createTypingController } from "./typing.js";

describe("createTypingController", () => {
  it("refreshTypingTtl is a no-op after markRunComplete", () => {
    vi.useFakeTimers();
    try {
      const onCleanup = vi.fn();
      const ctrl = createTypingController({
        onReplyStart: vi.fn(),
        onCleanup,
        typingIntervalSeconds: 6,
        typingTtlMs: 2 * 60_000,
      });

      // Start typing
      void ctrl.startTypingLoop();
      expect(ctrl.isActive()).toBe(true);

      // Mark the run as complete — dispatcher not yet idle, so typing still active
      ctrl.markRunComplete();

      // Simulate a late callback calling refreshTypingTtl after run completed.
      // Before the fix, this would reset the TTL timer and keep typing alive.
      ctrl.refreshTypingTtl();

      // Now mark dispatch idle — typing should stop immediately
      ctrl.markDispatchIdle();
      expect(ctrl.isActive()).toBe(false);
      expect(onCleanup).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops typing when both markRunComplete and markDispatchIdle are called", () => {
    vi.useFakeTimers();
    try {
      const onCleanup = vi.fn();
      const ctrl = createTypingController({
        onReplyStart: vi.fn(),
        onCleanup,
        typingIntervalSeconds: 6,
        typingTtlMs: 2 * 60_000,
      });

      void ctrl.startTypingLoop();
      expect(ctrl.isActive()).toBe(true);

      ctrl.markRunComplete();
      // Still active because dispatchIdle is false
      expect(ctrl.isActive()).toBe(true);

      ctrl.markDispatchIdle();
      expect(ctrl.isActive()).toBe(false);
      expect(onCleanup).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
