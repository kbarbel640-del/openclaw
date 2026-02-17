import { describe, expect, it } from "vitest";
import { buildReplyPayloads } from "./agent-runner-payloads.js";

describe("buildReplyPayloads", () => {
  const mockPipeline = (streamed: boolean) =>
    ({
      didStream: () => streamed,
      isAborted: () => false,
      hasSentPayload: () => false,
    }) as Parameters<typeof buildReplyPayloads>[0]["blockReplyPipeline"];

  it("preserves error payloads when block streaming drops finals", () => {
    const result = buildReplyPayloads({
      payloads: [
        { text: "Here is my reply." },
        { text: "⚠️ exec failed: No such file", isError: true },
      ],
      isHeartbeat: false,
      didLogHeartbeatStrip: false,
      blockStreamingEnabled: true,
      blockReplyPipeline: mockPipeline(true),
      replyToMode: "first",
    });

    // Non-error payload dropped (already streamed via blocks), error payload preserved
    expect(result.replyPayloads).toHaveLength(1);
    expect(result.replyPayloads[0]?.isError).toBe(true);
    expect(result.replyPayloads[0]?.text).toContain("exec failed");
  });

  it("drops all non-error finals when block streaming succeeded", () => {
    const result = buildReplyPayloads({
      payloads: [{ text: "Here is my reply." }],
      isHeartbeat: false,
      didLogHeartbeatStrip: false,
      blockStreamingEnabled: true,
      blockReplyPipeline: mockPipeline(true),
      replyToMode: "first",
    });

    expect(result.replyPayloads).toHaveLength(0);
  });

  it("keeps all payloads when block streaming is disabled", () => {
    const result = buildReplyPayloads({
      payloads: [
        { text: "Here is my reply." },
        { text: "⚠️ exec failed: No such file", isError: true },
      ],
      isHeartbeat: false,
      didLogHeartbeatStrip: false,
      blockStreamingEnabled: false,
      blockReplyPipeline: null,
      replyToMode: "first",
    });

    expect(result.replyPayloads).toHaveLength(2);
  });
});
