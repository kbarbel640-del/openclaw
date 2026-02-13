import { describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";
import { createSlackActions } from "./slack.actions.js";

const handleSlackAction = vi.fn(async () => ({ details: { ok: true } }));

vi.mock("../../agents/tools/slack-actions.js", () => ({
  handleSlackAction: (...args: unknown[]) => handleSlackAction(...args),
}));

describe("slack actions adapter", () => {
  it("forwards threadId for read", async () => {
    const cfg = { channels: { slack: { botToken: "tok" } } } as OpenClawConfig;
    const actions = createSlackActions("slack");

    await actions.handleAction?.({
      channel: "slack",
      action: "read",
      cfg,
      params: {
        channelId: "C1",
        threadId: "171234.567",
      },
    });

    const [params] = handleSlackAction.mock.calls[0] ?? [];
    expect(params).toMatchObject({
      action: "readMessages",
      channelId: "C1",
      threadId: "171234.567",
    });
  });

  it("forwards channel create params", async () => {
    const cfg = {
      channels: { slack: { botToken: "tok", actions: { channels: true } } },
    } as OpenClawConfig;
    const actions = createSlackActions("slack");

    await actions.handleAction?.({
      channel: "slack",
      action: "channel-create",
      cfg,
      params: {
        name: "leads",
        topic: "Lead Discovery Hub",
        private: "false",
      },
    });

    const [params] = handleSlackAction.mock.calls.at(-1) ?? [];
    expect(params).toMatchObject({
      action: "channelCreate",
      name: "leads",
      topic: "Lead Discovery Hub",
      isPrivate: false,
    });
  });
});
