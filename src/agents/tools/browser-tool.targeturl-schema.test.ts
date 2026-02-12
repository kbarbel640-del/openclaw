import { describe, expect, it } from "vitest";
import { BrowserToolSchema } from "./browser-tool.schema.js";
import { readStringParam } from "./common.js";

describe("BrowserToolSchema targetUrl consistency (#14700)", () => {
  it("schema targetUrl has description guiding the model", () => {
    const props = (BrowserToolSchema as Record<string, unknown>).properties as Record<
      string,
      Record<string, unknown>
    >;
    const targetUrlProp = props.targetUrl;
    // TypeBox Optional wraps in anyOf; check inner schema for description
    const innerSchemas = (targetUrlProp.anyOf as Record<string, unknown>[]) ?? [targetUrlProp];
    const descriptions = innerSchemas
      .map((s) => s.description as string | undefined)
      .filter(Boolean);
    expect(descriptions.length).toBeGreaterThan(0);
    expect(descriptions[0]).toMatch(/required.*open|open.*required/i);
  });

  it("runtime error for open action mentions the action name", () => {
    expect(() =>
      readStringParam({}, "targetUrl", {
        required: true,
        label: "targetUrl is required for the open action — provide the URL to open",
      }),
    ).toThrow(/open action/);
  });

  it("runtime error for navigate action mentions the action name", () => {
    expect(() =>
      readStringParam({}, "targetUrl", {
        required: true,
        label: "targetUrl is required for the navigate action — provide the URL to navigate to",
      }),
    ).toThrow(/navigate action/);
  });
});
