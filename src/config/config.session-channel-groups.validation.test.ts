import { describe, expect, it } from "vitest";
import { validateConfigObjectWithPlugins } from "./config.js";

describe("session.channelGroups validation", () => {
  it("accepts a record of string arrays", () => {
    const result = validateConfigObjectWithPlugins({
      session: {
        channelGroups: {
          "team-unified": ["discord:channel:123456789", "slack:channel:C12345678"],
        },
      },
    });

    expect(result.ok).toBe(true);
  });

  it("rejects non-array channel group entries", () => {
    const result = validateConfigObjectWithPlugins({
      session: {
        channelGroups: {
          "team-unified": "discord:channel:123456789",
        },
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.issues.some((issue) => issue.path.startsWith("session.channelGroups.team-unified")),
      ).toBe(true);
    }
  });
});
