import { describe, expect, it } from "vitest";
import { buildIdentityContext, type IdentityContextParams } from "./identity-context.js";

describe("buildIdentityContext", () => {
  it("builds identity block with all fields", () => {
    const result = buildIdentityContext({
      botUserId: "U12345",
      botName: "claude-bot",
      displayName: "Claude Bot",
    });

    expect(result).toContain("## Your Identity");
    expect(result).toContain("Name: Claude Bot");
    expect(result).toContain("Slack User ID: U12345");
    expect(result).toContain("Mention format: <@U12345>");
  });

  it("uses botName as fallback for displayName", () => {
    const result = buildIdentityContext({
      botUserId: "U12345",
      botName: "claude-bot",
    });

    expect(result).toContain("Name: claude-bot");
  });

  it("includes teammates when provided", () => {
    const result = buildIdentityContext({
      botUserId: "U12345",
      botName: "claude-bot",
      teammates: [
        {
          userId: "U99999",
          name: "data-bot",
          displayName: "Data Bot",
          isBot: true,
          deleted: false,
        },
      ],
    });

    expect(result).toContain("## Your Teammates");
    expect(result).toContain("@data-bot (U99999)");
  });
});
