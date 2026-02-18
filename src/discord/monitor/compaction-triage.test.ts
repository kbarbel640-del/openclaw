import { describe, expect, it } from "vitest";
import {
  buildCompactionTriageButtonLabel,
  buildCompactionTriageCustomId,
  COMPACTION_TRIAGE_EVENT_TEXT,
  COMPACTION_TRIAGE_KEY,
  parseCompactionTriageCustomId,
} from "./compaction-triage.js";

describe("buildCompactionTriageCustomId", () => {
  it("builds do_all custom ID with correct prefix", () => {
    const id = buildCompactionTriageCustomId("do_all");
    expect(id).toBe(`${COMPACTION_TRIAGE_KEY}:action=do_all`);
  });

  it("builds skip_all custom ID with correct prefix", () => {
    const id = buildCompactionTriageCustomId("skip_all");
    expect(id).toBe(`${COMPACTION_TRIAGE_KEY}:action=skip_all`);
  });
});

describe("parseCompactionTriageCustomId", () => {
  it("parses do_all", () => {
    const result = parseCompactionTriageCustomId(`${COMPACTION_TRIAGE_KEY}:action=do_all`);
    expect(result).toEqual({ action: "do_all" });
  });

  it("parses skip_all", () => {
    const result = parseCompactionTriageCustomId(`${COMPACTION_TRIAGE_KEY}:action=skip_all`);
    expect(result).toEqual({ action: "skip_all" });
  });

  it("returns null for unknown prefix", () => {
    expect(parseCompactionTriageCustomId("otherkey:action=do_all")).toBeNull();
  });

  it("returns null for unknown action", () => {
    expect(parseCompactionTriageCustomId(`${COMPACTION_TRIAGE_KEY}:action=unknown`)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseCompactionTriageCustomId("")).toBeNull();
  });

  it("round-trips do_all through build + parse", () => {
    const id = buildCompactionTriageCustomId("do_all");
    expect(parseCompactionTriageCustomId(id)).toEqual({ action: "do_all" });
  });

  it("round-trips skip_all through build + parse", () => {
    const id = buildCompactionTriageCustomId("skip_all");
    expect(parseCompactionTriageCustomId(id)).toEqual({ action: "skip_all" });
  });
});

describe("COMPACTION_TRIAGE_EVENT_TEXT", () => {
  it("do_all maps to 'do all'", () => {
    expect(COMPACTION_TRIAGE_EVENT_TEXT.do_all).toBe("do all");
  });

  it("skip_all maps to 'skip all'", () => {
    expect(COMPACTION_TRIAGE_EVENT_TEXT.skip_all).toBe("skip all");
  });
});

describe("buildCompactionTriageButtonLabel", () => {
  it("returns ✅ Do All for do_all", () => {
    expect(buildCompactionTriageButtonLabel("do_all")).toBe("✅ Do All");
  });

  it("returns ⏭️ Skip All for skip_all", () => {
    expect(buildCompactionTriageButtonLabel("skip_all")).toBe("⏭️ Skip All");
  });
});
