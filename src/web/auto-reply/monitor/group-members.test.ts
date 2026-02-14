import { describe, expect, it } from "vitest";
import { noteGroupMember, formatGroupMembers } from "./group-members.js";

describe("noteGroupMember", () => {
  it("records a member in the roster", () => {
    const map = new Map<string, Map<string, string>>();
    noteGroupMember(map, "group:123", "+15551234567", "Alice");
    expect(map.get("group:123")?.size).toBe(1);
    expect(map.get("group:123")?.get("+15551234567")).toBe("Alice");
  });

  it("normalizes E164 before storing", () => {
    const map = new Map<string, Map<string, string>>();
    noteGroupMember(map, "group:123", "15551234567", "Alice");
    // Should normalize to +15551234567
    expect(map.get("group:123")?.has("+15551234567")).toBe(true);
  });

  it("updates name if member already exists", () => {
    const map = new Map<string, Map<string, string>>();
    noteGroupMember(map, "group:123", "+15551234567", "Alice");
    noteGroupMember(map, "group:123", "+15551234567", "Alice Smith");
    expect(map.get("group:123")?.get("+15551234567")).toBe("Alice Smith");
    expect(map.get("group:123")?.size).toBe(1);
  });

  it("tracks multiple members in same group", () => {
    const map = new Map<string, Map<string, string>>();
    noteGroupMember(map, "group:123", "+15551234567", "Alice");
    noteGroupMember(map, "group:123", "+15559876543", "Bob");
    expect(map.get("group:123")?.size).toBe(2);
  });

  it("ignores call if e164 is missing", () => {
    const map = new Map<string, Map<string, string>>();
    noteGroupMember(map, "group:123", undefined, "Alice");
    expect(map.get("group:123")).toBeUndefined();
  });

  it("ignores call if name is missing", () => {
    const map = new Map<string, Map<string, string>>();
    noteGroupMember(map, "group:123", "+15551234567", undefined);
    expect(map.get("group:123")).toBeUndefined();
  });
});

describe("formatGroupMembers", () => {
  it("formats roster with names", () => {
    const roster = new Map<string, string>();
    roster.set("+15551234567", "Alice");
    roster.set("+15559876543", "Bob");
    const result = formatGroupMembers({
      participants: undefined,
      roster,
    });
    expect(result).toContain("Alice (+15551234567)");
    expect(result).toContain("Bob (+15559876543)");
  });

  it("returns undefined when no members", () => {
    const result = formatGroupMembers({
      participants: undefined,
      roster: undefined,
    });
    expect(result).toBeUndefined();
  });

  it("uses fallbackE164 when no other members", () => {
    const result = formatGroupMembers({
      participants: undefined,
      roster: undefined,
      fallbackE164: "+15551234567",
    });
    expect(result).toBe("+15551234567");
  });

  it("deduplicates participants and roster", () => {
    const roster = new Map<string, string>();
    roster.set("+15551234567", "Alice");
    const result = formatGroupMembers({
      participants: ["+15551234567"],
      roster,
    });
    // Should only appear once
    const count = (result?.match(/15551234567/g) ?? []).length;
    expect(count).toBe(1);
  });
});
