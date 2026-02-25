import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearSessionStoreCacheForTest } from "../config/sessions.js";
import type { TelegramExecApprovalConfig } from "../config/types.telegram.js";
import {
  buildExecApprovalCallbackData,
  extractTelegramChatId,
  isExecApprovalCallbackData,
  parseExecApprovalCallbackData,
  TelegramExecApprovalHandler,
  type ExecApprovalRequest,
} from "./exec-approvals.js";

const STORE_PATH = path.join(os.tmpdir(), "openclaw-telegram-exec-approvals-test.json");

const writeStore = (store: Record<string, unknown>) => {
  fs.writeFileSync(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  clearSessionStoreCacheForTest();
};

beforeEach(() => {
  writeStore({});
});

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockSendMessage = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ messageId: "100", chatId: "999" }),
);
const mockEditMessage = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ ok: true, messageId: "100", chatId: "999" }),
);
const mockDeleteMessage = vi.hoisted(() => vi.fn().mockResolvedValue({ ok: true }));

vi.mock("./send.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./send.js")>();
  return {
    ...actual,
    sendMessageTelegram: mockSendMessage,
    editMessageTelegram: mockEditMessage,
    deleteMessageTelegram: mockDeleteMessage,
  };
});

vi.mock("../gateway/client.js", () => ({
  GatewayClient: class {
    private params: Record<string, unknown>;
    constructor(params: Record<string, unknown>) {
      this.params = params;
    }
    start() {}
    stop() {}
    async request() {
      return { ok: true };
    }
  },
}));

vi.mock("../logging/subsystem.js", () => ({
  createSubsystemLogger: () => ({
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  }),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createHandler(config: TelegramExecApprovalConfig, accountId = "default") {
  return new TelegramExecApprovalHandler({
    token: "test-token",
    accountId,
    config,
    cfg: { session: { store: STORE_PATH } },
  });
}

type HandlerInternals = TelegramExecApprovalHandler & {
  pending: Map<
    number,
    {
      telegramMessageId: string;
      telegramChatId: string;
      approvalId: string;
      timeoutId: NodeJS.Timeout;
    }
  >;
  approvalCounters: Map<string, Set<number>>;
  requestCache: Map<string, ExecApprovalRequest>;
  counterSeq: number;
  handleApprovalRequested: (request: ExecApprovalRequest) => Promise<void>;
  handleApprovalResolved: (resolved: {
    id: string;
    decision: string;
    resolvedBy?: string | null;
    ts: number;
  }) => Promise<void>;
  handleApprovalTimeout: (counter: number) => Promise<void>;
};

function getInternals(handler: TelegramExecApprovalHandler): HandlerInternals {
  return handler as unknown as HandlerInternals;
}

function clearPendingTimeouts(handler: TelegramExecApprovalHandler) {
  const internals = getInternals(handler);
  for (const entry of internals.pending.values()) {
    clearTimeout(entry.timeoutId);
  }
  internals.pending.clear();
}

function createRequest(
  overrides: Partial<ExecApprovalRequest["request"]> = {},
): ExecApprovalRequest {
  return {
    id: "test-id",
    request: {
      command: "echo hello",
      cwd: "/home/user",
      host: "gateway",
      agentId: "test-agent",
      sessionKey: "agent:test-agent:telegram:channel:999888777",
      ...overrides,
    },
    createdAtMs: Date.now(),
    expiresAtMs: Date.now() + 60000,
  };
}

// ─── buildExecApprovalCallbackData ────────────────────────────────────────────

describe("buildExecApprovalCallbackData", () => {
  it("encodes counter and action", () => {
    expect(buildExecApprovalCallbackData(42, "allow-once")).toBe("ea:42:ao");
  });

  it("encodes allow-always", () => {
    expect(buildExecApprovalCallbackData(1, "allow-always")).toBe("ea:1:aa");
  });

  it("encodes deny", () => {
    expect(buildExecApprovalCallbackData(99999, "deny")).toBe("ea:99999:d");
  });

  it("all callback data values are under 64 bytes", () => {
    for (const action of ["allow-once", "allow-always", "deny"] as const) {
      const data = buildExecApprovalCallbackData(99999, action);
      expect(Buffer.byteLength(data, "utf8")).toBeLessThanOrEqual(64);
    }
  });
});

// ─── isExecApprovalCallbackData ───────────────────────────────────────────────

describe("isExecApprovalCallbackData", () => {
  it("returns true for ea: prefix", () => {
    expect(isExecApprovalCallbackData("ea:42:ao")).toBe(true);
  });

  it("returns false for other data", () => {
    expect(isExecApprovalCallbackData("commands_page_1")).toBe(false);
    expect(isExecApprovalCallbackData("mdl_prov")).toBe(false);
    expect(isExecApprovalCallbackData("")).toBe(false);
  });
});

// ─── parseExecApprovalCallbackData ────────────────────────────────────────────

describe("parseExecApprovalCallbackData", () => {
  it("parses allow-once", () => {
    const result = parseExecApprovalCallbackData("ea:42:ao");
    expect(result).toEqual({ counter: 42, decision: "allow-once" });
  });

  it("parses allow-always", () => {
    const result = parseExecApprovalCallbackData("ea:1:aa");
    expect(result).toEqual({ counter: 1, decision: "allow-always" });
  });

  it("parses deny", () => {
    const result = parseExecApprovalCallbackData("ea:99999:d");
    expect(result).toEqual({ counter: 99999, decision: "deny" });
  });

  it("returns null for invalid prefix", () => {
    expect(parseExecApprovalCallbackData("xx:42:ao")).toBeNull();
  });

  it("returns null for invalid action", () => {
    expect(parseExecApprovalCallbackData("ea:42:xx")).toBeNull();
  });

  it("returns null for missing counter", () => {
    expect(parseExecApprovalCallbackData("ea::ao")).toBeNull();
  });

  it("returns null for non-numeric counter", () => {
    expect(parseExecApprovalCallbackData("ea:abc:ao")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseExecApprovalCallbackData("")).toBeNull();
  });
});

// ─── roundtrip encoding ───────────────────────────────────────────────────────

describe("roundtrip encoding", () => {
  it("encodes and decodes correctly for all actions", () => {
    for (const action of ["allow-once", "allow-always", "deny"] as const) {
      const data = buildExecApprovalCallbackData(42, action);
      const result = parseExecApprovalCallbackData(data);
      expect(result).toEqual({ counter: 42, decision: action });
    }
  });
});

// ─── extractTelegramChatId ────────────────────────────────────────────────────

describe("extractTelegramChatId", () => {
  it("extracts chat ID from channel session key", () => {
    expect(extractTelegramChatId("agent:main:telegram:channel:123456789")).toBe("123456789");
  });

  it("extracts chat ID from group session key", () => {
    expect(extractTelegramChatId("agent:main:telegram:group:-100123456789")).toBe("-100123456789");
  });

  it("returns null for non-telegram session key", () => {
    expect(extractTelegramChatId("agent:main:discord:channel:123456789")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(extractTelegramChatId(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(extractTelegramChatId(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractTelegramChatId("")).toBeNull();
  });

  it("extracts from longer session keys", () => {
    expect(
      extractTelegramChatId("agent:my-agent:telegram:group:-100111222333:topic:5"),
    ).toBe("-100111222333");
  });
});

// ─── TelegramExecApprovalHandler.shouldHandle ─────────────────────────────────

describe("TelegramExecApprovalHandler.shouldHandle", () => {
  it("returns false when disabled", () => {
    const handler = createHandler({ enabled: false, approvers: ["123"] });
    expect(handler.shouldHandle(createRequest())).toBe(false);
  });

  it("returns false when no approvers", () => {
    const handler = createHandler({ enabled: true, approvers: [] });
    expect(handler.shouldHandle(createRequest())).toBe(false);
  });

  it("returns true with minimal config", () => {
    const handler = createHandler({ enabled: true, approvers: ["123"] });
    expect(handler.shouldHandle(createRequest())).toBe(true);
  });

  it("filters by agent ID", () => {
    const handler = createHandler({
      enabled: true,
      approvers: ["123"],
      agentFilter: ["allowed-agent"],
    });
    expect(handler.shouldHandle(createRequest({ agentId: "allowed-agent" }))).toBe(true);
    expect(handler.shouldHandle(createRequest({ agentId: "other-agent" }))).toBe(false);
    expect(handler.shouldHandle(createRequest({ agentId: null }))).toBe(false);
  });

  it("filters by session key substring", () => {
    const handler = createHandler({
      enabled: true,
      approvers: ["123"],
      sessionFilter: ["telegram"],
    });
    expect(
      handler.shouldHandle(createRequest({ sessionKey: "agent:test:telegram:123" })),
    ).toBe(true);
    expect(
      handler.shouldHandle(createRequest({ sessionKey: "agent:test:discord:123" })),
    ).toBe(false);
    expect(handler.shouldHandle(createRequest({ sessionKey: null }))).toBe(false);
  });

  it("filters by session key regex", () => {
    const handler = createHandler({
      enabled: true,
      approvers: ["123"],
      sessionFilter: ["^agent:.*:telegram:"],
    });
    expect(
      handler.shouldHandle(createRequest({ sessionKey: "agent:test:telegram:123" })),
    ).toBe(true);
    expect(
      handler.shouldHandle(createRequest({ sessionKey: "other:test:telegram:123" })),
    ).toBe(false);
  });

  it("filters by telegram account when session store includes account", () => {
    writeStore({
      "agent:test-agent:telegram:channel:999888777": {
        sessionId: "sess",
        updatedAt: Date.now(),
        origin: { provider: "telegram", accountId: "secondary" },
        lastAccountId: "secondary",
      },
    });
    const handler = createHandler({ enabled: true, approvers: ["123"] }, "default");
    expect(handler.shouldHandle(createRequest())).toBe(false);
    const matching = createHandler({ enabled: true, approvers: ["123"] }, "secondary");
    expect(matching.shouldHandle(createRequest())).toBe(true);
  });

  it("combines agent and session filters", () => {
    const handler = createHandler({
      enabled: true,
      approvers: ["123"],
      agentFilter: ["my-agent"],
      sessionFilter: ["telegram"],
    });
    expect(
      handler.shouldHandle(
        createRequest({
          agentId: "my-agent",
          sessionKey: "agent:my-agent:telegram:123",
        }),
      ),
    ).toBe(true);
    expect(
      handler.shouldHandle(
        createRequest({
          agentId: "other-agent",
          sessionKey: "agent:other:telegram:123",
        }),
      ),
    ).toBe(false);
    expect(
      handler.shouldHandle(
        createRequest({
          agentId: "my-agent",
          sessionKey: "agent:my-agent:discord:123",
        }),
      ),
    ).toBe(false);
  });
});

// ─── TelegramExecApprovalHandler.getApprovers ─────────────────────────────────

describe("TelegramExecApprovalHandler.getApprovers", () => {
  it("returns configured approvers", () => {
    const handler = createHandler({ enabled: true, approvers: ["111", "222"] });
    expect(handler.getApprovers()).toEqual(["111", "222"]);
  });

  it("returns empty array when no approvers configured", () => {
    const handler = createHandler({ enabled: true, approvers: [] });
    expect(handler.getApprovers()).toEqual([]);
  });

  it("returns empty array when approvers is undefined", () => {
    const handler = createHandler({ enabled: true } as TelegramExecApprovalConfig);
    expect(handler.getApprovers()).toEqual([]);
  });
});

// ─── handleCallback authorization ─────────────────────────────────────────────

describe("TelegramExecApprovalHandler.handleCallback", () => {
  beforeEach(() => {
    mockSendMessage.mockReset().mockResolvedValue({ messageId: "100", chatId: "999" });
    mockEditMessage
      .mockReset()
      .mockResolvedValue({ ok: true, messageId: "100", chatId: "999" });
    mockDeleteMessage.mockReset().mockResolvedValue({ ok: true });
  });

  it("returns error for expired/unknown counter", async () => {
    const handler = createHandler({ enabled: true, approvers: ["123"] });
    const result = await handler.handleCallback({
      counter: 999,
      decision: "allow-once",
      senderId: "123",
    });
    expect(result.error).toContain("no longer active");
  });

  it("returns error for unauthorized sender", async () => {
    const handler = createHandler({ enabled: true, approvers: ["123"] });
    const internals = getInternals(handler);

    // Simulate a pending entry
    const timeoutId = setTimeout(() => {}, 60000);
    internals.pending.set(1, {
      telegramMessageId: "100",
      telegramChatId: "999",
      approvalId: "test-id",
      timeoutId,
    });

    const result = await handler.handleCallback({
      counter: 1,
      decision: "allow-once",
      senderId: "999",
    });
    expect(result.error).toContain("not authorized");

    clearPendingTimeouts(handler);
  });

  it("resolves approval for authorized sender", async () => {
    const handler = createHandler({ enabled: true, approvers: ["123"] });
    handler.resolveApproval = vi.fn().mockResolvedValue(true);
    const internals = getInternals(handler);

    const timeoutId = setTimeout(() => {}, 60000);
    internals.pending.set(1, {
      telegramMessageId: "100",
      telegramChatId: "999",
      approvalId: "test-id",
      timeoutId,
    });

    const result = await handler.handleCallback({
      counter: 1,
      decision: "allow-once",
      senderId: "123",
    });
    expect(result.error).toBeUndefined();
    // oxlint-disable-next-line typescript/unbound-method -- vi.fn() mock
    expect(handler.resolveApproval).toHaveBeenCalledWith("test-id", "allow-once");

    // Edit was called to show decision in progress
    expect(mockEditMessage).toHaveBeenCalledWith(
      "999",
      "100",
      expect.stringContaining("Allowed (once)"),
      expect.objectContaining({ buttons: [] }),
    );

    clearPendingTimeouts(handler);
  });

  it("returns error when resolve fails", async () => {
    const handler = createHandler({ enabled: true, approvers: ["123"] });
    handler.resolveApproval = vi.fn().mockResolvedValue(false);
    const internals = getInternals(handler);

    const timeoutId = setTimeout(() => {}, 60000);
    internals.pending.set(1, {
      telegramMessageId: "100",
      telegramChatId: "999",
      approvalId: "test-id",
      timeoutId,
    });

    const result = await handler.handleCallback({
      counter: 1,
      decision: "deny",
      senderId: "123",
    });
    expect(result.error).toContain("Failed to submit");

    clearPendingTimeouts(handler);
  });

  it("matches approvers with string coercion (numeric IDs)", async () => {
    const handler = createHandler({
      enabled: true,
      approvers: [123 as unknown as string],
    });
    handler.resolveApproval = vi.fn().mockResolvedValue(true);
    const internals = getInternals(handler);

    const timeoutId = setTimeout(() => {}, 60000);
    internals.pending.set(1, {
      telegramMessageId: "100",
      telegramChatId: "999",
      approvalId: "test-id",
      timeoutId,
    });

    const result = await handler.handleCallback({
      counter: 1,
      decision: "allow-once",
      senderId: "123",
    });
    expect(result.error).toBeUndefined();

    clearPendingTimeouts(handler);
  });
});

// ─── Target routing ───────────────────────────────────────────────────────────

describe("TelegramExecApprovalHandler target config", () => {
  it("defaults target to dm when not specified", () => {
    const config: TelegramExecApprovalConfig = {
      enabled: true,
      approvers: ["123"],
    };
    expect(config.target).toBeUndefined();
    const handler = createHandler(config);
    expect(handler.shouldHandle(createRequest())).toBe(true);
  });

  it("accepts target=channel in config", () => {
    const handler = createHandler({
      enabled: true,
      approvers: ["123"],
      target: "channel",
    });
    expect(handler.shouldHandle(createRequest())).toBe(true);
  });

  it("accepts target=both in config", () => {
    const handler = createHandler({
      enabled: true,
      approvers: ["123"],
      target: "both",
    });
    expect(handler.shouldHandle(createRequest())).toBe(true);
  });
});

// ─── Timeout cleanup ──────────────────────────────────────────────────────────

describe("TelegramExecApprovalHandler timeout cleanup", () => {
  beforeEach(() => {
    mockSendMessage.mockReset().mockResolvedValue({ messageId: "100", chatId: "999" });
    mockEditMessage
      .mockReset()
      .mockResolvedValue({ ok: true, messageId: "100", chatId: "999" });
  });

  it("cleans up pending and request cache on timeout", async () => {
    const handler = createHandler({ enabled: true, approvers: ["123"] });
    const internals = getInternals(handler);
    const requestA = { ...createRequest(), id: "abc" };
    const requestB = { ...createRequest(), id: "def" };

    internals.requestCache.set("abc", requestA);
    internals.requestCache.set("def", requestB);

    const timeoutIdA = setTimeout(() => {}, 0);
    const timeoutIdB = setTimeout(() => {}, 0);
    clearTimeout(timeoutIdA);
    clearTimeout(timeoutIdB);

    internals.pending.set(1, {
      telegramMessageId: "m1",
      telegramChatId: "c1",
      approvalId: "abc",
      timeoutId: timeoutIdA,
    });
    internals.pending.set(2, {
      telegramMessageId: "m2",
      telegramChatId: "c2",
      approvalId: "def",
      timeoutId: timeoutIdB,
    });
    internals.approvalCounters.set("abc", new Set([1]));
    internals.approvalCounters.set("def", new Set([2]));

    await internals.handleApprovalTimeout(1);

    expect(internals.pending.has(1)).toBe(false);
    expect(internals.requestCache.has("abc")).toBe(false);
    expect(internals.requestCache.has("def")).toBe(true);
    expect(internals.pending.has(2)).toBe(true);

    clearPendingTimeouts(handler);
  });

  it("preserves request cache when other counters still pending", async () => {
    const handler = createHandler({ enabled: true, approvers: ["123"] });
    const internals = getInternals(handler);
    const request = { ...createRequest(), id: "abc" };

    internals.requestCache.set("abc", request);

    const timeoutId1 = setTimeout(() => {}, 0);
    const timeoutId2 = setTimeout(() => {}, 0);
    clearTimeout(timeoutId1);
    clearTimeout(timeoutId2);

    internals.pending.set(1, {
      telegramMessageId: "m1",
      telegramChatId: "c1",
      approvalId: "abc",
      timeoutId: timeoutId1,
    });
    internals.pending.set(2, {
      telegramMessageId: "m2",
      telegramChatId: "c2",
      approvalId: "abc",
      timeoutId: timeoutId2,
    });
    internals.approvalCounters.set("abc", new Set([1, 2]));

    await internals.handleApprovalTimeout(1);

    // Counter 2 still pending, so request cache should be preserved
    expect(internals.pending.has(1)).toBe(false);
    expect(internals.pending.has(2)).toBe(true);
    expect(internals.requestCache.has("abc")).toBe(true);

    clearPendingTimeouts(handler);
  });
});

// ─── Delivery routing ─────────────────────────────────────────────────────────

describe("TelegramExecApprovalHandler delivery routing", () => {
  beforeEach(() => {
    mockSendMessage.mockReset().mockResolvedValue({ messageId: "100", chatId: "999" });
    mockEditMessage
      .mockReset()
      .mockResolvedValue({ ok: true, messageId: "100", chatId: "999" });
  });

  it("sends to approver DMs by default", async () => {
    const handler = createHandler({ enabled: true, approvers: ["123", "456"] });
    const internals = getInternals(handler);

    await internals.handleApprovalRequested(createRequest());

    // Should have sent to both approvers
    expect(mockSendMessage).toHaveBeenCalledTimes(2);
    expect(mockSendMessage).toHaveBeenCalledWith(
      "123",
      expect.stringContaining("Exec Approval Required"),
      expect.objectContaining({
        token: "test-token",
        buttons: expect.any(Array),
      }),
    );
    expect(mockSendMessage).toHaveBeenCalledWith(
      "456",
      expect.stringContaining("Exec Approval Required"),
      expect.objectContaining({
        token: "test-token",
      }),
    );

    clearPendingTimeouts(handler);
  });

  it("sends to originating channel when target=channel", async () => {
    const handler = createHandler({
      enabled: true,
      approvers: ["123"],
      target: "channel",
    });
    const internals = getInternals(handler);

    const request = createRequest({
      sessionKey: "agent:main:telegram:channel:999888777",
    });
    await internals.handleApprovalRequested(request);

    // Should have sent to the originating channel
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockSendMessage).toHaveBeenCalledWith(
      "999888777",
      expect.stringContaining("Exec Approval Required"),
      expect.any(Object),
    );

    clearPendingTimeouts(handler);
  });

  it("falls back to DM when channel target has no chat id", async () => {
    const handler = createHandler({
      enabled: true,
      approvers: ["123"],
      target: "channel",
    });
    const internals = getInternals(handler);

    const request = createRequest({
      sessionKey: "agent:main:discord:channel:123",
    });
    await internals.handleApprovalRequested(request);

    // Should fall back to DM delivery
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockSendMessage).toHaveBeenCalledWith("123", expect.any(String), expect.any(Object));

    clearPendingTimeouts(handler);
  });
});

// ─── Lifecycle ────────────────────────────────────────────────────────────────

describe("TelegramExecApprovalHandler lifecycle", () => {
  it("start is idempotent", async () => {
    const handler = createHandler({ enabled: true, approvers: ["123"] });
    await handler.start();
    await handler.start(); // Should not throw or create duplicate clients
    await handler.stop();
  });

  it("stop is idempotent", async () => {
    const handler = createHandler({ enabled: true, approvers: ["123"] });
    await handler.stop(); // Never started, should not throw
    await handler.stop();
  });

  it("stop clears pending timeouts", async () => {
    const handler = createHandler({ enabled: true, approvers: ["123"] });
    const internals = getInternals(handler);

    const timeoutId = setTimeout(() => {}, 60000);
    internals.pending.set(1, {
      telegramMessageId: "m1",
      telegramChatId: "c1",
      approvalId: "test",
      timeoutId,
    });

    await handler.start();
    await handler.stop();

    expect(internals.pending.size).toBe(0);
  });
});
