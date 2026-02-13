import type { PluginRuntime, RuntimeEnv } from "openclaw/plugin-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CoreConfig } from "./types.js";
import { monitorSaintEmailProvider } from "./monitor.js";
import { setSaintEmailRuntime } from "./runtime.js";

const mocks = vi.hoisted(() => ({
  gmailListMessages: vi.fn(),
  gmailGetMessage: vi.fn(),
  handleSaintEmailInbound: vi.fn(),
}));

vi.mock("./gmail-api.js", () => ({
  gmailListMessages: mocks.gmailListMessages,
  gmailGetMessage: mocks.gmailGetMessage,
  decodeBase64Url: (value: string) => {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    return Buffer.from(padded, "base64").toString("utf-8");
  },
}));

vi.mock("./inbound.js", () => ({
  handleSaintEmailInbound: mocks.handleSaintEmailInbound,
}));

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function waitFor(fn: () => void, timeoutMs = 1500): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      fn();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
  fn();
}

afterEach(() => {
  vi.restoreAllMocks();
  mocks.gmailListMessages.mockReset();
  mocks.gmailGetMessage.mockReset();
  mocks.handleSaintEmailInbound.mockReset();
});

describe("monitorSaintEmailProvider startup behavior", () => {
  it("processes unseen messages on first poll", async () => {
    setSaintEmailRuntime({
      logging: {
        getChildLogger: () => ({
          warn: vi.fn(),
          info: vi.fn(),
          error: vi.fn(),
          debug: vi.fn(),
        }),
      },
    } as unknown as PluginRuntime);

    mocks.gmailListMessages.mockResolvedValue(["msg-1"]);
    mocks.gmailGetMessage.mockResolvedValue({
      id: "msg-1",
      threadId: "thread-1",
      internalDate: "1700000000000",
      payload: {
        headers: [
          { name: "From", value: "Client <client@example.com>" },
          { name: "To", value: "bot@example.com" },
          { name: "Subject", value: "Hello" },
        ],
        mimeType: "text/plain",
        body: { data: encodeBase64Url("hello team") },
      },
      snippet: "hello team",
    });
    mocks.handleSaintEmailInbound.mockResolvedValue(undefined);

    const account = {
      accountId: "default",
      enabled: true,
      address: "bot@example.com",
      userId: "me",
      accessToken: "token",
      dmPolicy: "allowlist" as const,
      allowFrom: [],
      pollIntervalSec: 60,
      pollQuery: "in:inbox",
      maxPollResults: 10,
    };

    const monitor = await monitorSaintEmailProvider({
      account,
      config: {} as CoreConfig,
      runtime: {} as RuntimeEnv,
    });
    try {
      await waitFor(() => {
        expect(mocks.handleSaintEmailInbound).toHaveBeenCalledTimes(1);
      });
    } finally {
      monitor.stop();
    }
  });
});
