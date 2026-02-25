import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createDebounceManager, type DebounceManager } from "../debounce.js";

describe("DebounceManager", () => {
  let manager: DebounceManager;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    manager?.cleanup();
    vi.useRealTimers();
  });

  it("fires callback after debounce period of silence", () => {
    const callback = vi.fn();
    manager = createDebounceManager(1000, callback);

    manager.touch("chat-1");

    // Not yet fired
    expect(callback).not.toHaveBeenCalled();

    // Advance past debounce period
    vi.advanceTimersByTime(1000);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("chat-1");
  });

  it("resets timer on subsequent touches (debounce behavior)", () => {
    const callback = vi.fn();
    manager = createDebounceManager(1000, callback);

    manager.touch("chat-1");

    // Advance 800ms (not yet fired)
    vi.advanceTimersByTime(800);
    expect(callback).not.toHaveBeenCalled();

    // Touch again — resets the timer
    manager.touch("chat-1");

    // Advance 800ms more (1600ms total, but only 800ms since last touch)
    vi.advanceTimersByTime(800);
    expect(callback).not.toHaveBeenCalled();

    // Advance to full debounce from last touch
    vi.advanceTimersByTime(200);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("handles multiple conversations independently", () => {
    const callback = vi.fn();
    manager = createDebounceManager(1000, callback);

    manager.touch("chat-1");
    vi.advanceTimersByTime(500);

    manager.touch("chat-2");
    vi.advanceTimersByTime(500);

    // chat-1 should have fired (1000ms elapsed)
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("chat-1");

    // chat-2 fires after its own 1000ms
    vi.advanceTimersByTime(500);
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenCalledWith("chat-2");
  });

  it("cleanup cancels all pending timers", () => {
    const callback = vi.fn();
    manager = createDebounceManager(1000, callback);

    manager.touch("chat-1");
    manager.touch("chat-2");

    manager.cleanup();

    vi.advanceTimersByTime(2000);
    expect(callback).not.toHaveBeenCalled();
  });

  it("cancel removes a single conversation timer", () => {
    const callback = vi.fn();
    manager = createDebounceManager(1000, callback);

    manager.touch("chat-1");
    manager.touch("chat-2");

    manager.cancel("chat-1");

    vi.advanceTimersByTime(1000);
    // Only chat-2 should fire
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("chat-2");
  });

  it("does not fire for already-cancelled conversation", () => {
    const callback = vi.fn();
    manager = createDebounceManager(1000, callback);

    manager.touch("chat-1");
    manager.cancel("chat-1");

    vi.advanceTimersByTime(2000);
    expect(callback).not.toHaveBeenCalled();
  });

  it("cancel is a no-op for unknown conversation", () => {
    const callback = vi.fn();
    manager = createDebounceManager(1000, callback);

    // Should not throw
    manager.cancel("nonexistent");
  });
});
