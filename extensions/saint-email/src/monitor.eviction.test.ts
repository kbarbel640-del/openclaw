import { describe, expect, it } from "vitest";

/**
 * Tests the bounded-set eviction logic from Fix #9.
 *
 * The monitor uses a Set<string> with MAX_SEEN = 10_000 and evicts oldest
 * entries when the cap is exceeded. Since the eviction logic is inline in
 * monitorSaintEmailProvider (not separately exported), we replicate the
 * exact eviction algorithm here to verify its correctness.
 */
describe("seen set eviction (Fix #9: bounded seen set)", () => {
  const MAX_SEEN = 100; // Use smaller cap for test performance

  /**
   * Exact replication of the eviction logic from monitor.ts:
   *   while (seen.size > MAX_SEEN) {
   *     seen.delete(seen.values().next().value!);
   *   }
   */
  function evict(seen: Set<string>, maxSeen: number) {
    while (seen.size > maxSeen) {
      seen.delete(seen.values().next().value!);
    }
  }

  it("does not evict when at or under the cap", () => {
    const seen = new Set<string>();
    for (let i = 0; i < MAX_SEEN; i++) {
      seen.add(`msg-${i}`);
    }
    evict(seen, MAX_SEEN);
    expect(seen.size).toBe(MAX_SEEN);
  });

  it("evicts oldest entries when adding one past the cap", () => {
    const seen = new Set<string>();
    for (let i = 0; i < MAX_SEEN + 1; i++) {
      seen.add(`msg-${i}`);
    }
    evict(seen, MAX_SEEN);

    expect(seen.size).toBe(MAX_SEEN);
    // Oldest entry should be evicted
    expect(seen.has("msg-0")).toBe(false);
    // Newest entries should remain
    expect(seen.has(`msg-${MAX_SEEN}`)).toBe(true);
    expect(seen.has("msg-1")).toBe(true);
  });

  it("evicts with per-insert eviction (as used in monitor)", () => {
    const seen = new Set<string>();
    // Simulate the monitor's pattern: add, then evict after each add
    for (let i = 0; i < MAX_SEEN + 10; i++) {
      seen.add(`msg-${i}`);
      evict(seen, MAX_SEEN);
    }

    expect(seen.size).toBe(MAX_SEEN);
    // Oldest entries should have been evicted
    expect(seen.has("msg-0")).toBe(false);
    expect(seen.has("msg-9")).toBe(false);
    // Newest entries should still be present
    expect(seen.has(`msg-${MAX_SEEN + 9}`)).toBe(true);
    expect(seen.has(`msg-${MAX_SEEN}`)).toBe(true);
  });

  it("preserves insertion order (FIFO eviction)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < MAX_SEEN; i++) {
      seen.add(`msg-${i}`);
    }
    // Add one more — should evict msg-0
    seen.add("msg-new");
    evict(seen, MAX_SEEN);

    expect(seen.size).toBe(MAX_SEEN);
    expect(seen.has("msg-0")).toBe(false);
    expect(seen.has("msg-1")).toBe(true);
    expect(seen.has("msg-new")).toBe(true);
  });
});
