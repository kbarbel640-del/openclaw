import { describe, expect, it } from "vitest";
import { ToolsWebFetchSchema } from "./zod-schema.agent-runtime.js";

describe("ToolsWebFetchSchema – firecrawl block", () => {
  it("accepts a valid firecrawl config", () => {
    const result = ToolsWebFetchSchema.safeParse({
      firecrawl: {
        apiKey: "fc-test",
        baseUrl: "https://api.firecrawl.dev",
        onlyMainContent: true,
        maxAgeMs: 172800000,
        timeoutSeconds: 60,
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts firecrawl with only enabled flag", () => {
    const result = ToolsWebFetchSchema.safeParse({
      firecrawl: { enabled: true },
    });
    expect(result.success).toBe(true);
  });

  it("accepts readability boolean", () => {
    const result = ToolsWebFetchSchema.safeParse({
      readability: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown keys inside firecrawl", () => {
    const result = ToolsWebFetchSchema.safeParse({
      firecrawl: { unknownKey: true },
    });
    expect(result.success).toBe(false);
  });

  it("accepts full fetch config with firecrawl", () => {
    const result = ToolsWebFetchSchema.safeParse({
      enabled: true,
      maxChars: 50000,
      timeoutSeconds: 30,
      readability: true,
      firecrawl: {
        enabled: true,
        apiKey: "fc-xxx",
        baseUrl: "https://custom.firecrawl.dev",
        onlyMainContent: false,
        maxAgeMs: 86400000,
        timeoutSeconds: 45,
      },
    });
    expect(result.success).toBe(true);
  });
});
