import { describe, expect, it } from "vitest";
import { FIELD_HELP } from "./schema.help.js";

describe("schema.help search provider description (#19554)", () => {
  it("lists grok alongside brave and perplexity", () => {
    const desc = FIELD_HELP["tools.web.search.provider"];
    expect(desc).toContain("grok");
    expect(desc).toContain("brave");
    expect(desc).toContain("perplexity");
  });

  it("includes grok-specific config help entries", () => {
    expect(FIELD_HELP["tools.web.search.grok.apiKey"]).toBeDefined();
    expect(FIELD_HELP["tools.web.search.grok.model"]).toBeDefined();
    expect(FIELD_HELP["tools.web.search.grok.inlineCitations"]).toBeDefined();
  });
});
