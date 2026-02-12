import { describe, it, expect } from "vitest";
import { buildResearchDocFromInput } from "../lib/section-extractors.js";

describe("research CLI helpers", () => {
  it("builds a doc from simple markdown", () => {
    const doc = buildResearchDocFromInput({ title: "T", input: "## Req\n- a\n- b" });
    expect(doc.sections[0].title).toBe("Req");
    expect(doc.title).toBe("T");
  });
});
