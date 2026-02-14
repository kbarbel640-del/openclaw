import { describe, expect, it } from "vitest";
import { extractEtaMinutes, parseShubhamReply } from "./parse-reply.js";

describe("parseShubhamReply", () => {
  it("detects positive Hinglish reply with ETA", () => {
    const parsed = parseShubhamReply("Haan aa raha hu, 20 min late ho jaunga");
    expect(parsed.availability).toBe("yes");
    expect(parsed.etaMinutes).toBe(20);
    expect(parsed.confidence).toBeGreaterThan(0.7);
  });

  it("detects negative reply", () => {
    const parsed = parseShubhamReply("Nahi aa paunga bro");
    expect(parsed.availability).toBe("no");
    expect(parsed.etaMinutes).toBeUndefined();
  });

  it("detects maybe reply", () => {
    const parsed = parseShubhamReply("Shayad, not sure abhi");
    expect(parsed.availability).toBe("maybe");
  });
});

describe("extractEtaMinutes", () => {
  it("handles minute ranges", () => {
    expect(extractEtaMinutes("15-20 min")).toBe(18);
  });

  it("handles hour format", () => {
    expect(extractEtaMinutes("in 1 hr")).toBe(60);
  });

  it("handles half-hour phrasing", () => {
    expect(extractEtaMinutes("aadha ghanta lagega")).toBe(30);
  });
});
