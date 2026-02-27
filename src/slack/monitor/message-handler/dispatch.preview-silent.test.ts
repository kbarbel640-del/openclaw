import { describe, expect, it } from "vitest";
import { shouldSuppressSlackDraftPreviewText } from "./dispatch.js";

describe("shouldSuppressSlackDraftPreviewText", () => {
  it("suppresses exact NO_REPLY", () => {
    expect(shouldSuppressSlackDraftPreviewText("NO_REPLY")).toBe(true);
    expect(shouldSuppressSlackDraftPreviewText("  NO_REPLY  ")).toBe(true);
  });

  it("suppresses partial sentinel prefixes (streaming leakage)", () => {
    expect(shouldSuppressSlackDraftPreviewText("NO_")).toBe(true);
    expect(shouldSuppressSlackDraftPreviewText("NO_RE")).toBe(true);
    expect(shouldSuppressSlackDraftPreviewText("NO_REP")).toBe(true);
  });

  it("does not suppress normal text", () => {
    expect(shouldSuppressSlackDraftPreviewText("No worries")).toBe(false);
    expect(shouldSuppressSlackDraftPreviewText("This is not a NO_REPLY situation")).toBe(false);
  });
});
