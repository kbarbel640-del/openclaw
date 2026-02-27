import { describe, expect, it } from "vitest";
import { shouldSuppressTelegramDraftPreviewText } from "./bot-message-dispatch.js";

describe("shouldSuppressTelegramDraftPreviewText", () => {
  it("suppresses exact NO_REPLY", () => {
    expect(shouldSuppressTelegramDraftPreviewText("NO_REPLY")).toBe(true);
    expect(shouldSuppressTelegramDraftPreviewText("  NO_REPLY  ")).toBe(true);
  });

  it("suppresses partial sentinel prefixes (streaming leakage)", () => {
    expect(shouldSuppressTelegramDraftPreviewText("NO_")).toBe(true);
    expect(shouldSuppressTelegramDraftPreviewText("NO_RE")).toBe(true);
    expect(shouldSuppressTelegramDraftPreviewText("NO_REP")).toBe(true);
  });

  it("does not suppress normal text", () => {
    expect(shouldSuppressTelegramDraftPreviewText("No worries")).toBe(false);
    expect(shouldSuppressTelegramDraftPreviewText("This is not a NO_REPLY situation")).toBe(false);
  });
});
