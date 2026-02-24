import type {
  ChannelAccountSnapshot,
  ChannelGatewayContext,
  OpenClawConfig,
  PluginRuntime,
  ResolvedTelegramAccount,
  RuntimeEnv,
} from "openclaw/plugin-sdk";
import { describe, expect, it, vi } from "vitest";
import { telegramPlugin } from "./channel.js";
import { setTelegramRuntime } from "./runtime.js";

function createRuntime() {
  const probeTelegram = vi.fn(async () => ({ ok: false }));
  const monitorTelegramProvider = vi.fn(async () => undefined);

  const runtime = {
    channel: {
      telegram: {
        probeTelegram,
        monitorTelegramProvider,
      },
    },
    logging: {
      shouldLogVerbose: () => false,
    },
  } as unknown as PluginRuntime;

  return { runtime, probeTelegram, monitorTelegramProvider };
}

function createRuntimeEnv(): RuntimeEnv {
  return {
    log: vi.fn(),
    error: vi.fn(),
    exit: vi.fn((code: number): never => {
      throw new Error(`exit ${code}`);
    }),
  };
}

function createStartAccountCtx(): ChannelGatewayContext<ResolvedTelegramAccount> {
  const snapshot: ChannelAccountSnapshot = {
    accountId: "default",
    configured: true,
    enabled: true,
    running: false,
  };
  return {
    accountId: "default",
    account: {
      accountId: "default",
      enabled: true,
      token: "test-token",
      tokenSource: "config",
      config: {
        webhookUrl: "https://example.test/telegram",
        webhookSecret: "secret",
        webhookPath: "/tg/webhook",
        webhookHost: "0.0.0.0",
        webhookPort: 18789,
      } as ResolvedTelegramAccount["config"],
    },
    cfg: {} as OpenClawConfig,
    runtime: createRuntimeEnv(),
    abortSignal: new AbortController().signal,
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    getStatus: () => snapshot,
    setStatus: vi.fn(),
  };
}

describe("telegramPlugin gateway.startAccount", () => {
  it("passes webhookPort to telegram monitor", async () => {
    const { runtime, monitorTelegramProvider } = createRuntime();
    setTelegramRuntime(runtime);

    await telegramPlugin.gateway!.startAccount!(createStartAccountCtx());

    expect(monitorTelegramProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "default",
        token: "test-token",
        useWebhook: true,
        webhookPort: 18789,
      }),
    );
  });
});
