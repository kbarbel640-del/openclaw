import { describe, expect, it } from "vitest";
import { ToolsWebFetchSchema } from "./zod-schema.agent-runtime.js";

describe("ToolsWebFetchSchema firecrawl", () => {
  it("accepts a valid firecrawl config block", () => {
    const result = ToolsWebFetchSchema.safeParse({
      firecrawl: {
        enabled: true,
        apiKey: "fc-test",
        baseUrl: "https://api.firecrawl.dev",
        onlyMainContent: true,
        maxAgeMs: 172800000,
        timeoutSeconds: 60,
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts firecrawl with only apiKey", () => {
    const result = ToolsWebFetchSchema.safeParse({
      firecrawl: { apiKey: "fc-test" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects firecrawl with unknown keys", () => {
    const result = ToolsWebFetchSchema.safeParse({
      firecrawl: { apiKey: "fc-test", unknownField: true },
    });
    expect(result.success).toBe(false);
  });

  it("accepts readability boolean", () => {
    const result = ToolsWebFetchSchema.safeParse({
      readability: false,
    });
    expect(result.success).toBe(true);
  });

  it("accepts fetch config without firecrawl", () => {
    const result = ToolsWebFetchSchema.safeParse({
      enabled: true,
      maxChars: 50000,
      timeoutSeconds: 30,
    });
    expect(result.success).toBe(true);
  });
});
