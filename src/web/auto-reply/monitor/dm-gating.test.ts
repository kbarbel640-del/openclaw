import { describe, expect, it } from "vitest";
import type { WebInboundMsg } from "../types.js";
import { applyDmGating, type DmHistoryEntry } from "./dm-gating.js";

function makeCfg(agentName?: string) {
  return {
    agents: agentName ? { list: [{ id: "main", identity: { name: agentName } }] } : undefined,
  } as unknown as ReturnType<typeof import("../../../config/config.js").loadConfig>;
}

function makeMsg(overrides: Partial<WebInboundMsg> = {}): WebInboundMsg {
  return {
    from: "+15551234567",
    conversationId: "+15551234567",
    to: "+15559999999",
    accountId: "default",
    body: "ciao",
    chatType: "direct",
    chatId: "+15551234567@s.whatsapp.net",
    sendComposing: async () => {},
    reply: async () => {},
    sendMedia: async () => {},
    ...overrides,
  } as WebInboundMsg;
}

describe("applyDmGating", () => {
  it("always processes inbound messages (fromMe=false)", () => {
    const dmHistories = new Map<string, DmHistoryEntry[]>();
    const result = applyDmGating({
      cfg: makeCfg("Pepper"),
      msg: makeMsg({ fromMe: false, body: "ciao" }),
      dmHistoryKey: "test-key",
      agentId: "main",
      dmHistories,
      dmHistoryLimit: 20,
      logVerbose: () => {},
    });
    expect(result.shouldProcess).toBe(true);
  });

  it("always processes inbound messages even without fromMe set", () => {
    const dmHistories = new Map<string, DmHistoryEntry[]>();
    const result = applyDmGating({
      cfg: makeCfg("Pepper"),
      msg: makeMsg({ fromMe: undefined, body: "ciao" }),
      dmHistoryKey: "test-key",
      agentId: "main",
      dmHistories,
      dmHistoryLimit: 20,
      logVerbose: () => {},
    });
    expect(result.shouldProcess).toBe(true);
  });

  it("buffers outbound messages that don't mention the agent", () => {
    const dmHistories = new Map<string, DmHistoryEntry[]>();
    const result = applyDmGating({
      cfg: makeCfg("Pepper"),
      msg: makeMsg({ fromMe: true, body: "mando la mail a tutti e due" }),
      dmHistoryKey: "test-key",
      agentId: "main",
      dmHistories,
      dmHistoryLimit: 20,
      logVerbose: () => {},
    });
    expect(result.shouldProcess).toBe(false);
    expect(dmHistories.get("test-key")).toHaveLength(1);
    expect(dmHistories.get("test-key")![0].body).toBe("mando la mail a tutti e due");
    expect(dmHistories.get("test-key")![0].fromMe).toBe(true);
  });

  it("processes outbound messages that mention the agent name", () => {
    const dmHistories = new Map<string, DmHistoryEntry[]>();
    const result = applyDmGating({
      cfg: makeCfg("Pepper"),
      msg: makeMsg({ fromMe: true, body: "Pepper dimmi il meteo" }),
      dmHistoryKey: "test-key",
      agentId: "main",
      dmHistories,
      dmHistoryLimit: 20,
      logVerbose: () => {},
    });
    expect(result.shouldProcess).toBe(true);
  });

  it("returns buffered history when processing an inbound message", () => {
    const dmHistories = new Map<string, DmHistoryEntry[]>();
    dmHistories.set("test-key", [
      { sender: "Fabrizio", body: "mando la mail", timestamp: 1000, fromMe: true },
      { sender: "Fabrizio", body: "fammi sapere", timestamp: 2000, fromMe: true },
    ]);

    const result = applyDmGating({
      cfg: makeCfg("Pepper"),
      msg: makeMsg({ fromMe: false, body: "ok perfetto" }),
      dmHistoryKey: "test-key",
      agentId: "main",
      dmHistories,
      dmHistoryLimit: 20,
      logVerbose: () => {},
    });
    expect(result.shouldProcess).toBe(true);
    expect(result.dmHistory).toHaveLength(2);
    expect(result.dmHistory![0].body).toBe("mando la mail");
    expect(result.dmHistory![1].body).toBe("fammi sapere");
  });

  it("returns buffered history when owner mentions the agent", () => {
    const dmHistories = new Map<string, DmHistoryEntry[]>();
    dmHistories.set("test-key", [
      { sender: "Fabrizio", body: "sto mandando la mail", timestamp: 1000, fromMe: true },
    ]);

    const result = applyDmGating({
      cfg: makeCfg("Pepper"),
      msg: makeMsg({ fromMe: true, body: "Pepper riassumi" }),
      dmHistoryKey: "test-key",
      agentId: "main",
      dmHistories,
      dmHistoryLimit: 20,
      logVerbose: () => {},
    });
    expect(result.shouldProcess).toBe(true);
    expect(result.dmHistory).toHaveLength(1);
    expect(result.dmHistory![0].body).toBe("sto mandando la mail");
  });

  it("returns undefined dmHistory when buffer is empty", () => {
    const dmHistories = new Map<string, DmHistoryEntry[]>();
    const result = applyDmGating({
      cfg: makeCfg("Pepper"),
      msg: makeMsg({ fromMe: false, body: "ciao" }),
      dmHistoryKey: "test-key",
      agentId: "main",
      dmHistories,
      dmHistoryLimit: 20,
      logVerbose: () => {},
    });
    expect(result.shouldProcess).toBe(true);
    expect(result.dmHistory).toBeUndefined();
  });

  it("respects dmHistoryLimit when buffering", () => {
    const dmHistories = new Map<string, DmHistoryEntry[]>();
    const limit = 2;

    for (let i = 0; i < 5; i++) {
      applyDmGating({
        cfg: makeCfg("Pepper"),
        msg: makeMsg({ fromMe: true, body: `message ${i}` }),
        dmHistoryKey: "test-key",
        agentId: "main",
        dmHistories,
        dmHistoryLimit: limit,
        logVerbose: () => {},
      });
    }

    const entries = dmHistories.get("test-key")!;
    expect(entries).toHaveLength(2);
    // Should keep the most recent entries
    expect(entries[0].body).toBe("message 3");
    expect(entries[1].body).toBe("message 4");
  });

  it("mention detection is case-insensitive", () => {
    const dmHistories = new Map<string, DmHistoryEntry[]>();
    const result = applyDmGating({
      cfg: makeCfg("Pepper"),
      msg: makeMsg({ fromMe: true, body: "pepper come stai?" }),
      dmHistoryKey: "test-key",
      agentId: "main",
      dmHistories,
      dmHistoryLimit: 20,
      logVerbose: () => {},
    });
    expect(result.shouldProcess).toBe(true);
  });

  it("returns a snapshot of history (not a reference)", () => {
    const dmHistories = new Map<string, DmHistoryEntry[]>();
    dmHistories.set("test-key", [
      { sender: "Fabrizio", body: "test", timestamp: 1000, fromMe: true },
    ]);

    const result = applyDmGating({
      cfg: makeCfg("Pepper"),
      msg: makeMsg({ fromMe: false, body: "ciao" }),
      dmHistoryKey: "test-key",
      agentId: "main",
      dmHistories,
      dmHistoryLimit: 20,
      logVerbose: () => {},
    });

    // Mutating the returned history should not affect the internal buffer
    result.dmHistory!.push({ sender: "x", body: "y", fromMe: false });
    expect(dmHistories.get("test-key")).toHaveLength(1);
  });
});
