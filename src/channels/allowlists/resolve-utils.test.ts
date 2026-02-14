import { describe, expect, it, vi } from "vitest";
import { mergeAllowlist, summarizeMapping } from "./resolve-utils.js";

// ---------------------------------------------------------------------------
// mergeAllowlist
// ---------------------------------------------------------------------------

describe("mergeAllowlist", () => {
  it("returns empty array for empty inputs", () => {
    expect(mergeAllowlist({ additions: [] })).toEqual([]);
  });

  it("returns additions when no existing", () => {
    expect(mergeAllowlist({ additions: ["alice", "bob"] })).toEqual(["alice", "bob"]);
  });

  it("merges existing and additions", () => {
    expect(mergeAllowlist({ existing: ["alice"], additions: ["bob"] })).toEqual(["alice", "bob"]);
  });

  it("deduplicates case-insensitively", () => {
    expect(mergeAllowlist({ existing: ["Alice"], additions: ["alice"] })).toEqual(["Alice"]);
  });

  it("preserves original casing of first occurrence", () => {
    expect(mergeAllowlist({ additions: ["Alice", "ALICE", "alice"] })).toEqual(["Alice"]);
  });

  it("skips empty and whitespace-only strings", () => {
    expect(mergeAllowlist({ additions: ["alice", "", "  ", "bob"] })).toEqual(["alice", "bob"]);
  });

  it("trims whitespace", () => {
    expect(mergeAllowlist({ additions: ["  alice  ", "  bob  "] })).toEqual(["alice", "bob"]);
  });

  it("handles numeric existing entries", () => {
    expect(mergeAllowlist({ existing: [12345, 67890], additions: [] })).toEqual(["12345", "67890"]);
  });

  it("deduplicates numbers against string additions", () => {
    expect(mergeAllowlist({ existing: [12345], additions: ["12345"] })).toEqual(["12345"]);
  });

  it("handles undefined existing", () => {
    expect(mergeAllowlist({ existing: undefined, additions: ["alice"] })).toEqual(["alice"]);
  });
});

// ---------------------------------------------------------------------------
// summarizeMapping
// ---------------------------------------------------------------------------

describe("summarizeMapping", () => {
  it("does nothing when both arrays are empty", () => {
    const log = vi.fn();
    summarizeMapping("test", [], [], { log } as unknown);
    expect(log).not.toHaveBeenCalled();
  });

  it("logs resolved entries", () => {
    const log = vi.fn();
    summarizeMapping("Allowlist", ["alice", "bob"], [], { log } as unknown);
    expect(log).toHaveBeenCalledWith("Allowlist resolved: alice, bob");
  });

  it("logs unresolved entries", () => {
    const log = vi.fn();
    summarizeMapping("Allowlist", [], ["charlie"], { log } as unknown);
    expect(log).toHaveBeenCalledWith("Allowlist unresolved: charlie");
  });

  it("truncates to 6 items with count", () => {
    const log = vi.fn();
    const items = ["a", "b", "c", "d", "e", "f", "g", "h"];
    summarizeMapping("Test", items, [], { log } as unknown);
    expect(log).toHaveBeenCalledWith("Test resolved: a, b, c, d, e, f (+2)");
  });

  it("handles runtime without log function", () => {
    // Should not throw
    summarizeMapping("Test", ["alice"], [], {} as unknown);
  });
});
