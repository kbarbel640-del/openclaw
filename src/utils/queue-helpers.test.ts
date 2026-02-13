import { describe, expect, it } from "vitest";
import {
  elideQueueText,
  buildQueueSummaryLine,
  shouldSkipQueueItem,
  applyQueueDropPolicy,
  type QueueState,
} from "./queue-helpers.js";

// ---------------------------------------------------------------------------
// elideQueueText
// ---------------------------------------------------------------------------

describe("elideQueueText", () => {
  it("returns short text unchanged", () => {
    expect(elideQueueText("hello", 10)).toBe("hello");
  });

  it("returns text at exact limit unchanged", () => {
    expect(elideQueueText("12345", 5)).toBe("12345");
  });

  it("truncates with ellipsis when over limit", () => {
    const result = elideQueueText("hello world", 8);
    expect(result).toHaveLength(8);
    expect(result.endsWith("…")).toBe(true);
  });

  it("uses default limit of 140", () => {
    const short = "a".repeat(140);
    expect(elideQueueText(short)).toBe(short);
    const long = "a".repeat(141);
    expect(elideQueueText(long).endsWith("…")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildQueueSummaryLine
// ---------------------------------------------------------------------------

describe("buildQueueSummaryLine", () => {
  it("collapses whitespace", () => {
    expect(buildQueueSummaryLine("hello   world\n\nnewline")).toBe("hello world newline");
  });

  it("trims", () => {
    expect(buildQueueSummaryLine("  padded  ")).toBe("padded");
  });

  it("truncates long text", () => {
    const long = "a ".repeat(200);
    const result = buildQueueSummaryLine(long, 20);
    expect(result.length).toBeLessThanOrEqual(20);
    expect(result.endsWith("…")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// shouldSkipQueueItem
// ---------------------------------------------------------------------------

describe("shouldSkipQueueItem", () => {
  it("returns false without dedupe function", () => {
    expect(shouldSkipQueueItem({ item: "a", items: ["a"] })).toBe(false);
  });

  it("delegates to dedupe function", () => {
    const dedupe = (item: string, items: string[]) => items.includes(item);
    expect(shouldSkipQueueItem({ item: "a", items: ["a", "b"], dedupe })).toBe(true);
    expect(shouldSkipQueueItem({ item: "c", items: ["a", "b"], dedupe })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// applyQueueDropPolicy
// ---------------------------------------------------------------------------

describe("applyQueueDropPolicy", () => {
  function makeQueue(
    items: string[],
    cap: number,
    dropPolicy: "summarize" | "old" | "new",
  ): QueueState<string> {
    return {
      items: [...items],
      cap,
      dropPolicy,
      droppedCount: 0,
      summaryLines: [],
    };
  }

  it("returns true when under cap", () => {
    const queue = makeQueue(["a", "b"], 5, "old");
    expect(applyQueueDropPolicy({ queue, summarize: (x) => x })).toBe(true);
    expect(queue.items).toEqual(["a", "b"]);
  });

  it("returns false for 'new' policy when at cap", () => {
    const queue = makeQueue(["a", "b", "c"], 3, "new");
    expect(applyQueueDropPolicy({ queue, summarize: (x) => x })).toBe(false);
  });

  it("drops oldest items for 'old' policy", () => {
    const queue = makeQueue(["a", "b", "c", "d"], 3, "old");
    applyQueueDropPolicy({ queue, summarize: (x) => x });
    // Should drop enough to make room for 1 new item
    expect(queue.items.length).toBeLessThanOrEqual(2);
  });

  it("drops oldest and summarizes for 'summarize' policy", () => {
    const queue = makeQueue(["msg1", "msg2", "msg3", "msg4"], 3, "summarize");
    applyQueueDropPolicy({ queue, summarize: (x) => x });
    expect(queue.droppedCount).toBeGreaterThan(0);
    expect(queue.summaryLines.length).toBeGreaterThan(0);
  });

  it("respects summaryLimit", () => {
    const queue = makeQueue(["a", "b", "c", "d", "e"], 2, "summarize");
    applyQueueDropPolicy({ queue, summarize: (x) => x, summaryLimit: 2 });
    expect(queue.summaryLines.length).toBeLessThanOrEqual(2);
  });
});
