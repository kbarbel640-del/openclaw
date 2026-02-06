import { describe, expect, it, vi } from "vitest";

vi.mock("./client.js", () => {
  return {
    zulipRequest: vi.fn(async () => ({ result: "success" })),
  };
});

import type { ZulipAuth } from "./client.js";
import { zulipRequest } from "./client.js";
import { removeZulipReaction } from "./reactions.js";

describe("removeZulipReaction", () => {
  it("sends emoji_name as query params", async () => {
    const auth: ZulipAuth = {
      baseUrl: "https://zulip.example",
      email: "bot@zulip.example",
      apiKey: "not-a-real-key",
    };

    await removeZulipReaction({
      auth,
      messageId: 123,
      emojiName: ":eyes:",
    });

    expect(zulipRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "DELETE",
        path: "/api/v1/messages/123/reactions",
        query: { emoji_name: "eyes" },
      }),
    );
  });
});
