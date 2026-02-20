import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — MUST be before imports
// ---------------------------------------------------------------------------

const mockConnect = vi.fn();
const mockDisconnect = vi.fn();
const mockGetChannelMessages = vi.fn();
const mockGetAllChannelMessages = vi.fn();

vi.mock("./tg-client.js", () => ({
  resolveTgConfig: vi.fn(() => ({
    apiId: 12345,
    apiHash: "abc",
    session: "s",
    channels: ["@chan1"],
    maxMessages: 100,
  })),
  TelegramDigestClient: class MockClient {
    connect = mockConnect;
    disconnect = mockDisconnect;
    getChannelMessages = mockGetChannelMessages;
    getAllChannelMessages = mockGetAllChannelMessages;
  },
}));

vi.mock("./summarize.js", () => ({
  summarize: vi.fn(),
  formatFallback: vi.fn((_variant, cms) => {
    const msgs = cms.flatMap((cm: { messages: { text: string }[] }) => cm.messages);
    return msgs.length === 0
      ? "No messages found."
      : msgs.map((m: { text: string }, i: number) => `${i + 1}. ${m.text}`).join("\n");
  }),
}));

vi.mock("../../src/auto-reply/chunk.js", () => ({
  chunkMarkdownText: vi.fn((text: string, limit: number) => {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += limit) {
      chunks.push(text.slice(i, i + limit));
    }
    return chunks;
  }),
}));

import register from "./index.js";
import { summarize } from "./summarize.js";
// Import AFTER mocks
import { resolveTgConfig } from "./tg-client.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// oxlint-disable-next-line typescript/no-explicit-any
function fakeApi(overrides = {}): any {
  // oxlint-disable-next-line typescript/no-explicit-any
  const commands: Record<string, any> = {};
  return {
    id: "telegram-digest",
    name: "telegram-digest",
    source: "test",
    config: {},
    pluginConfig: {},
    runtime: { version: "test" },
    logger: { debug() {}, info() {}, warn() {}, error() {} },
    // oxlint-disable-next-line typescript/no-explicit-any
    registerCommand(def: any) {
      commands[def.name] = def;
    },
    _getCommand(name: string) {
      return commands[name];
    },
    ...overrides,
  };
}

// oxlint-disable-next-line typescript/no-explicit-any
function fakeCtx(args = "", overrides = {}): any {
  return {
    senderId: "user-1",
    channel: "telegram",
    isAuthorizedSender: true,
    args,
    commandBody: `/tg_digest ${args}`,
    config: {},
    ...overrides,
  };
}

function makeMessage(id: number, text: string) {
  return {
    id,
    channel: "@chan1",
    date: new Date(),
    text,
    views: 100,
    forwards: 5,
    replies: 10,
    reactions: 20,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("telegram-digest commands", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Restore default mock behavior after each test
    // oxlint-disable-next-line typescript/no-explicit-any
    (resolveTgConfig as any).mockReturnValue({
      apiId: 12345,
      apiHash: "abc",
      session: "s",
      channels: ["@chan1"],
      maxMessages: 100,
    });
  });

  // ── Registration ──────────────────────────────────────────────────

  it("registers all 4 commands", () => {
    const api = fakeApi();
    register(api);
    expect(api._getCommand("tg_digest")).toBeDefined();
    expect(api._getCommand("tg_channel")).toBeDefined();
    expect(api._getCommand("tg_topics")).toBeDefined();
    expect(api._getCommand("tg_top")).toBeDefined();
  });

  it("all commands have requireAuth: true", () => {
    const api = fakeApi();
    register(api);
    for (const name of ["tg_digest", "tg_channel", "tg_topics", "tg_top"]) {
      expect(api._getCommand(name).requireAuth).toBe(true);
    }
  });

  // ── /tg_digest ────────────────────────────────────────────────────

  it("tg_digest returns summary", async () => {
    const msgs = [makeMessage(1, "Hello"), makeMessage(2, "World")];
    mockGetAllChannelMessages.mockResolvedValueOnce([{ channel: "@chan1", messages: msgs }]);
    // oxlint-disable-next-line typescript/no-explicit-any
    (summarize as any).mockResolvedValueOnce("Digest summary");

    const api = fakeApi();
    register(api);
    const result = await api._getCommand("tg_digest").handler(fakeCtx("7d"));
    expect(result.text).toBe("Digest summary");
  });

  it("tg_digest returns no-messages text when empty", async () => {
    mockGetAllChannelMessages.mockResolvedValueOnce([{ channel: "@chan1", messages: [] }]);

    const api = fakeApi();
    register(api);
    const result = await api._getCommand("tg_digest").handler(fakeCtx());
    expect(result.text).toContain("No messages found");
  });

  it("tg_digest handles config error", async () => {
    // oxlint-disable-next-line typescript/no-explicit-any
    (resolveTgConfig as any).mockImplementation(() => {
      throw new Error("TELEGRAM_API_ID environment variable is required.");
    });

    const api = fakeApi();
    register(api);
    const result = await api._getCommand("tg_digest").handler(fakeCtx());
    expect(result.text).toContain("TELEGRAM_API_ID");
  });

  // ── /tg_channel ──────────────────────────────────────────────────

  it("tg_channel returns error when no channel specified", async () => {
    const api = fakeApi();
    register(api);
    const result = await api._getCommand("tg_channel").handler(fakeCtx(""));
    expect(result.text).toContain("specify a channel name");
  });

  it("tg_channel returns summary for specific channel", async () => {
    mockGetChannelMessages.mockResolvedValueOnce([makeMessage(1, "Channel post")]);
    // oxlint-disable-next-line typescript/no-explicit-any
    (summarize as any).mockResolvedValueOnce("Channel summary");

    const api = fakeApi();
    register(api);
    const result = await api._getCommand("tg_channel").handler(fakeCtx("@durov 3d"));
    expect(result.text).toBe("Channel summary");
  });

  it("tg_channel returns empty message for no posts", async () => {
    mockGetChannelMessages.mockResolvedValueOnce([]);

    const api = fakeApi();
    register(api);
    const result = await api._getCommand("tg_channel").handler(fakeCtx("@durov"));
    expect(result.text).toContain("No messages found");
  });

  // ── /tg_topics ────────────────────────────────────────────────────

  it("tg_topics returns topic analysis", async () => {
    mockGetAllChannelMessages.mockResolvedValueOnce([
      { channel: "@chan1", messages: [makeMessage(1, "AI news")] },
    ]);
    // oxlint-disable-next-line typescript/no-explicit-any
    (summarize as any).mockResolvedValueOnce("Topics analysis");

    const api = fakeApi();
    register(api);
    const result = await api._getCommand("tg_topics").handler(fakeCtx("1w"));
    expect(result.text).toBe("Topics analysis");
  });

  // ── /tg_top ───────────────────────────────────────────────────────

  it("tg_top returns top posts sorted by engagement", async () => {
    const lowEngagement = makeMessage(1, "Low");
    lowEngagement.views = 10;
    lowEngagement.forwards = 0;
    lowEngagement.replies = 0;
    lowEngagement.reactions = 0;

    const highEngagement = makeMessage(2, "High");
    highEngagement.views = 10000;
    highEngagement.forwards = 500;
    highEngagement.replies = 200;
    highEngagement.reactions = 1000;

    mockGetAllChannelMessages.mockResolvedValueOnce([
      { channel: "@chan1", messages: [lowEngagement, highEngagement] },
    ]);
    // oxlint-disable-next-line typescript/no-explicit-any
    (summarize as any).mockResolvedValueOnce("Top posts");

    const api = fakeApi();
    register(api);
    const result = await api._getCommand("tg_top").handler(fakeCtx("5 7d"));
    expect(result.text).toBe("Top posts");
  });

  // ── Chunking ──────────────────────────────────────────────────────

  it("chunks long responses", async () => {
    mockGetAllChannelMessages.mockResolvedValueOnce([
      { channel: "@chan1", messages: [makeMessage(1, "msg")] },
    ]);
    const longText = "x".repeat(5000);
    // oxlint-disable-next-line typescript/no-explicit-any
    (summarize as any).mockResolvedValueOnce(longText);

    const api = fakeApi();
    register(api);
    const result = await api._getCommand("tg_digest").handler(fakeCtx());
    expect(result.text).toContain("Part 1/");
  });

  // ── Disconnect always called ──────────────────────────────────────

  it("disconnects client even on error", async () => {
    mockGetAllChannelMessages.mockRejectedValueOnce(new Error("network error"));

    const api = fakeApi();
    register(api);
    const result = await api._getCommand("tg_digest").handler(fakeCtx());
    expect(result.text).toContain("network error");
    expect(mockDisconnect).toHaveBeenCalled();
  });
});
