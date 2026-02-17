import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildTelegramMessageContext } from "./bot-message-context.js";

const recordInboundSessionMock = vi.fn().mockResolvedValue(undefined);
const resolveAgentRouteMock = vi.fn();
const loadConfigMock = vi.fn(() => ({}));

vi.mock("../channels/session.js", () => ({
  recordInboundSession: (params: unknown) => recordInboundSessionMock(params),
}));

vi.mock("../routing/resolve-route.js", () => ({
  resolveAgentRoute: (params: unknown) => resolveAgentRouteMock(params),
}));

vi.mock("../config/config.js", async () => {
  const actual = await vi.importActual<typeof import("../config/config.js")>("../config/config.js");
  return {
    ...actual,
    loadConfig: () => loadConfigMock(),
  };
});

type DmScope = "main" | "per-peer" | "per-channel-peer" | "per-account-channel-peer";

type LastRouteUpdate = {
  sessionKey: string;
  channel: string;
  to: string;
  accountId?: string;
  threadId?: string | number;
};

function getUpdateLastRoute(): LastRouteUpdate | undefined {
  const params = recordInboundSessionMock.mock.calls.at(-1)?.[0] as
    | { updateLastRoute?: LastRouteUpdate }
    | undefined;
  return params?.updateLastRoute;
}

async function buildCtx(dmScope: DmScope) {
  return await buildTelegramMessageContext({
    primaryCtx: {
      message: {
        message_id: 1,
        chat: { id: 1234, type: "private" },
        date: 1_700_000_000,
        text: "hello",
        from: { id: 42, first_name: "Alice" },
      },
      me: { id: 7, username: "bot" },
    } as never,
    allMedia: [],
    storeAllowFrom: [],
    options: {},
    bot: {
      api: {
        sendChatAction: vi.fn(),
        setMessageReaction: vi.fn(),
      },
    } as never,
    cfg: {
      agents: { defaults: { model: "anthropic/claude-opus-4-5", workspace: "/tmp/openclaw" } },
      channels: { telegram: {} },
      messages: { groupChat: { mentionPatterns: [] } },
      session: { dmScope },
    } as never,
    account: { accountId: "default" } as never,
    historyLimit: 0,
    groupHistories: new Map(),
    dmPolicy: "open",
    allowFrom: [],
    groupAllowFrom: [],
    ackReactionScope: "off",
    logger: { info: vi.fn() },
    resolveGroupActivation: () => undefined,
    resolveGroupRequireMention: () => false,
    resolveTelegramGroupConfig: () => ({
      groupConfig: { requireMention: false },
      topicConfig: undefined,
    }),
  });
}

describe("buildTelegramMessageContext DM last-route isolation", () => {
  beforeEach(() => {
    recordInboundSessionMock.mockClear();
    resolveAgentRouteMock.mockReset();
    loadConfigMock.mockClear();
    resolveAgentRouteMock.mockReturnValue({
      agentId: "main",
      channel: "telegram",
      accountId: "default",
      sessionKey: "agent:main:telegram:direct:1234",
      mainSessionKey: "agent:main:main",
      matchedBy: "default",
    });
  });

  it("does not update main-session last route for DMs when dmScope is per-channel-peer", async () => {
    const ctx = await buildCtx("per-channel-peer");
    expect(ctx).not.toBeNull();
    expect(recordInboundSessionMock).toHaveBeenCalled();
    expect(getUpdateLastRoute()).toBeUndefined();
  });

  it("stores namespaced Telegram target for DM last-route updates outside per-channel-peer", async () => {
    const ctx = await buildCtx("main");
    expect(ctx).not.toBeNull();
    expect(recordInboundSessionMock).toHaveBeenCalled();
    const updateLastRoute = getUpdateLastRoute();
    expect(updateLastRoute).toBeDefined();
    expect(updateLastRoute?.sessionKey).toBe("agent:main:main");
    expect(updateLastRoute?.channel).toBe("telegram");
    expect(updateLastRoute?.to).toBe("telegram:1234");
  });
});
