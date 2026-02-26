import { describe, expect, it } from "vitest";
import { mergeAssistantTextBuffer, sanitizeAssistantText } from "./chat-response-text.js";

describe("chat response text helpers", () => {
  it("removes final tags and trailing LOOP_DONE sentinel", () => {
    expect(sanitizeAssistantText("<final>Hello world</final>\nLOOP_DONE")).toBe("Hello world");
  });

  it("removes partial final tags from streaming chunks", () => {
    // Partial closing tag (missing >)
    expect(sanitizeAssistantText("✓</final")).toBe("✓");
    // Partial opening tag (missing >)
    expect(sanitizeAssistantText("<final✓</final>")).toBe("✓");
    // Both partial
    expect(sanitizeAssistantText("<final✓</final")).toBe("✓");
  });

  it("merges chunk deltas and ignores empty incoming text", () => {
    const merged = mergeAssistantTextBuffer("Hello ", "world");
    expect(merged).toBe("Hello world");
    expect(mergeAssistantTextBuffer(merged, "")).toBe("Hello world");
  });

  it("handles corrected snapshot chunks without duplicating prefixes", () => {
    const step1 = mergeAssistantTextBuffer("There'", "There's");
    expect(step1).toBe("There's");
    const step2 = mergeAssistantTextBuffer(step1, "There's already");
    expect(step2).toBe("There's already");
  });

  it("joins overlapping chunks by suffix/prefix overlap", () => {
    expect(mergeAssistantTextBuffer("architecture", "tecture docs")).toBe("architecture docs");
  });
});
