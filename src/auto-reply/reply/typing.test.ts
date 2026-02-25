import { afterEach, describe, expect, it, vi } from "vitest";
import { createTypingController } from "./typing.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("createTypingController", () => {
  describe("basic lifecycle", () => {
    it("calls onCleanup when both markRunComplete and markDispatchIdle fire", async () => {
      vi.useFakeTimers();
      const onCleanup = vi.fn();
      const onReplyStart = vi.fn();
      const ctrl = createTypingController({
        onReplyStart,
        onCleanup,
        typingIntervalSeconds: 6,
        typingTtlMs: 120_000,
      });

      await ctrl.startTypingLoop();
      ctrl.markRunComplete();
      ctrl.markDispatchIdle();

      expect(onCleanup).toHaveBeenCalledTimes(1);
      expect(ctrl.isActive()).toBe(false);
    });
  });

  describe("stuck typing indicator fixes", () => {
    it("refreshTypingTtl is a no-op after markRunComplete even while loop is running", async () => {
      // Bug scenario: model run finishes (markRunComplete), dispatch idle hasn't
      // fired yet, but the typing loop is still running. A late streaming callback
      // calls refreshTypingTtl, which resets the soft TTL timer. Because the loop
      // is still running, the TTL callback doesn't short-circuit. The timer keeps
      // getting extended and typing persists indefinitely.
      vi.useFakeTimers();
      const onCleanup = vi.fn();
      const onReplyStart = vi.fn();
      const ctrl = createTypingController({
        onReplyStart,
        onCleanup,
        typingIntervalSeconds: 6,
        typingTtlMs: 10_000, // 10s soft TTL
      });

      await ctrl.startTypingLoop();
      expect(ctrl.isActive()).toBe(true);

      // Advance 8s into the TTL (2s remaining on original timer).
      await vi.advanceTimersByTimeAsync(8_000);

      // Model run finishes but dispatch is NOT idle yet (replies still draining).
      ctrl.markRunComplete();

      // Late callback refreshes TTL — this SHOULD be a no-op.
      // With the bug: timer is reset to 10s from now (fires at t=18s).
      // With the fix: refresh rejected, original timer fires at t=10s.
      ctrl.refreshTypingTtl();

      // Advance 3s (total t=11s) — past original TTL but before bug-extended TTL.
      await vi.advanceTimersByTimeAsync(3_000);

      // The soft TTL should have cleaned up at t=10s because refresh was rejected.
      expect(onCleanup).toHaveBeenCalled();
      expect(ctrl.isActive()).toBe(false);
    });

    it("absolute TTL fires regardless of refresh calls (hard upper bound)", async () => {
      vi.useFakeTimers();
      const onCleanup = vi.fn();
      const onReplyStart = vi.fn();
      const absoluteTtlMs = 5 * 60_000;
      const ctrl = createTypingController({
        onReplyStart,
        onCleanup,
        typingIntervalSeconds: 6,
        typingTtlMs: 120_000,
        absoluteTtlMs,
      });

      await ctrl.startTypingLoop();

      // Simulate repeated refresh calls that defeat the soft TTL.
      for (let i = 0; i < 6; i++) {
        await vi.advanceTimersByTimeAsync(60_000);
        ctrl.refreshTypingTtl();
      }

      // After 6 minutes of refreshing, the absolute TTL (5min) should have fired.
      expect(onCleanup).toHaveBeenCalled();
      expect(ctrl.isActive()).toBe(false);
    });

    it("cleanup is called when markRunComplete fires and no replies were dispatched (NO_REPLY path)", async () => {
      vi.useFakeTimers();
      const onCleanup = vi.fn();
      const onReplyStart = vi.fn();
      const ctrl = createTypingController({
        onReplyStart,
        onCleanup,
        typingIntervalSeconds: 6,
        typingTtlMs: 120_000,
      });

      await ctrl.startTypingLoop();
      expect(ctrl.isActive()).toBe(true);

      ctrl.markRunComplete();
      ctrl.markDispatchIdle();

      expect(onCleanup).toHaveBeenCalledTimes(1);
      expect(ctrl.isActive()).toBe(false);
    });

    it("sealed controller rejects late refreshTypingTtl calls", async () => {
      vi.useFakeTimers();
      const onCleanup = vi.fn();
      const onReplyStart = vi.fn();
      const ctrl = createTypingController({
        onReplyStart,
        onCleanup,
        typingIntervalSeconds: 6,
        typingTtlMs: 120_000,
      });

      await ctrl.startTypingLoop();
      ctrl.markRunComplete();
      ctrl.markDispatchIdle();

      expect(onCleanup).toHaveBeenCalledTimes(1);

      ctrl.refreshTypingTtl();

      await vi.advanceTimersByTimeAsync(300_000);

      expect(onCleanup).toHaveBeenCalledTimes(1);
      expect(ctrl.isActive()).toBe(false);
    });

    it("absolute TTL cannot be extended by any means", async () => {
      vi.useFakeTimers();
      const onCleanup = vi.fn();
      const onReplyStart = vi.fn();
      const absoluteTtlMs = 5 * 60_000;
      const ctrl = createTypingController({
        onReplyStart,
        onCleanup,
        typingIntervalSeconds: 6,
        typingTtlMs: 120_000,
        absoluteTtlMs,
      });

      await ctrl.startTypingLoop();

      // Keep the soft TTL alive with periodic refreshes up to just before absolute TTL.
      const stepMs = 60_000;
      for (let elapsed = 0; elapsed < absoluteTtlMs - 1_000; elapsed += stepMs) {
        const advance = Math.min(stepMs, absoluteTtlMs - 1_000 - elapsed);
        await vi.advanceTimersByTimeAsync(advance);
        ctrl.refreshTypingTtl();
      }
      expect(onCleanup).not.toHaveBeenCalled();

      // Try refreshing — should not extend absolute TTL
      ctrl.refreshTypingTtl();

      // Cross the absolute TTL boundary
      await vi.advanceTimersByTimeAsync(2_000);

      expect(onCleanup).toHaveBeenCalled();
      expect(ctrl.isActive()).toBe(false);
    });
  });
});
