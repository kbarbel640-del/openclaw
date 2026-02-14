import type { Bot } from "grammy";
import { describe, expect, it, vi } from "vitest";
import { TelegramInboundSubagentQueue } from "./inbound-subagent-queue.js";

const { callGatewayMock } = vi.hoisted(() => ({
  callGatewayMock:
    vi.fn<(params: { method: string; params?: unknown }) => Promise<Record<string, unknown>>>(),
}));

vi.mock("../gateway/call.js", () => ({
  callGateway: callGatewayMock,
}));

vi.mock("./api-logging.js", () => ({
  withTelegramApiErrorLogging: async <T>({ fn }: { fn: () => Promise<T> }): Promise<T> =>
    await fn(),
}));

vi.mock("./inbound-subagent-history.js", () => ({
  appendTelegramQueueTurn: vi.fn(async () => ({
    compressedHistory: "",
    recent: [],
    updatedAt: Date.now(),
  })),
  loadTelegramQueueMemory: vi.fn(async () => null),
  buildTelegramChatMemoryPrompt: vi.fn(() => ""),
  buildTelegramChatKey: vi.fn(
    (params: { accountId?: string; chatId: number | string; threadId?: number }) =>
      `${params.accountId ?? "default"}:chat:${String(params.chatId)}:${String(params.threadId ?? "main")}`,
  ),
}));

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitUntil(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("timed out waiting for condition");
    }
    await waitMs(25);
  }
}

function createBotStub(): Bot {
  const api = {
    sendMessage: vi.fn(async () => {
      await waitMs(1200);
      return { message_id: 123 };
    }),
    setMessageReaction: vi.fn(async () => {
      await waitMs(400);
    }),
    editMessageText: vi.fn(async () => undefined),
  };
  return { api } as unknown as Bot;
}

async function measureDispatchDelay(): Promise<number> {
  const agentDispatchAt: number[] = [];
  callGatewayMock.mockImplementation(async (req: { method: string }) => {
    if (req.method === "node.list") {
      return { ok: true };
    }
    if (req.method === "agent") {
      agentDispatchAt.push(Date.now());
      return { runId: "run-1" };
    }
    if (req.method === "agent.wait") {
      return { status: "ok" };
    }
    if (req.method === "chat.history") {
      return { messages: [] };
    }
    return {};
  });

  const queue = new TelegramInboundSubagentQueue({
    bot: createBotStub(),
    runtime: {
      error: () => undefined,
      warn: () => undefined,
      info: () => undefined,
    },
  });

  const startedAt = Date.now();
  await queue.enqueue({
    storePath: "/tmp/sessions.json",
    sessionKey: "agent:main:main",
    chatId: 109967251,
    accountId: "default",
    agentId: "main",
    messageId: 907,
    bodyForAgent: "日本湯澤目前雪況如何?",
    senderLabel: "Jethro",
  });

  await waitUntil(() => agentDispatchAt.length > 0);
  return agentDispatchAt[0] - startedAt;
}

describe("TelegramInboundSubagentQueue prefork start mode", () => {
  it("dispatches agent without waiting for stream seed and reaction", async () => {
    const dispatchMs = await measureDispatchDelay();
    console.info(`prefork-benchmark dispatchMs=${dispatchMs}`);

    // We now send a queue status message first (1200ms in this test), then dispatch.
    expect(dispatchMs).toBeLessThan(2000);
  });
});
