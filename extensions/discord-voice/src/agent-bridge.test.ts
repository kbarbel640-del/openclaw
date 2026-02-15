import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentBridge, type MessageHandler } from "./agent-bridge.js";

type TestLogger = {
  info: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  debug: ReturnType<typeof vi.fn>;
};

const createLogger = (): TestLogger => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
});

describe("AgentBridge", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("getSessionKey generates correct format", () => {
    expect(AgentBridge.getSessionKey("guild-1", "channel-2")).toBe(
      "discord:voice:guild-1:channel-2",
    );
  });

  it("getSessionKey is deterministic", () => {
    const first = AgentBridge.getSessionKey("guild-x", "channel-y");
    const second = AgentBridge.getSessionKey("guild-x", "channel-y");

    expect(first).toBe(second);
  });

  it("processUtterance returns null for empty text", async () => {
    const bridge = new AgentBridge({}, createLogger());

    await expect(
      bridge.processUtterance({
        text: "",
        userId: "u1",
        userName: "Ada",
        guildId: "g1",
        channelId: "c1",
      }),
    ).resolves.toBeNull();
  });

  it("processUtterance returns null for whitespace-only text", async () => {
    const bridge = new AgentBridge({}, createLogger());

    await expect(
      bridge.processUtterance({
        text: "   \n\t  ",
        userId: "u1",
        userName: "Ada",
        guildId: "g1",
        channelId: "c1",
      }),
    ).resolves.toBeNull();
  });

  it("processUtterance formats message with speaker name", async () => {
    const logger = createLogger();
    const bridge = new AgentBridge({}, logger);
    const handler: MessageHandler = vi.fn(async () => ({ text: "ok" }));
    bridge.setMessageHandler(handler);

    await bridge.processUtterance({
      text: "hello there",
      userId: "u1",
      userName: "Ada",
      guildId: "g1",
      channelId: "c1",
    });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "[Voice] Ada: hello there",
      }),
    );
  });

  it("processUtterance calls handler with correct params", async () => {
    const bridge = new AgentBridge({}, createLogger());
    const handler: MessageHandler = vi.fn(async () => ({ text: "ok" }));
    bridge.setMessageHandler(handler);

    await bridge.processUtterance({
      text: "ping",
      userId: "u-42",
      userName: "Grace",
      guildId: "g-7",
      channelId: "c-9",
    });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({
      text: "[Voice] Grace: ping",
      sessionKey: "discord:voice:g-7:c-9",
      userId: "u-42",
      userName: "Grace",
      channelId: "c-9",
      guildId: "g-7",
    });
  });

  it("processUtterance returns agent response", async () => {
    const bridge = new AgentBridge({}, createLogger());
    bridge.setMessageHandler(async () => ({ text: "Agent reply" }));

    await expect(
      bridge.processUtterance({
        text: "question",
        userId: "u1",
        userName: "Ada",
        guildId: "g1",
        channelId: "c1",
      }),
    ).resolves.toEqual({
      text: "Agent reply",
      sessionKey: "discord:voice:g1:c1",
    });
  });

  it("processUtterance returns null when handler returns null", async () => {
    const bridge = new AgentBridge({}, createLogger());
    bridge.setMessageHandler(async () => null);

    await expect(
      bridge.processUtterance({
        text: "question",
        userId: "u1",
        userName: "Ada",
        guildId: "g1",
        channelId: "c1",
      }),
    ).resolves.toBeNull();
  });

  it("processUtterance returns null on timeout", async () => {
    vi.useFakeTimers();

    const bridge = new AgentBridge({ responseTimeoutMs: 10 }, createLogger());
    bridge.setMessageHandler(async () => {
      await new Promise(() => {
        // Intentionally unresolved to exercise timeout path.
      });
      return { text: "never" };
    });

    const pending = bridge.processUtterance({
      text: "question",
      userId: "u1",
      userName: "Ada",
      guildId: "g1",
      channelId: "c1",
    });

    await vi.advanceTimersByTimeAsync(11);
    await expect(pending).resolves.toBeNull();
  });

  it("processUtterance returns null when no handler set", async () => {
    const bridge = new AgentBridge({}, createLogger());

    await expect(
      bridge.processUtterance({
        text: "hello",
        userId: "u1",
        userName: "Ada",
        guildId: "g1",
        channelId: "c1",
      }),
    ).resolves.toBeNull();
  });
});
