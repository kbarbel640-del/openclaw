import { describe, expect, it } from "vitest";
import { validateConfigObject } from "./config.js";

describe("config discord intents", () => {
  it("accepts guildVoiceStates in intents config", () => {
    const res = validateConfigObject({
      channels: {
        discord: {
          intents: {
            guildVoiceStates: true,
          },
        },
      },
    });

    expect(res.ok).toBe(true);
  });
});
