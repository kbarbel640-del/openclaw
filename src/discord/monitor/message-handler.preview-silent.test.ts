import { describe, expect, it } from "vitest";
import { shouldSuppressDiscordDraftPreviewText } from "./message-handler.process.js";

describe("shouldSuppressDiscordDraftPreviewText", () => {
  it("suppresses exact NO_REPLY", () => {
    expect(shouldSuppressDiscordDraftPreviewText("NO_REPLY")).toBe(true);
    expect(shouldSuppressDiscordDraftPreviewText("  NO_REPLY  ")).toBe(true);
  });

  it("suppresses partial sentinel prefixes (streaming leakage)", () => {
    expect(shouldSuppressDiscordDraftPreviewText("NO_")).toBe(true);
    expect(shouldSuppressDiscordDraftPreviewText("NO_RE")).toBe(true);
    expect(shouldSuppressDiscordDraftPreviewText("NO_REP")).toBe(true);
  });

  it("does not suppress normal text", () => {
    expect(shouldSuppressDiscordDraftPreviewText("No worries")).toBe(false);
    expect(shouldSuppressDiscordDraftPreviewText("This is not a NO_REPLY situation")).toBe(false);
  });
});
