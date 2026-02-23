import { describe, expect, it } from "vitest";
import { validateConfigObject } from "./config.js";

describe("Aperture config schema", () => {
  it("accepts gateway.aperture with all fields", () => {
    const res = validateConfigObject({
      gateway: {
        aperture: {
          enabled: true,
          hostname: "ai-cvb",
          providers: ["openai"],
        },
      },
    });

    expect(res.ok).toBe(true);
  });

  it("accepts gateway.aperture restore snapshots", () => {
    const res = validateConfigObject({
      gateway: {
        aperture: {
          enabled: true,
          hostname: "ai-cvb",
          providers: ["openai"],
          restore: {
            openai: {
              baseUrl: "https://api.openai.com/v1",
              apiKey: "OPENAI_API_KEY",
              api: "openai-responses",
            },
          },
        },
      },
    });

    expect(res.ok).toBe(true);
  });

  it("accepts gateway.aperture with only enabled", () => {
    const res = validateConfigObject({
      gateway: {
        aperture: {
          enabled: false,
        },
      },
    });

    expect(res.ok).toBe(true);
  });

  it("accepts provider config without models (Aperture proxy pattern)", () => {
    const res = validateConfigObject({
      models: {
        providers: {
          openai: {
            baseUrl: "http://ai-proxy/v1",
            apiKey: "-",
          },
        },
      },
    });

    expect(res.ok).toBe(true);
  });

  it("accepts full Aperture config shape", () => {
    const res = validateConfigObject({
      gateway: {
        aperture: {
          enabled: true,
          hostname: "ai-cvb",
          providers: ["openai"],
        },
      },
      models: {
        providers: {
          openai: {
            baseUrl: "http://ai-cvb/v1",
            apiKey: "-",
          },
        },
      },
      agents: {
        defaults: {
          model: {
            primary: "openai/claude-opus-4-6",
          },
        },
      },
    });

    expect(res.ok).toBe(true);
  });

  it("rejects gateway.aperture with unknown fields", () => {
    const res = validateConfigObject({
      gateway: {
        aperture: {
          enabled: true,
          unknown: "field",
        },
      },
    });

    expect(res.ok).toBe(false);
  });

  it("rejects gateway.aperture.restore entries with unknown fields", () => {
    const res = validateConfigObject({
      gateway: {
        aperture: {
          enabled: true,
          restore: {
            openai: {
              baseUrl: "https://api.openai.com/v1",
              unknown: "field",
            },
          },
        },
      },
    });

    expect(res.ok).toBe(false);
  });

  it("rejects gateway.aperture.restore entries with invalid api values", () => {
    const res = validateConfigObject({
      gateway: {
        aperture: {
          enabled: true,
          restore: {
            openai: {
              baseUrl: "https://api.openai.com/v1",
              api: "not-real-api",
            },
          },
        },
      },
    });

    expect(res.ok).toBe(false);
  });
});
