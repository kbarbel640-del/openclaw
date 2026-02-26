import { describe, expect, it } from "vitest";
import { findMissingChannelNavEntries } from "../../scripts/check-docs-channel-nav.mjs";

describe("check-docs-channel-nav", () => {
  it("returns no missing entries when every channel doc is present in docs.json pages", () => {
    const config = {
      navigation: [
        {
          pages: ["channels/mattermost", "channels/email", "channels/signal"],
        },
      ],
    };
    const channelPages = ["channels/mattermost", "channels/email", "channels/signal"];
    expect(findMissingChannelNavEntries(config, channelPages)).toEqual([]);
  });

  it("returns missing channel entries", () => {
    const config = {
      navigation: [
        {
          pages: ["channels/mattermost", "channels/signal"],
        },
      ],
    };
    const channelPages = ["channels/mattermost", "channels/email", "channels/signal"];
    expect(findMissingChannelNavEntries(config, channelPages)).toEqual(["channels/email"]);
  });
});
