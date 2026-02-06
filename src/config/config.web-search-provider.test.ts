import { describe, expect, it } from "vitest";
import { validateConfigObject } from "./config.js";

describe("web search provider config", () => {
  it("accepts perplexity provider and config", () => {
    const res = validateConfigObject({
      tools: {
        web: {
          search: {
            enabled: true,
            provider: "perplexity",
            perplexity: {
              apiKey: "test-key",
              baseUrl: "https://api.perplexity.ai",
              model: "perplexity/sonar-pro",
            },
          },
        },
      },
    });

    expect(res.ok).toBe(true);
  });

  it("accepts a custom provider string for plugin-based search", () => {
    const res = validateConfigObject({
      tools: {
        web: {
          search: {
            enabled: true,
            provider: "zhipu",
          },
        },
      },
    });

    expect(res.ok).toBe(true);
  });
});
