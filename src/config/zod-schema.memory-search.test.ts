import { describe, expect, it } from "vitest";
import { OpenClawSchema } from "./zod-schema.js";

describe("OpenClawSchema memorySearch chunking strategy", () => {
  it("accepts valid chunking.strategy values", () => {
    expect(() =>
      OpenClawSchema.parse({
        agents: {
          defaults: {
            memorySearch: {
              chunking: {
                strategy: "section",
                tokens: 800,
                overlap: 120,
              },
            },
          },
          list: [{ id: "main" }],
        },
      }),
    ).not.toThrow();

    expect(() =>
      OpenClawSchema.parse({
        agents: {
          defaults: {
            memorySearch: {
              chunking: {
                strategy: "token",
              },
            },
          },
          list: [{ id: "main" }],
        },
      }),
    ).not.toThrow();
  });

  it("rejects invalid chunking.strategy values", () => {
    expect(() =>
      OpenClawSchema.parse({
        agents: {
          defaults: {
            memorySearch: {
              chunking: {
                strategy: "invalid",
              },
            },
          },
          list: [{ id: "main" }],
        },
      }),
    ).toThrow();
  });
});
