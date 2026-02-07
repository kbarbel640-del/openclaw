import { describe, expect, it } from "vitest";
import { parseSessionLabel, SESSION_LABEL_MAX_LENGTH } from "./session-label.js";

describe("parseSessionLabel", () => {
  it("accepts a valid label", () => {
    const result = parseSessionLabel("my-session");
    expect(result).toEqual({ ok: true, label: "my-session" });
  });

  it("trims surrounding whitespace", () => {
    const result = parseSessionLabel("  hello  ");
    expect(result).toEqual({ ok: true, label: "hello" });
  });

  it("accepts a label at exactly the max length", () => {
    const label = "a".repeat(SESSION_LABEL_MAX_LENGTH);
    const result = parseSessionLabel(label);
    expect(result).toEqual({ ok: true, label });
  });

  it("rejects a label exceeding the max length", () => {
    const label = "a".repeat(SESSION_LABEL_MAX_LENGTH + 1);
    const result = parseSessionLabel(label);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("too long");
    }
  });

  it("rejects an empty string", () => {
    const result = parseSessionLabel("");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("empty");
    }
  });

  it("rejects a whitespace-only string", () => {
    const result = parseSessionLabel("   ");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("empty");
    }
  });

  it("rejects non-string input (number)", () => {
    const result = parseSessionLabel(42);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("must be a string");
    }
  });

  it("rejects non-string input (null)", () => {
    const result = parseSessionLabel(null);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("must be a string");
    }
  });

  it("rejects non-string input (undefined)", () => {
    const result = parseSessionLabel(undefined);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("must be a string");
    }
  });

  it("rejects non-string input (object)", () => {
    const result = parseSessionLabel({ label: "test" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("must be a string");
    }
  });

  it("accepts labels with special characters", () => {
    const result = parseSessionLabel("my-session_2026.02.07");
    expect(result).toEqual({ ok: true, label: "my-session_2026.02.07" });
  });

  it("accepts labels with unicode characters", () => {
    const result = parseSessionLabel("会话-テスト");
    expect(result).toEqual({ ok: true, label: "会话-テスト" });
  });

  it("exports SESSION_LABEL_MAX_LENGTH as 64", () => {
    expect(SESSION_LABEL_MAX_LENGTH).toBe(64);
  });
});
