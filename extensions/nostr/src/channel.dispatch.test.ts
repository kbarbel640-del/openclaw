import { beforeEach, describe, expect, it, vi } from "vitest";

const { startNostrBusMock, getNostrRuntimeMock } = vi.hoisted(() => ({
  startNostrBusMock: vi.fn(),
  getNostrRuntimeMock: vi.fn(),
}));

vi.mock("./nostr-bus.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./nostr-bus.js")>();
  return {
    ...actual,
    startNostrBus: startNostrBusMock,
  };
});

vi.mock("./runtime.js", () => ({
  getNostrRuntime: getNostrRuntimeMock,
}));

import { nostrPlugin } from "./channel.js";

describe("nostr inbound dispatch", () => {
  beforeEach(() => {
    startNostrBusMock.mockReset();
    getNostrRuntimeMock.mockReset();
  });

  it("routes inbound DMs via dispatchReplyWithBufferedBlockDispatcher", async () => {
    type OnMessageHandler = (
      senderPubkey: string,
      text: string,
      reply: (text: string) => Promise<void>,
    ) => Promise<void>;
    let onMessageHandler: OnMessageHandler | null = null;

    const dispatchMock = vi.fn(
      async (params: {
        ctx?: Record<string, unknown>;
        dispatcherOptions: { deliver: (payload: { text?: string }) => Promise<void> };
      }) => {
        await params.dispatcherOptions.deliver({ text: "model-reply" });
      },
    );

    const recordInboundSessionMock = vi.fn(async () => {});

    getNostrRuntimeMock.mockReturnValue({
      config: {
        loadConfig: () => ({
          agents: {
            main: {},
          },
        }),
      },
      channel: {
        routing: {
          resolveAgentRoute: () => ({
            agentId: "main",
            accountId: "default",
            sessionKey: "nostr:session:1",
          }),
        },
        session: {
          resolveStorePath: () => "/tmp/sessions",
          readSessionUpdatedAt: () => undefined,
          recordInboundSession: recordInboundSessionMock,
        },
        reply: {
          resolveEnvelopeFormatOptions: () => ({ mode: "compact" }),
          formatAgentEnvelope: ({ body }: { body: string }) => body,
          finalizeInboundContext: (ctx: Record<string, unknown>) => ctx,
          dispatchReplyWithBufferedBlockDispatcher: dispatchMock,
        },
        text: {
          resolveMarkdownTableMode: () => "off",
          convertMarkdownTables: (text: string) => text,
        },
      },
    });

    startNostrBusMock.mockImplementation(async (options: { onMessage: OnMessageHandler }) => {
      onMessageHandler = options.onMessage;
      return {
        close: vi.fn(),
        publicKey: "bot-public-key",
        sendDm: vi.fn(async () => {}),
        getMetrics: vi.fn(() => ({ counters: {}, relays: {}, snapshots: [] })),
        publishProfile: vi.fn(async () => ({
          successes: [],
          failures: [],
          eventId: "",
          createdAt: 0,
        })),
        getProfileState: vi.fn(async () => ({
          lastPublishedAt: null,
          lastPublishedEventId: null,
          lastPublishResults: null,
        })),
      };
    });

    const startAccount = nostrPlugin.gateway?.startAccount;
    if (!startAccount) {
      throw new Error("startAccount not available");
    }

    const gatewayContext = {
      cfg: {},
      account: {
        accountId: "default",
        enabled: true,
        configured: true,
        privateKey: "private-key",
        publicKey: "bot-public-key",
        relays: ["wss://relay.example"],
        config: {},
      },
      setStatus: vi.fn(),
      getStatus: vi.fn(() => ({})),
      accountId: "default",
      runtime: {
        running: true,
      },
      abortSignal: new AbortController().signal,
      log: {
        info: vi.fn(),
        debug: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
      },
    } as unknown as Parameters<typeof startAccount>[0];

    await startAccount(gatewayContext);

    expect(onMessageHandler).toBeTypeOf("function");
    if (!onMessageHandler) {
      throw new Error("onMessage handler was not captured");
    }
    const runOnMessage: OnMessageHandler = onMessageHandler;

    const replySpy = vi.fn(async () => {});
    await runOnMessage("sender-pubkey", "incoming text", replySpy);

    expect(recordInboundSessionMock).toHaveBeenCalledTimes(1);
    expect(dispatchMock).toHaveBeenCalledTimes(1);
    const dispatchArg = dispatchMock.mock.calls[0]?.[0];
    expect(dispatchArg?.ctx?.Provider).toBe("nostr");
    expect(dispatchArg?.ctx?.ChatType).toBe("direct");
    expect(dispatchArg?.ctx?.SenderId).toBe("sender-pubkey");
    expect(replySpy).toHaveBeenCalledWith("model-reply");
  });
});
