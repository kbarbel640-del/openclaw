import { describe, it, expect } from "vitest";
import {
  extractSectionsFromMarkdownOrText,
  buildResearchDocFromInput,
} from "./section-extractors.js";

describe("section extractors (heading-split)", () => {
  it("splits markdown by H2 headings", () => {
    const md = `# Title\n\n## Context\nThis is background.\n\n## Requirements\n- one\n- two`;
    const secs = extractSectionsFromMarkdownOrText(md);
    expect(secs.length).toBeGreaterThanOrEqual(2);
    expect(secs[0].title).toBe("Context");
    expect(secs[1].title).toBe("Requirements");
  });

  it("creates sensible fallback for plain text", () => {
    const txt = "A short investigation.\n\nDetails and examples.";
    const secs = extractSectionsFromMarkdownOrText(txt);
    expect(secs[0].title).toMatch(/Background/i);
    expect(secs[1].title).toMatch(/Findings|Next steps/i);
  });

  it("builds a valid ResearchDoc", () => {
    const doc = buildResearchDocFromInput({ title: "T", input: "## A\ntext" });
    expect(doc.schemaVersion).toBe("research.v1");
    expect(doc.sections[0].title).toBe("A");
  });
});
