import { describe, expect, it } from "vitest";
import { extractReasoningBody, isReasoningReply } from "./replies.js";

describe("isReasoningReply", () => {
  it("detects reasoning prefix", () => {
    expect(isReasoningReply("Reasoning:\n_some thinking_")).toBe(true);
  });

  it("rejects non-reasoning text", () => {
    expect(isReasoningReply("Hello world")).toBe(false);
    expect(isReasoningReply("Reasoning about something")).toBe(false);
    expect(isReasoningReply("")).toBe(false);
  });
});

describe("extractReasoningBody", () => {
  it("strips prefix and italic wrappers", () => {
    const input = "Reasoning:\n_first line_\n_second line_";
    expect(extractReasoningBody(input)).toBe("first line\nsecond line");
  });

  it("preserves empty lines", () => {
    const input = "Reasoning:\n_first_\n\n_third_";
    expect(extractReasoningBody(input)).toBe("first\n\nthird");
  });

  it("handles lines without italic wrappers", () => {
    const input = "Reasoning:\nplain line\n_italic line_";
    expect(extractReasoningBody(input)).toBe("plain line\nitalic line");
  });
});
