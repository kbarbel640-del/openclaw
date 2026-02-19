/**
 * Tests for `/expanso` command integration in the Telegram bot native command handler.
 *
 * Verifies that:
 *   1. The `expanso` command is registered with the Telegram bot when native commands are enabled.
 *   2. `setMyCommands` includes the `expanso` command in the registered command list.
 *   3. The command description is correct.
 *   4. A `bot.command("expanso", ...)` handler is registered.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import type { TelegramAccountConfig } from "../config/types.js";
import type { RuntimeEnv } from "../runtime.js";
import { registerTelegramNativeCommands } from "./bot-native-commands.js";

const { listSkillCommandsForAgents } = vi.hoisted(() => ({
  listSkillCommandsForAgents: vi.fn(() => []),
}));

vi.mock("../auto-reply/skill-commands.js", () => ({
  listSkillCommandsForAgents,
}));

describe("/expanso Telegram native command integration", () => {
  beforeEach(() => {
    listSkillCommandsForAgents.mockReset();
    listSkillCommandsForAgents.mockReturnValue([]);
  });

  /**
   * Build a bot mock WITHOUT `deleteMyCommands` so that `setMyCommands` is called
   * synchronously via the else-branch (`registerCommands()` called immediately).
   * This avoids async timing issues in the test environment.
   */
  const buildBot = () => ({
    api: {
      setMyCommands: vi.fn().mockResolvedValue(undefined),
      sendMessage: vi.fn().mockResolvedValue(undefined),
      // Intentionally omit deleteMyCommands to trigger synchronous registration path
    },
    command: vi.fn(),
  });

  const buildParams = (cfg: OpenClawConfig = {}, accountId = "default") => ({
    bot: buildBot() as unknown as Parameters<typeof registerTelegramNativeCommands>[0]["bot"],
    cfg,
    runtime: {} as RuntimeEnv,
    accountId,
    telegramCfg: {} as TelegramAccountConfig,
    allowFrom: [],
    groupAllowFrom: [],
    replyToMode: "off" as const,
    textLimit: 4096,
    useAccessGroups: false,
    nativeEnabled: true,
    nativeSkillsEnabled: true,
    nativeDisabledExplicit: false,
    resolveGroupPolicy: () => ({ allowlistEnabled: false, allowed: true }),
    resolveTelegramGroupConfig: () => ({
      groupConfig: undefined,
      topicConfig: undefined,
    }),
    shouldSkipUpdate: () => false,
    opts: { token: "test-token" },
  });

  it("registers the expanso command with setMyCommands", () => {
    const params = buildParams();
    registerTelegramNativeCommands(params);

    const bot = params.bot as unknown as ReturnType<typeof buildBot>;
    const allCalls = bot.api.setMyCommands.mock.calls;
    const registeredCommands = allCalls.flatMap(
      (call) => (call[0] as Array<{ command: string; description: string }>) ?? [],
    );

    const expansoCmd = registeredCommands.find((cmd) => cmd.command === "expanso");
    expect(expansoCmd).toBeTruthy();
    expect(expansoCmd?.description).toContain("Expanso");
  });

  it("registers a bot.command handler for expanso", () => {
    const params = buildParams();
    registerTelegramNativeCommands(params);

    const bot = params.bot as unknown as ReturnType<typeof buildBot>;
    // bot.command is called for each native command
    const registeredCommandNames = bot.command.mock.calls.map(
      (call: unknown[]) => call[0] as string,
    );
    expect(registeredCommandNames).toContain("expanso");
  });

  it("does not register expanso when native commands are disabled", () => {
    const params = buildParams({ commands: { native: false } });
    params.nativeEnabled = false;
    params.nativeSkillsEnabled = false;
    registerTelegramNativeCommands(params);

    const bot = params.bot as unknown as ReturnType<typeof buildBot>;
    const registeredCommandNames = bot.command.mock.calls.map(
      (call: unknown[]) => call[0] as string,
    );
    expect(registeredCommandNames).not.toContain("expanso");
  });

  it("expanso command description mentions pipelines", () => {
    const params = buildParams();
    registerTelegramNativeCommands(params);

    const bot = params.bot as unknown as ReturnType<typeof buildBot>;
    const allSetCalls = bot.api.setMyCommands.mock.calls;
    const registeredCommands = allSetCalls.flatMap(
      (call) => (call[0] as Array<{ command: string; description: string }>) ?? [],
    );
    const expansoCmd = registeredCommands.find((cmd) => cmd.command === "expanso");

    expect(expansoCmd).toBeTruthy();
    // The description should reference pipelines
    const desc = expansoCmd!.description.toLowerCase();
    expect(desc).toMatch(/pipeline/);
  });
});
