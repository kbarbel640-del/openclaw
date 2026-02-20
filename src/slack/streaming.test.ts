import type { WebClient } from "@slack/web-api";
import { describe, expect, it, vi } from "vitest";
import { startSlackStream } from "./streaming.js";

function createMockClient() {
  const streamer = {
    append: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
  };
  const chatStream = vi.fn().mockReturnValue(streamer);
  const client = { chatStream } as unknown as WebClient;
  return { client, chatStream, streamer };
}

describe("startSlackStream", () => {
  it("passes team/user context to Slack chatStream when provided", async () => {
    const { client, chatStream, streamer } = createMockClient();

    await startSlackStream({
      client,
      channel: "C123",
      threadTs: "1700000000.100",
      teamId: "T123",
      userId: "U123",
      text: "hello",
    });

    expect(chatStream).toHaveBeenCalledWith({
      channel: "C123",
      thread_ts: "1700000000.100",
      recipient_team_id: "T123",
      recipient_user_id: "U123",
    });
    expect(streamer.append).toHaveBeenCalledWith({ markdown_text: "hello" });
  });

  it("omits recipient fields when they are not provided", async () => {
    const { client, chatStream } = createMockClient();

    await startSlackStream({
      client,
      channel: "C999",
      threadTs: "1700000000.200",
    });

    expect(chatStream).toHaveBeenCalledWith({
      channel: "C999",
      thread_ts: "1700000000.200",
    });
  });
});
