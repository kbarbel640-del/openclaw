import fsp from "node:fs/promises";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { loadRecentSessionContext, extractModelLabel } from "./recent-context.js";

vi.mock("node:fs/promises", () => ({
  default: {
    stat: vi.fn(),
    readFile: vi.fn(),
    open: vi.fn(),
  },
}));

const mockStat = vi.mocked(fsp.stat);
const mockReadFile = vi.mocked(fsp.readFile);

function makeJsonlLines(
  entries: Array<{
    role: "user" | "assistant";
    content: string | Array<{ type: string; text: string }>;
    model?: string;
  }>,
): string {
  const header = JSON.stringify({ type: "session", version: 1, id: "test-session" });
  const messages = entries.map((e) =>
    JSON.stringify({
      type: "message",
      message: {
        role: e.role,
        content: e.content,
        ...(e.model ? { model: e.model } : {}),
      },
    }),
  );
  return [header, ...messages].join("\n") + "\n";
}

describe("extractModelLabel", () => {
  it("extracts known model names", () => {
    expect(extractModelLabel("us.anthropic.claude-haiku-4-5-20251001-v1:0")).toBe("haiku");
    expect(extractModelLabel("anthropic/claude-sonnet-4-5")).toBe("sonnet");
    expect(extractModelLabel("claude-opus-4-6")).toBe("opus");
    expect(extractModelLabel("gpt-4o-mini")).toBe("gpt-4o-mini");
    expect(extractModelLabel("gpt-4o")).toBe("gpt-4o");
    expect(extractModelLabel("deepseek-chat")).toBe("deepseek");
  });

  it("truncates unknown model IDs", () => {
    expect(extractModelLabel("some-very-long-unknown-model-id-that-exceeds-limit")).toBe(
      "some-very-long-unkno\u2026",
    );
  });

  it("returns short unknown model IDs as-is", () => {
    expect(extractModelLabel("custom-model")).toBe("custom-model");
  });

  it("returns undefined for undefined input", () => {
    expect(extractModelLabel(undefined)).toBeUndefined();
  });
});

describe("loadRecentSessionContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns undefined when file does not exist", async () => {
    mockStat.mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));

    const result = await loadRecentSessionContext({ sessionFile: "/missing.jsonl" });
    expect(result).toBeUndefined();
  });

  it("returns undefined for empty file", async () => {
    mockStat.mockResolvedValue({ size: 0 } as never);

    const result = await loadRecentSessionContext({ sessionFile: "/empty.jsonl" });
    expect(result).toBeUndefined();
  });

  it("returns undefined when fewer than 2 messages", async () => {
    const content = makeJsonlLines([{ role: "user", content: "hello" }]);
    mockStat.mockResolvedValue({ size: content.length } as never);
    mockReadFile.mockResolvedValue(content);

    const result = await loadRecentSessionContext({ sessionFile: "/one-msg.jsonl" });
    expect(result).toBeUndefined();
  });

  it("formats user and assistant messages correctly", async () => {
    const content = makeJsonlLines([
      { role: "user", content: "How do I debug the cache?" },
      {
        role: "assistant",
        content: "Let me look at the cache invalidation logic.",
        model: "anthropic/claude-sonnet-4-5",
      },
      { role: "user", content: "yes" },
    ]);
    mockStat.mockResolvedValue({ size: content.length } as never);
    mockReadFile.mockResolvedValue(content);

    const result = await loadRecentSessionContext({ sessionFile: "/test.jsonl" });
    expect(result).toBeDefined();
    expect(result).toContain("Recent conversation:");
    expect(result).toContain("User: How do I debug the cache?");
    expect(result).toContain("Assistant [sonnet]: Let me look at the cache invalidation logic.");
    expect(result).toContain("User: yes");
  });

  it("handles array-of-blocks content format", async () => {
    const content = makeJsonlLines([
      { role: "user", content: "explain this" },
      {
        role: "assistant",
        content: [{ type: "text", text: "Here is the explanation." }],
        model: "claude-haiku-4-5",
      },
    ]);
    mockStat.mockResolvedValue({ size: content.length } as never);
    mockReadFile.mockResolvedValue(content);

    const result = await loadRecentSessionContext({ sessionFile: "/test.jsonl" });
    expect(result).toContain("Assistant [haiku]: Here is the explanation.");
  });

  it("truncates long messages to configured limit", async () => {
    const longText = "A".repeat(300);
    const content = makeJsonlLines([
      { role: "user", content: longText },
      { role: "assistant", content: "short reply", model: "claude-sonnet-4-5" },
    ]);
    mockStat.mockResolvedValue({ size: content.length } as never);
    mockReadFile.mockResolvedValue(content);

    const result = await loadRecentSessionContext({
      sessionFile: "/test.jsonl",
      truncateChars: 50,
    });
    expect(result).toBeDefined();
    // Should contain truncated text: 50 chars + "..."
    expect(result).toContain("A".repeat(50) + "...");
    expect(result).not.toContain("A".repeat(51));
  });

  it("limits number of messages returned", async () => {
    const content = makeJsonlLines([
      { role: "user", content: "msg 1" },
      { role: "assistant", content: "reply 1", model: "claude-haiku-4-5" },
      { role: "user", content: "msg 2" },
      { role: "assistant", content: "reply 2", model: "claude-haiku-4-5" },
      { role: "user", content: "msg 3" },
      { role: "assistant", content: "reply 3", model: "claude-haiku-4-5" },
    ]);
    mockStat.mockResolvedValue({ size: content.length } as never);
    mockReadFile.mockResolvedValue(content);

    const result = await loadRecentSessionContext({
      sessionFile: "/test.jsonl",
      messageCount: 2,
    });
    expect(result).toBeDefined();
    // Should only contain the last 2 messages
    expect(result).not.toContain("msg 2");
    expect(result).toContain("User: msg 3");
    expect(result).toContain("Assistant [haiku]: reply 3");
  });

  it("skips non-message entries (session headers, custom records)", async () => {
    const lines = [
      JSON.stringify({ type: "session", version: 1, id: "test" }),
      JSON.stringify({ type: "custom", customType: "model-snapshot", data: {} }),
      JSON.stringify({ type: "message", message: { role: "user", content: "hello" } }),
      JSON.stringify({ type: "custom", customType: "tool-result", data: {} }),
      JSON.stringify({
        type: "message",
        message: { role: "assistant", content: "hi there", model: "claude-haiku-4-5" },
      }),
    ].join("\n");

    mockStat.mockResolvedValue({ size: lines.length } as never);
    mockReadFile.mockResolvedValue(lines);

    const result = await loadRecentSessionContext({ sessionFile: "/test.jsonl" });
    expect(result).toBeDefined();
    expect(result).toContain("User: hello");
    expect(result).toContain("Assistant [haiku]: hi there");
    expect(result).not.toContain("model-snapshot");
    expect(result).not.toContain("tool-result");
  });

  it("handles malformed JSON lines gracefully", async () => {
    const lines = [
      JSON.stringify({ type: "session", version: 1 }),
      "this is not json",
      JSON.stringify({ type: "message", message: { role: "user", content: "msg 1" } }),
      "{broken json",
      JSON.stringify({
        type: "message",
        message: { role: "assistant", content: "reply 1", model: "claude-sonnet-4-5" },
      }),
    ].join("\n");

    mockStat.mockResolvedValue({ size: lines.length } as never);
    mockReadFile.mockResolvedValue(lines);

    const result = await loadRecentSessionContext({ sessionFile: "/test.jsonl" });
    expect(result).toBeDefined();
    expect(result).toContain("User: msg 1");
    expect(result).toContain("Assistant [sonnet]: reply 1");
  });

  it("filters out /new greeting prompt and its assistant response", async () => {
    const lines = [
      JSON.stringify({ type: "session", version: 1, id: "test" }),
      JSON.stringify({
        type: "message",
        message: {
          role: "user",
          content:
            "A new session was started via /new or /reset. Greet the user in your configured persona.",
        },
      }),
      JSON.stringify({
        type: "message",
        message: {
          role: "assistant",
          content: "Hey! Fresh session, what are we doing?",
          model: "claude-sonnet-4-5",
        },
      }),
      JSON.stringify({
        type: "message",
        message: { role: "user", content: "debug my cache" },
      }),
      JSON.stringify({
        type: "message",
        message: {
          role: "assistant",
          content: "Let me look at the cache code.",
          model: "claude-sonnet-4-5",
        },
      }),
    ].join("\n");

    mockStat.mockResolvedValue({ size: lines.length } as never);
    mockReadFile.mockResolvedValue(lines);

    const result = await loadRecentSessionContext({ sessionFile: "/test.jsonl" });
    expect(result).toBeDefined();
    expect(result).not.toContain("new session was started");
    expect(result).not.toContain("Fresh session");
    expect(result).toContain("User: debug my cache");
    expect(result).toContain("Assistant [sonnet]: Let me look at the cache code.");
  });

  it("filters out compaction and gateway restart system messages", async () => {
    const lines = [
      JSON.stringify({ type: "session", version: 1, id: "test" }),
      JSON.stringify({
        type: "message",
        message: { role: "user", content: "hello" },
      }),
      JSON.stringify({
        type: "message",
        message: { role: "assistant", content: "hi there", model: "claude-sonnet-4-5" },
      }),
      JSON.stringify({
        type: "message",
        message: {
          role: "user",
          content: "Pre-compaction memory flush. Store durable memories now.",
        },
      }),
      JSON.stringify({
        type: "message",
        message: { role: "assistant", content: "NO_REPLY", model: "claude-sonnet-4-5" },
      }),
      JSON.stringify({
        type: "message",
        message: { role: "user", content: "GatewayRestart: {}" },
      }),
      JSON.stringify({
        type: "message",
        message: {
          role: "assistant",
          content: "Restart confirmed.",
          model: "claude-opus-4-6",
        },
      }),
      JSON.stringify({
        type: "message",
        message: { role: "user", content: "what were we doing?" },
      }),
      JSON.stringify({
        type: "message",
        message: {
          role: "assistant",
          content: "We were discussing caching.",
          model: "claude-sonnet-4-5",
        },
      }),
    ].join("\n");

    mockStat.mockResolvedValue({ size: lines.length } as never);
    mockReadFile.mockResolvedValue(lines);

    const result = await loadRecentSessionContext({ sessionFile: "/test.jsonl" });
    expect(result).toBeDefined();
    expect(result).toContain("User: hello");
    expect(result).toContain("User: what were we doing?");
    expect(result).not.toContain("Pre-compaction");
    expect(result).not.toContain("NO_REPLY");
    expect(result).not.toContain("GatewayRestart");
    expect(result).not.toContain("Restart confirmed");
  });

  it("returns undefined when only system messages remain after filtering", async () => {
    const lines = [
      JSON.stringify({ type: "session", version: 1, id: "test" }),
      JSON.stringify({
        type: "message",
        message: {
          role: "user",
          content: "A new session was started via /new or /reset. Greet the user.",
        },
      }),
      JSON.stringify({
        type: "message",
        message: {
          role: "assistant",
          content: "Hey! What's up?",
          model: "claude-sonnet-4-5",
        },
      }),
    ].join("\n");

    mockStat.mockResolvedValue({ size: lines.length } as never);
    mockReadFile.mockResolvedValue(lines);

    const result = await loadRecentSessionContext({ sessionFile: "/test.jsonl" });
    expect(result).toBeUndefined();
  });

  it("omits model label when assistant message has no model field", async () => {
    const content = makeJsonlLines([
      { role: "user", content: "test" },
      { role: "assistant", content: "response without model" },
    ]);
    mockStat.mockResolvedValue({ size: content.length } as never);
    mockReadFile.mockResolvedValue(content);

    const result = await loadRecentSessionContext({ sessionFile: "/test.jsonl" });
    expect(result).toContain("Assistant: response without model");
    expect(result).not.toContain("[");
  });
});
