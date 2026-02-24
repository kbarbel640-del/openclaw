import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadConfig } = vi.hoisted(() => ({
  loadConfig: vi.fn(() => ({})),
}));

vi.mock("../config/config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../config/config.js")>();
  return {
    ...actual,
    loadConfig,
  };
});

import { createForumTopicTelegram } from "./send.js";

describe("createForumTopicTelegram", () => {
  beforeEach(() => {
    loadConfig.mockReturnValue({});
  });

  it("calls createForumTopic with icon_custom_emoji_id when provided", async () => {
    const createForumTopic = vi.fn().mockResolvedValue({
      message_thread_id: 456,
      name: "Ops",
    });
    const api = {
      raw: {
        createForumTopic,
      },
    } as const;

    const result = await createForumTopicTelegram("-100123", "Ops", {
      token: "tok",
      api: api as unknown as Parameters<typeof createForumTopicTelegram>[2]["api"],
      iconCustomEmojiId: "5390123456789012345",
    });

    expect(createForumTopic).toHaveBeenCalledWith({
      chat_id: "-100123",
      name: "Ops",
      icon_custom_emoji_id: "5390123456789012345",
    });
    expect(result).toEqual({
      threadId: "456",
      chatId: "-100123",
      name: "Ops",
      iconCustomEmojiId: "5390123456789012345",
    });
  });

  it("normalizes prefixed targets before createForumTopic", async () => {
    const createForumTopic = vi.fn().mockResolvedValue({
      message_thread_id: 12,
      name: "Infra",
    });
    const api = {
      raw: {
        createForumTopic,
      },
    } as const;

    await createForumTopicTelegram("telegram:group:-100987", "Infra", {
      token: "tok",
      api: api as unknown as Parameters<typeof createForumTopicTelegram>[2]["api"],
    });

    expect(createForumTopic).toHaveBeenCalledWith({
      chat_id: "-100987",
      name: "Infra",
    });
  });

  it("maps invalid icon errors to an actionable message", async () => {
    const createForumTopic = vi
      .fn()
      .mockRejectedValue(new Error("400: Bad Request: icon custom emoji id invalid"));
    const api = {
      raw: {
        createForumTopic,
      },
    } as const;

    await expect(
      createForumTopicTelegram("-100123", "Ops", {
        token: "tok",
        api: api as unknown as Parameters<typeof createForumTopicTelegram>[2]["api"],
        iconCustomEmojiId: "bad",
      }),
    ).rejects.toThrow(/icon_custom_emoji_id is invalid/i);
  });
});
