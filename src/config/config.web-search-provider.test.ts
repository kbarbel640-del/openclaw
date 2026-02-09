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

  it("accepts desearch provider and config", () => {
    const res = validateConfigObject({
      tools: {
        web: {
          search: {
            enabled: true,
            provider: "desearch",
            desearch: {
              apiKey: "dt_test-key",
              baseUrl: "https://api.desearch.ai",
            },
          },
        },
      },
    });

    expect(res.ok).toBe(true);
  });

  it("accepts desearch provider with minimal config", () => {
    const res = validateConfigObject({
      tools: {
        web: {
          search: {
            provider: "desearch",
          },
        },
      },
    });

    expect(res.ok).toBe(true);
  });
});
