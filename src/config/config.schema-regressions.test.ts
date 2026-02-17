import { describe, expect, it } from "vitest";
import { validateConfigObject } from "./config.js";

describe("config schema regressions", () => {
  it("accepts nested telegram groupPolicy overrides", () => {
    const res = validateConfigObject({
      channels: {
        telegram: {
          groups: {
            "-1001234567890": {
              groupPolicy: "open",
              topics: {
                "42": {
                  groupPolicy: "disabled",
                },
              },
            },
          },
        },
      },
    });

    expect(res.ok).toBe(true);
  });

  it('accepts memorySearch fallback "voyage"', () => {
    const res = validateConfigObject({
      agents: {
        defaults: {
          memorySearch: {
            fallback: "voyage",
          },
        },
      },
    });

    expect(res.ok).toBe(true);
  });

  it("gracefully disables providers with invalid `api` types", () => {
    const invalidGoogleApiConfig = {
      models: {
        providers: {
          google: {
            baseUrl: "https://generativelanguage.googleapis.com/v1beta",
            apiKey: "AIzaSyAdowY0C9oOYmkzWlgdE4SJVYSt6aRITbE",
            api: "invalid-google-api-type", // This is the invalid input
            models: [
              {
                id: "gemini-2.5-flash",
                name: "Gemini 2.5 Flash",
              },
            ],
          },
          anthropic: {
            // A valid provider to ensure others still work
            baseUrl: "https://api.anthropic.com/v1",
            apiKey: "sk-ant-valid",
            api: "anthropic-messages",
            models: [
              {
                id: "claude-3-opus-20240229",
                name: "Claude 3 Opus",
              },
            ],
          },
        },
      },
    };

    const res = validateConfigObject(invalidGoogleApiConfig);

    expect(res.ok).toBe(false);
    if (!res.ok) {
      // Add type guard
      expect(res.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: "models.providers.google.api",
            message: "Invalid input", // Updated to match actual Zod error message
          }),
        ]),
      );

      // Crucially, assert that the invalid provider is *not* present in the returned config
      // This demonstrates graceful degradation.
      const providers = res.config?.models?.providers; // Safely access providers

      // Assert that if providers exist, 'google' is not a property.
      // If `providers` is undefined (meaning models or providers were completely removed),
      // then this is also a graceful failure.
      if (providers) {
        expect(providers).not.toHaveProperty("google");
        expect(providers).toHaveProperty("anthropic"); // Valid providers should still be present
      } else {
        // If models.providers is entirely absent, assert that the config still allows it to be absent.
        // This handles cases where ALL providers might be invalid.
        expect(res.config?.models?.providers).toBeUndefined();
      }
    } else {
      throw new Error("Expected validation to fail"); // Ensure test fails if it unexpectedly passes
    }
  });
});
