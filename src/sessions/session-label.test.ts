import { describe, expect, it } from "vitest";
import { parseSessionLabel, SESSION_LABEL_MAX_LENGTH } from "./session-label.js";

describe("parseSessionLabel", () => {
  it("returns ok for valid label", () => {
    const result = parseSessionLabel("my-session");
    expect(result).toEqual({ ok: true, label: "my-session" });
  });

  it("trims whitespace", () => {
    const result = parseSessionLabel("  trimmed  ");
    expect(result).toEqual({ ok: true, label: "trimmed" });
  });

  it("rejects non-string input", () => {
    expect(parseSessionLabel(123).ok).toBe(false);
    expect(parseSessionLabel(null).ok).toBe(false);
    expect(parseSessionLabel(undefined).ok).toBe(false);
    expect(parseSessionLabel({}).ok).toBe(false);
  });

  it("rejects empty string", () => {
    expect(parseSessionLabel("").ok).toBe(false);
    expect(parseSessionLabel("   ").ok).toBe(false);
  });

  it("rejects labels exceeding max length", () => {
    const tooLong = "a".repeat(SESSION_LABEL_MAX_LENGTH + 1);
    const result = parseSessionLabel(tooLong);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("too long");
    }
  });

  it("accepts labels at exactly max length", () => {
    const exact = "a".repeat(SESSION_LABEL_MAX_LENGTH);
    const result = parseSessionLabel(exact);
    expect(result.ok).toBe(true);
  });
});
