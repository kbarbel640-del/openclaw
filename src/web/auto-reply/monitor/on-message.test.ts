import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWebOnMessageHandler } from "./on-message.js";

const { mockRunMessageInbound, mockHasHooks } = vi.hoisted(() => ({
  mockRunMessageInbound: vi.fn(),
  mockHasHooks: vi.fn(),
}));

vi.mock("../../../plugins/hook-runner-global.js", () => ({
  getGlobalHookRunner: () => ({
    hasHooks: mockHasHooks,
    runMessageInbound: mockRunMessageInbound,
  }),
}));

vi.mock("../../../config/config.js", () => ({
  loadConfig: vi.fn(() => ({})),
}));

vi.mock("../../../routing/resolve-route.js", () => ({
  resolveAgentRoute: vi.fn(() => ({
    accountId: "acct-1",
    sessionKey: "session-1",
    agentId: "agent-1",
  })),
}));

vi.mock("./process-message.js", () => ({
  processMessage: vi.fn(),
}));

vi.mock("./group-gating.js", () => ({
  applyGroupGating: vi.fn(() => ({ shouldProcess: true })),
}));

vi.mock("./broadcast.js", () => ({
  maybeBroadcastMessage: vi.fn(() => false),
}));

vi.mock("./last-route.js", () => ({
  updateLastRouteInBackground: vi.fn(),
}));

describe("createWebOnMessageHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fires message_inbound hook if plugins are registered", async () => {
    mockHasHooks.mockReturnValue(true);
    mockRunMessageInbound.mockResolvedValue(undefined);

    const handler = createWebOnMessageHandler({
      // oxlint-disable-next-line typescript/no-explicit-any
      cfg: {} as any,
      verbose: false,
      connectionId: "conn-1",
      maxMediaBytes: 100,
      groupHistoryLimit: 10,
      groupHistories: new Map(),
      groupMemberNames: new Map(),
      // oxlint-disable-next-line typescript/no-explicit-any
      echoTracker: { has: () => false, forget: () => {}, rememberText: () => {}, buildCombinedKey: () => "k" } as any,
      backgroundTasks: new Set(),
      replyResolver: undefined,
      // oxlint-disable-next-line typescript/no-explicit-any
      replyLogger: { warn: () => {} } as any,
      // oxlint-disable-next-line typescript/no-explicit-any
      baseMentionConfig: {} as any,
      account: { accountId: "acct-1" },
    });

    await handler({
      from: "+1555",
      to: "+2000",
      chatType: "direct",
      body: "hello plugin",
      senderJid: "sender@s.whatsapp.net",
      senderName: "Alice",
      timestamp: 123456,
      // oxlint-disable-next-line typescript/no-explicit-any
    } as any);

    expect(mockHasHooks).toHaveBeenCalledWith("message_inbound");
    expect(mockRunMessageInbound).toHaveBeenCalledWith(
      {
        from: "sender@s.whatsapp.net",
        content: "hello plugin",
        timestamp: 123456,
        metadata: expect.objectContaining({
          to: "+2000",
          provider: "whatsapp",
          senderName: "Alice",
          chatType: "direct",
        }),
      },
      {
        channelId: "whatsapp",
        accountId: "acct-1",
        conversationId: "+1555",
      },
    );
  });

  it("does not fire message_inbound hook if no plugins registered", async () => {
    mockHasHooks.mockReturnValue(false);

    const handler = createWebOnMessageHandler({
      // oxlint-disable-next-line typescript/no-explicit-any
      cfg: {} as any,
      verbose: false,
      connectionId: "conn-1",
      maxMediaBytes: 100,
      groupHistoryLimit: 10,
      groupHistories: new Map(),
      groupMemberNames: new Map(),
      // oxlint-disable-next-line typescript/no-explicit-any
      echoTracker: { has: () => false, forget: () => {}, rememberText: () => {}, buildCombinedKey: () => "k" } as any,
      backgroundTasks: new Set(),
      replyResolver: undefined,
      // oxlint-disable-next-line typescript/no-explicit-any
      replyLogger: { warn: () => {} } as any,
      // oxlint-disable-next-line typescript/no-explicit-any
      baseMentionConfig: {} as any,
      account: { accountId: "acct-1" },
    });

    await handler({
      from: "+1555",
      to: "+2000",
      chatType: "direct",
      body: "hello plugin",
      // oxlint-disable-next-line typescript/no-explicit-any
    } as any);

    expect(mockHasHooks).toHaveBeenCalledWith("message_inbound");
    expect(mockRunMessageInbound).not.toHaveBeenCalled();
  });
});
