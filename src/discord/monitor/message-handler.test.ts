import { beforeEach, describe, expect, it, vi } from "vitest";

const preflightDiscordMessage = vi.fn();
const processDiscordMessage = vi.fn();
const abortEmbeddedPiRun = vi.fn();
const clearSessionQueues = vi.fn(() => ({
  followupCleared: 0,
  laneCleared: 0,
  keys: [],
}));
const resolveStorePath = vi.fn(() => "/tmp/openclaw-discord-message-handler-test-sessions.json");
const loadSessionStore = vi.fn(() => ({
  "agent:main:discord:channel:c1": { sessionId: "session-1" },
}));

vi.mock("./message-handler.preflight.js", () => ({
  preflightDiscordMessage,
}));

vi.mock("./message-handler.process.js", () => ({
  processDiscordMessage,
}));

vi.mock("../../agents/pi-embedded.js", () => ({
  abortEmbeddedPiRun,
}));

vi.mock("../../auto-reply/reply/queue.js", () => ({
  clearSessionQueues,
}));

vi.mock("../../config/sessions.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../config/sessions.js")>();
  return {
    ...actual,
    resolveStorePath,
    loadSessionStore,
  };
});

const { createDiscordMessageHandler } = await import("./message-handler.js");

type HandlerParams = Parameters<typeof createDiscordMessageHandler>[0];

function createMessageEvent(params: {
  id: string;
  content: string;
  authorId?: string;
  channelId?: string;
}) {
  const authorId = params.authorId ?? "u1";
  const channelId = params.channelId ?? "c1";
  return {
    author: {
      id: authorId,
      username: "alice",
      discriminator: "0",
      globalName: "Alice",
    },
    channel_id: channelId,
    guild_id: "g1",
    guild: { id: "g1", name: "Guild" },
    member: { nickname: "Alice" },
    rawMember: { roles: [] },
    message: {
      id: params.id,
      content: params.content,
      channelId,
      timestamp: new Date().toISOString(),
      attachments: [],
      embeds: [],
    },
  };
}

function createUpdateEvent(params: { id: string; oldContent: string; newContent: string }) {
  return {
    oldMessage: {
      id: params.id,
      content: params.oldContent,
      channelId: "c1",
      timestamp: new Date().toISOString(),
      attachments: [],
      embeds: [],
    },
    message: {
      id: params.id,
      content: params.newContent,
      channelId: "c1",
      timestamp: new Date().toISOString(),
      attachments: [],
      embeds: [],
    },
    rawData: {},
  };
}

function createPartialUpdateEvent(params: { id: string; content?: string }) {
  return {
    message: {
      id: params.id,
      ...(params.content !== undefined ? { content: params.content } : {}),
    },
    rawData: {},
  };
}

function createGetterOnlyUpdateEvent(params: { id: string; content: string }) {
  const message = {
    id: params.id,
    attachments: [],
    embeds: [],
    channelId: "c1",
  } as Record<string, unknown>;
  Object.defineProperty(message, "content", {
    configurable: true,
    enumerable: false,
    get: () => params.content,
  });
  return {
    message,
    rawData: {},
  };
}

function createDeleteEvent(id: string) {
  return {
    message: {
      id,
      content: "",
      channelId: "c1",
      timestamp: new Date().toISOString(),
      attachments: [],
      embeds: [],
    },
    rawData: {},
  };
}

function createHandler(options?: { interruptOnMessageMutations?: boolean }) {
  const runtime = {
    error: vi.fn(),
    log: vi.fn(),
  };

  const params = {
    cfg: {
      messages: {
        inbound: { debounceMs: 0 },
        ackReactionScope: "group-mentions",
      },
      session: {
        store: "/tmp/openclaw-discord-message-handler-test-sessions.json",
      },
    },
    discordConfig: {
      interruptOnMessageMutations: options?.interruptOnMessageMutations,
    },
    accountId: "default",
    token: "token",
    runtime,
    botUserId: "bot-1",
    guildHistories: new Map(),
    historyLimit: 0,
    mediaMaxBytes: 1024,
    textLimit: 4000,
    replyToMode: "off",
    dmEnabled: true,
    groupDmEnabled: true,
    allowFrom: [],
  } as unknown as HandlerParams;

  return {
    handler: createDiscordMessageHandler(params),
    runtime,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  preflightDiscordMessage.mockReset().mockImplementation(async (input: { data: unknown }) => ({
    route: { sessionKey: "agent:main:discord:channel:c1", agentId: "main" },
    message: (input.data as { message: unknown }).message,
  }));
  processDiscordMessage.mockReset().mockResolvedValue(undefined);
  abortEmbeddedPiRun.mockReset();
  clearSessionQueues.mockClear();
  resolveStorePath.mockClear();
  loadSessionStore.mockClear().mockReturnValue({
    "agent:main:discord:channel:c1": { sessionId: "session-1" },
  });
});

describe("createDiscordMessageHandler mutation interrupt toggle", () => {
  it("allows opting out and ignoring update/delete mutations", async () => {
    const { handler } = createHandler({ interruptOnMessageMutations: false });

    await handler(createMessageEvent({ id: "m1", content: "first message" }) as never, {} as never);
    await vi.runAllTimersAsync();
    expect(processDiscordMessage).toHaveBeenCalledTimes(1);

    await handler.handleMessageUpdate(
      createUpdateEvent({
        id: "m1",
        oldContent: "first message",
        newContent: "first message edited",
      }) as never,
      {} as never,
    );
    await handler.handleMessageDelete(createDeleteEvent("m1") as never, {} as never);
    await vi.runAllTimersAsync();

    expect(processDiscordMessage).toHaveBeenCalledTimes(1);
    const firstCall = processDiscordMessage.mock.calls[0]?.[0] as {
      abortSignal?: AbortSignal;
    };
    expect(firstCall.abortSignal).toBeUndefined();
    expect(abortEmbeddedPiRun).not.toHaveBeenCalled();
    expect(clearSessionQueues).not.toHaveBeenCalled();
  });

  it("aborts in-flight runs and recomputes with the latest inbound message", async () => {
    const { handler } = createHandler();
    processDiscordMessage
      .mockImplementationOnce(
        async (ctx: { abortSignal?: AbortSignal }) =>
          await new Promise<void>((resolve) => {
            const signal = ctx.abortSignal;
            if (!signal || signal.aborted) {
              resolve();
              return;
            }
            signal.addEventListener("abort", () => resolve(), { once: true });
          }),
      )
      .mockResolvedValueOnce(undefined);

    await handler(createMessageEvent({ id: "m1", content: "first message" }) as never, {} as never);
    await vi.runAllTimersAsync();
    expect(processDiscordMessage).toHaveBeenCalledTimes(1);

    await handler(
      createMessageEvent({ id: "m2", content: "second message" }) as never,
      {} as never,
    );
    await vi.runAllTimersAsync();

    expect(processDiscordMessage).toHaveBeenCalledTimes(2);
    const firstCall = processDiscordMessage.mock.calls[0]?.[0] as {
      abortSignal?: AbortSignal;
    };
    const secondCall = processDiscordMessage.mock.calls[1]?.[0] as {
      message?: { content?: string };
      messageSids?: string[];
      messageSidOverride?: string;
    };
    expect(firstCall.abortSignal?.aborted).toBe(true);
    expect(secondCall.message?.content).toContain("second message");
    expect(secondCall.message?.content).not.toContain("first message");
    expect(secondCall.messageSids).toEqual(["m2"]);
    expect(secondCall.messageSidOverride).toContain("m2:rebuild");
    expect(abortEmbeddedPiRun).toHaveBeenCalledWith("session-1");
    expect(clearSessionQueues).toHaveBeenCalled();
  });

  it("keeps only the latest pending message before a run starts", async () => {
    const { handler } = createHandler();
    await handler(
      createMessageEvent({ id: "m1", content: "this is a banana" }) as never,
      {} as never,
    );
    await handler(
      createMessageEvent({ id: "m2", content: "this is not an apple" }) as never,
      {} as never,
    );
    await vi.runAllTimersAsync();

    expect(processDiscordMessage).toHaveBeenCalledTimes(1);
    const firstCall = processDiscordMessage.mock.calls[0]?.[0] as {
      message?: { content?: string };
      messageSids?: string[];
    };
    expect(firstCall.message?.content).toContain("this is not an apple");
    expect(firstCall.message?.content).not.toContain("this is a banana");
    expect(firstCall.messageSids).toEqual(["m2"]);
  });

  it("rebuilds edited messages using only the latest revision text", async () => {
    const { handler } = createHandler({ interruptOnMessageMutations: true });
    processDiscordMessage
      .mockImplementationOnce(
        async (ctx: { abortSignal?: AbortSignal }) =>
          await new Promise<void>((resolve) => {
            const signal = ctx.abortSignal;
            if (!signal || signal.aborted) {
              resolve();
              return;
            }
            signal.addEventListener("abort", () => resolve(), { once: true });
          }),
      )
      .mockResolvedValueOnce(undefined);

    await handler(
      createMessageEvent({ id: "m1", content: "this is a cool ca" }) as never,
      {} as never,
    );
    await vi.runAllTimersAsync();
    expect(processDiscordMessage).toHaveBeenCalledTimes(1);

    await handler.handleMessageUpdate(
      createUpdateEvent({
        id: "m1",
        oldContent: "this is a cool ca",
        newContent: "this is a cool cat",
      }) as never,
      {} as never,
    );
    await vi.runAllTimersAsync();

    expect(processDiscordMessage).toHaveBeenCalledTimes(2);
    const firstCall = processDiscordMessage.mock.calls[0]?.[0] as {
      abortSignal?: AbortSignal;
    };
    const secondCall = processDiscordMessage.mock.calls[1]?.[0] as {
      message?: { content?: string };
      messageSids?: string[];
    };
    expect(firstCall.abortSignal?.aborted).toBe(true);
    expect(secondCall.message?.content).toBe("this is a cool cat");
    expect(secondCall.message?.content).not.toBe("this is a cool ca");
    expect(secondCall.messageSids).toEqual(["m1"]);
  });

  it("reprocesses late edits after the first run already completed", async () => {
    const { handler } = createHandler();

    await handler(
      createMessageEvent({ id: "m1", content: "this is a banana" }) as never,
      {} as never,
    );
    await vi.runAllTimersAsync();
    expect(processDiscordMessage).toHaveBeenCalledTimes(1);

    await handler.handleMessageUpdate(
      createUpdateEvent({
        id: "m1",
        oldContent: "this is a banana",
        newContent: "this is an apple",
      }) as never,
      {} as never,
    );
    await vi.runAllTimersAsync();

    expect(processDiscordMessage).toHaveBeenCalledTimes(2);
    const secondCall = processDiscordMessage.mock.calls[1]?.[0] as {
      message?: { content?: string };
      messageSids?: string[];
    };
    expect(secondCall.message?.content).toBe("this is an apple");
    expect(secondCall.messageSids).toEqual(["m1"]);
  });

  it("ignores partial update payloads without new content", async () => {
    const { handler, runtime } = createHandler({ interruptOnMessageMutations: true });

    processDiscordMessage
      .mockImplementationOnce(
        async (ctx: { abortSignal?: AbortSignal }) =>
          await new Promise<void>((resolve) => {
            const signal = ctx.abortSignal;
            if (!signal || signal.aborted) {
              resolve();
              return;
            }
            signal.addEventListener("abort", () => resolve(), { once: true });
          }),
      )
      .mockResolvedValueOnce(undefined);

    await handler(createMessageEvent({ id: "m1", content: "stable text" }) as never, {} as never);
    await vi.runAllTimersAsync();
    await handler.handleMessageUpdate(createPartialUpdateEvent({ id: "m1" }) as never, {} as never);
    await vi.runAllTimersAsync();

    expect(runtime.error).not.toHaveBeenCalled();
    expect(processDiscordMessage).toHaveBeenCalledTimes(1);
  });

  it("handles update messages where content is provided via getter-only fields", async () => {
    const { handler } = createHandler();
    await handler(createMessageEvent({ id: "m1", content: "banana" }) as never, {} as never);
    await vi.runAllTimersAsync();
    expect(processDiscordMessage).toHaveBeenCalledTimes(1);

    await handler.handleMessageUpdate(
      createGetterOnlyUpdateEvent({ id: "m1", content: "apple" }) as never,
      {} as never,
    );
    await vi.runAllTimersAsync();

    expect(processDiscordMessage).toHaveBeenCalledTimes(2);
    const secondCall = processDiscordMessage.mock.calls[1]?.[0] as {
      message?: { content?: string };
      messageSids?: string[];
    };
    expect(secondCall.message?.content).toBe("apple");
    expect(secondCall.messageSids).toEqual(["m1"]);
  });

  it("aborts in-flight work when a pending message is deleted", async () => {
    const { handler } = createHandler({ interruptOnMessageMutations: true });
    processDiscordMessage.mockImplementationOnce(
      async (ctx: { abortSignal?: AbortSignal }) =>
        await new Promise<void>((resolve) => {
          const signal = ctx.abortSignal;
          if (!signal || signal.aborted) {
            resolve();
            return;
          }
          signal.addEventListener("abort", () => resolve(), { once: true });
        }),
    );

    await handler(createMessageEvent({ id: "m1", content: "delete me" }) as never, {} as never);
    await vi.runAllTimersAsync();
    expect(processDiscordMessage).toHaveBeenCalledTimes(1);

    await handler.handleMessageDelete(createDeleteEvent("m1") as never, {} as never);
    await vi.runAllTimersAsync();

    expect(processDiscordMessage).toHaveBeenCalledTimes(1);
    const firstCall = processDiscordMessage.mock.calls[0]?.[0] as {
      abortSignal?: AbortSignal;
    };
    expect(firstCall.abortSignal?.aborted).toBe(true);
    expect(abortEmbeddedPiRun).toHaveBeenCalledWith("session-1");
  });
});
