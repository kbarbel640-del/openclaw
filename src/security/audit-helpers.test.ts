import { describe, expect, it } from "vitest";
import { normalizeAllowFromList } from "./audit-helpers.js";

describe("normalizeAllowFromList", () => {
  it("returns empty array for undefined", () => {
    expect(normalizeAllowFromList(undefined)).toEqual([]);
  });

  it("returns empty array for null", () => {
    expect(normalizeAllowFromList(null)).toEqual([]);
  });

  it("returns empty array for non-array value", () => {
    expect(normalizeAllowFromList("not-an-array" as unknown as string[])).toEqual([]);
  });

  it("coerces numbers to strings", () => {
    expect(normalizeAllowFromList([123, 456])).toEqual(["123", "456"]);
  });

  it("trims whitespace", () => {
    expect(normalizeAllowFromList(["  alice ", " bob"])).toEqual(["alice", "bob"]);
  });

  it("filters empty strings after trim", () => {
    expect(normalizeAllowFromList(["alice", "", "  ", "bob"])).toEqual(["alice", "bob"]);
  });

  it("handles mixed string and number entries", () => {
    expect(normalizeAllowFromList(["*", 12345, "user@example.com"])).toEqual([
      "*",
      "12345",
      "user@example.com",
    ]);
  });
});
