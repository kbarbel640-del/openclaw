import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — MUST be before imports
// ---------------------------------------------------------------------------

const mockGetMessages = vi.fn();
const mockConnect = vi.fn();
const mockDisconnect = vi.fn();

vi.mock("telegram", () => ({
  TelegramClient: class MockTelegramClient {
    connect = mockConnect;
    disconnect = mockDisconnect;
    getMessages = mockGetMessages;
    // oxlint-disable-next-line typescript/no-explicit-any
    constructor(..._args: any[]) {}
  },
}));

vi.mock("telegram/sessions/index.js", () => ({
  StringSession: class MockStringSession {
    // oxlint-disable-next-line typescript/no-explicit-any
    constructor(public session: any) {}
  },
}));

import type { TgConfig } from "./types.js";
// Import AFTER mocks
import { resolveTgConfig, TelegramDigestClient } from "./tg-client.js";

// ---------------------------------------------------------------------------
// resolveTgConfig
// ---------------------------------------------------------------------------

describe("resolveTgConfig", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("throws when TELEGRAM_API_ID is missing", () => {
    delete process.env.TELEGRAM_API_ID;
    expect(() => resolveTgConfig()).toThrow("TELEGRAM_API_ID");
  });

  it("throws when TELEGRAM_API_HASH is missing", () => {
    process.env.TELEGRAM_API_ID = "12345";
    delete process.env.TELEGRAM_API_HASH;
    expect(() => resolveTgConfig()).toThrow("TELEGRAM_API_HASH");
  });

  it("throws when TELEGRAM_SESSION is missing", () => {
    process.env.TELEGRAM_API_ID = "12345";
    process.env.TELEGRAM_API_HASH = "abc123";
    delete process.env.TELEGRAM_SESSION;
    expect(() => resolveTgConfig()).toThrow("TELEGRAM_SESSION");
  });

  it("resolves config from env vars", () => {
    process.env.TELEGRAM_API_ID = "12345";
    process.env.TELEGRAM_API_HASH = "abc123";
    process.env.TELEGRAM_SESSION = "session-token";
    process.env.TELEGRAM_CHANNELS = "@chan1, @chan2";

    const config = resolveTgConfig();
    expect(config).toEqual({
      apiId: 12345,
      apiHash: "abc123",
      session: "session-token",
      channels: ["@chan1", "@chan2"],
      maxMessages: 100,
    });
  });

  it("prefers plugin config channels over env", () => {
    process.env.TELEGRAM_API_ID = "12345";
    process.env.TELEGRAM_API_HASH = "abc123";
    process.env.TELEGRAM_SESSION = "session-token";
    process.env.TELEGRAM_CHANNELS = "@env_chan";

    const config = resolveTgConfig({ channels: ["@plugin_chan"] });
    expect(config.channels).toEqual(["@plugin_chan"]);
  });

  it("uses plugin maxMessages override", () => {
    process.env.TELEGRAM_API_ID = "12345";
    process.env.TELEGRAM_API_HASH = "abc123";
    process.env.TELEGRAM_SESSION = "session-token";

    const config = resolveTgConfig({ maxMessages: 50 });
    expect(config.maxMessages).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// TelegramDigestClient
// ---------------------------------------------------------------------------

describe("TelegramDigestClient", () => {
  const testConfig: TgConfig = {
    apiId: 12345,
    apiHash: "abc123",
    session: "test-session",
    channels: ["@chan1", "@chan2"],
    maxMessages: 100,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("connects and disconnects", async () => {
    const client = new TelegramDigestClient(testConfig);
    await client.connect();
    expect(mockConnect).toHaveBeenCalledOnce();

    await client.disconnect();
    expect(mockDisconnect).toHaveBeenCalledOnce();
  });

  it("throws when getChannelMessages called without connect", async () => {
    const client = new TelegramDigestClient(testConfig);
    await expect(client.getChannelMessages("@chan", 86400000)).rejects.toThrow(
      "Client not connected",
    );
  });

  it("fetches and parses messages from a channel", async () => {
    const now = Math.floor(Date.now() / 1000);
    mockGetMessages.mockResolvedValueOnce([
      {
        id: 1,
        date: now - 3600, // 1 hour ago
        message: "Hello world",
        views: 100,
        forwards: 5,
        replies: { replies: 10 },
        reactions: { results: [{ count: 20 }, { count: 15 }] },
      },
      {
        id: 2,
        date: now - 200000, // ~2.3 days ago — outside 1d window
        message: "Old message",
        views: 50,
        forwards: 1,
        replies: null,
        reactions: null,
      },
    ]);

    const client = new TelegramDigestClient(testConfig);
    await client.connect();

    const messages = await client.getChannelMessages("@chan", 86400000); // 1 day
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      id: 1,
      channel: "@chan",
      text: "Hello world",
      views: 100,
      forwards: 5,
      replies: 10,
      reactions: 35,
    });
  });

  it("fetches messages from all channels", async () => {
    const now = Math.floor(Date.now() / 1000);
    const fakeMsg = {
      id: 1,
      date: now - 100,
      message: "Test",
      views: 10,
      forwards: 0,
      replies: null,
      reactions: null,
    };

    mockGetMessages.mockResolvedValue([fakeMsg]);

    const client = new TelegramDigestClient(testConfig);
    await client.connect();

    const results = await client.getAllChannelMessages(86400000);
    expect(results).toHaveLength(2);
    expect(results[0]!.channel).toBe("@chan1");
    expect(results[1]!.channel).toBe("@chan2");
    expect(mockGetMessages).toHaveBeenCalledTimes(2);
  });

  it("skips messages with no text", async () => {
    const now = Math.floor(Date.now() / 1000);
    mockGetMessages.mockResolvedValueOnce([
      { id: 1, date: now - 100, message: "", views: 0, forwards: 0 },
      { id: 2, date: now - 100, message: "Has text", views: 0, forwards: 0 },
    ]);

    const client = new TelegramDigestClient(testConfig);
    await client.connect();

    const messages = await client.getChannelMessages("@chan", 86400000);
    expect(messages).toHaveLength(1);
    expect(messages[0]!.text).toBe("Has text");
  });

  it("wraps gramjs errors with channel context", async () => {
    mockGetMessages.mockRejectedValueOnce(new Error("FLOOD_WAIT_30"));

    const client = new TelegramDigestClient(testConfig);
    await client.connect();

    await expect(client.getChannelMessages("@chan", 86400000)).rejects.toThrow(
      "Failed to fetch messages from @chan",
    );
  });
});
