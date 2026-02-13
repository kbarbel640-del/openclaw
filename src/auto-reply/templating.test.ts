import { describe, expect, it } from "vitest";
import { applyTemplate, type TemplateContext } from "./templating.js";

describe("applyTemplate", () => {
  it("returns empty string for undefined input", () => {
    expect(applyTemplate(undefined, {} as TemplateContext)).toBe("");
  });

  it("returns empty string for empty input", () => {
    expect(applyTemplate("", {} as TemplateContext)).toBe("");
  });

  it("returns text unchanged without placeholders", () => {
    expect(applyTemplate("hello world", {} as TemplateContext)).toBe("hello world");
  });

  it("replaces known placeholders", () => {
    const ctx: TemplateContext = { Body: "hi", From: "+1234" };
    expect(applyTemplate("msg: {{Body}} from {{From}}", ctx)).toBe("msg: hi from +1234");
  });

  it("replaces unknown keys with empty string", () => {
    expect(applyTemplate("{{UnknownField}}", {} as TemplateContext)).toBe("");
  });

  it("handles whitespace around placeholder names", () => {
    const ctx: TemplateContext = { Body: "test" };
    expect(applyTemplate("{{ Body }}", ctx)).toBe("test");
  });

  it("formats numeric values", () => {
    const ctx: TemplateContext = { Timestamp: 12345 };
    expect(applyTemplate("ts={{Timestamp}}", ctx)).toBe("ts=12345");
  });

  it("formats boolean values", () => {
    const ctx: TemplateContext = { WasMentioned: true };
    expect(applyTemplate("{{WasMentioned}}", ctx)).toBe("true");
  });

  it("formats arrays as comma-separated", () => {
    const ctx: TemplateContext = { MediaUrls: ["a.jpg", "b.png"] };
    expect(applyTemplate("{{MediaUrls}}", ctx)).toBe("a.jpg,b.png");
  });

  it("returns empty for null/undefined values", () => {
    const ctx: TemplateContext = { Body: undefined };
    expect(applyTemplate("{{Body}}", ctx)).toBe("");
  });

  it("handles multiple placeholders", () => {
    const ctx: TemplateContext = { SenderName: "Alice", ChatType: "group" };
    expect(applyTemplate("{{SenderName}} in {{ChatType}}", ctx)).toBe("Alice in group");
  });
});
