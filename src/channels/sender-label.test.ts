import { describe, expect, it } from "vitest";
import { resolveSenderLabel, listSenderLabelCandidates } from "./sender-label.js";

// ---------------------------------------------------------------------------
// resolveSenderLabel
// ---------------------------------------------------------------------------

describe("resolveSenderLabel", () => {
  it("returns null when all fields empty", () => {
    expect(resolveSenderLabel({})).toBeNull();
    expect(resolveSenderLabel({ name: "", username: "" })).toBeNull();
  });

  it("uses name as primary label", () => {
    expect(resolveSenderLabel({ name: "Alice" })).toBe("Alice");
  });

  it("falls back to username when no name", () => {
    expect(resolveSenderLabel({ username: "alice_bot" })).toBe("alice_bot");
  });

  it("falls back to tag when no name/username", () => {
    expect(resolveSenderLabel({ tag: "#admin" })).toBe("#admin");
  });

  it("appends id in parentheses when different from display", () => {
    expect(resolveSenderLabel({ name: "Alice", id: "user123" })).toBe("Alice (user123)");
  });

  it("appends e164 in parentheses", () => {
    expect(resolveSenderLabel({ name: "Alice", e164: "+1234567890" })).toBe("Alice (+1234567890)");
  });

  it("does not duplicate when name equals id", () => {
    expect(resolveSenderLabel({ name: "user123", id: "user123" })).toBe("user123");
  });

  it("returns id alone when only id provided", () => {
    expect(resolveSenderLabel({ id: "user123" })).toBe("user123");
  });

  it("returns e164 alone when only e164 provided", () => {
    expect(resolveSenderLabel({ e164: "+1234567890" })).toBe("+1234567890");
  });

  it("trims whitespace", () => {
    expect(resolveSenderLabel({ name: "  Alice  " })).toBe("Alice");
  });
});

// ---------------------------------------------------------------------------
// listSenderLabelCandidates
// ---------------------------------------------------------------------------

describe("listSenderLabelCandidates", () => {
  it("returns empty array for empty params", () => {
    expect(listSenderLabelCandidates({})).toEqual([]);
  });

  it("includes all non-empty fields", () => {
    const result = listSenderLabelCandidates({
      name: "Alice",
      username: "alice_bot",
      id: "123",
    });
    expect(result).toContain("Alice");
    expect(result).toContain("alice_bot");
    expect(result).toContain("123");
  });

  it("includes the resolved composite label", () => {
    const result = listSenderLabelCandidates({
      name: "Alice",
      id: "123",
    });
    expect(result).toContain("Alice (123)");
  });

  it("deduplicates", () => {
    const result = listSenderLabelCandidates({ name: "Alice" });
    const aliceCount = result.filter((x) => x === "Alice").length;
    expect(aliceCount).toBe(1);
  });
});
