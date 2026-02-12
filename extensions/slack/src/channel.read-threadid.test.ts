import { describe, expect, it, vi } from "vitest";
import { setSlackRuntime } from "./runtime.js";

// Capture the params passed to handleSlackAction
const handleSlackAction = vi.fn(async () => ({ ok: true, details: { messages: [] } }));

// Set up a minimal mock runtime before importing channel
setSlackRuntime({
  channel: {
    slack: {
      handleSlackAction,
    },
  },
  config: { loadConfig: () => ({}) },
} as any);

// Now import the channel plugin (it will use the mocked runtime)
const { slackPlugin } = await import("./channel.js");

const cfg = { channels: { slack: { botToken: "xoxb-test" } } } as any;

describe("Slack plugin read action threadId", () => {
  it("passes threadId to handleSlackAction when provided", async () => {
    handleSlackAction.mockClear();

    await slackPlugin.actions!.handleAction!({
      action: "read" as any,
      params: {
        to: "C_CHANNEL_123",
        threadId: "1234567890.123456",
        limit: 10,
      },
      cfg,
      accountId: undefined,
      toolContext: undefined,
    } as any);

    expect(handleSlackAction).toHaveBeenCalledTimes(1);
    const callArgs = handleSlackAction.mock.calls[0] as unknown[];
    const params = callArgs[0] as Record<string, unknown>;
    expect(params.action).toBe("readMessages");
    expect(params.threadId).toBe("1234567890.123456");
  });

  it("does not include threadId when not provided", async () => {
    handleSlackAction.mockClear();

    await slackPlugin.actions!.handleAction!({
      action: "read" as any,
      params: {
        to: "C_CHANNEL_123",
        limit: 5,
      },
      cfg,
      accountId: undefined,
      toolContext: undefined,
    } as any);

    expect(handleSlackAction).toHaveBeenCalledTimes(1);
    const callArgs = handleSlackAction.mock.calls[0] as unknown[];
    const params = callArgs[0] as Record<string, unknown>;
    expect(params.action).toBe("readMessages");
    expect(params.threadId).toBeUndefined();
  });
});
