import type { PluginRuntime, RuntimeEnv } from "openclaw/plugin-sdk";
import { describe, expect, it, vi } from "vitest";
import type { ResolvedIrcAccount } from "./accounts.js";
import { handleIrcInbound } from "./inbound.js";
import { setIrcRuntime } from "./runtime.js";
import type { CoreConfig, IrcInboundMessage } from "./types.js";

describe("irc inbound pairing account scope", () => {
  it("scopes pairing-store reads and writes to the active account", async () => {
    const readAllowFromStore = vi.fn(async () => [] as string[]);
    const upsertPairingRequest = vi.fn(async () => ({ code: "ABC123", created: false }));

    setIrcRuntime({
      channel: {
        pairing: {
          readAllowFromStore,
          upsertPairingRequest,
          buildPairingReply: vi.fn(() => "pairing reply"),
        },
        commands: {
          shouldHandleTextCommands: () => true,
        },
        text: {
          hasControlCommand: () => false,
        },
      },
    } as unknown as PluginRuntime);

    const account: ResolvedIrcAccount = {
      accountId: "work",
      enabled: true,
      configured: true,
      host: "irc.example.test",
      port: 6697,
      tls: true,
      nick: "openclaw-bot",
      username: "openclaw",
      realname: "OpenClaw",
      password: "",
      passwordSource: "none",
      config: {
        dmPolicy: "pairing",
        allowFrom: [],
      },
    };

    const message: IrcInboundMessage = {
      messageId: "m-1",
      target: "openclaw-bot",
      rawTarget: "openclaw-bot",
      senderNick: "mallory",
      senderUser: "mallory",
      senderHost: "example.test",
      text: "hello",
      timestamp: 1_700_000_000_000,
      isGroup: false,
    };

    const runtime: RuntimeEnv = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn((code: number): never => {
        throw new Error(`exit ${code}`);
      }),
    };

    await handleIrcInbound({
      message,
      account,
      config: { channels: { irc: {} } } as CoreConfig,
      runtime,
    });

    expect(readAllowFromStore).toHaveBeenCalledWith("irc", undefined, "work");
    expect(upsertPairingRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "irc",
        accountId: "work",
      }),
    );
  });
});
