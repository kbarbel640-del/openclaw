import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerDiscordSubagentHooks } from "./subagent-hooks.js";

const hookMocks = vi.hoisted(() => ({
  autoBindSpawnedDiscordSubagent: vi.fn(async () => null),
  unbindThreadBindingsBySessionKey: vi.fn(() => []),
}));

vi.mock("openclaw/plugin-sdk", () => ({
  autoBindSpawnedDiscordSubagent: hookMocks.autoBindSpawnedDiscordSubagent,
  unbindThreadBindingsBySessionKey: hookMocks.unbindThreadBindingsBySessionKey,
}));

function registerHandlersForTest() {
  const handlers = new Map<string, (event: unknown, ctx: unknown) => unknown>();
  const api = {
    on: (hookName: string, handler: (event: unknown, ctx: unknown) => unknown) => {
      handlers.set(hookName, handler);
    },
  } as unknown as OpenClawPluginApi;
  registerDiscordSubagentHooks(api);
  return handlers;
}

describe("discord subagent hook handlers", () => {
  beforeEach(() => {
    hookMocks.autoBindSpawnedDiscordSubagent.mockClear();
    hookMocks.unbindThreadBindingsBySessionKey.mockClear();
  });

  it("binds Discord thread routing on subagent_spawned when thread is requested", async () => {
    const handlers = registerHandlersForTest();
    const handler = handlers.get("subagent_spawned");
    if (!handler) {
      throw new Error("expected subagent_spawned hook handler");
    }

    await handler(
      {
        runId: "run-1",
        childSessionKey: "agent:main:subagent:child",
        agentId: "main",
        label: "research",
        requester: {
          channel: "discord",
          accountId: "work",
          to: "channel:123",
          threadId: "456",
        },
        threadRequested: true,
      },
      {},
    );

    expect(hookMocks.autoBindSpawnedDiscordSubagent).toHaveBeenCalledTimes(1);
    expect(hookMocks.autoBindSpawnedDiscordSubagent).toHaveBeenCalledWith({
      accountId: "work",
      channel: "discord",
      to: "channel:123",
      threadId: "456",
      childSessionKey: "agent:main:subagent:child",
      agentId: "main",
      label: "research",
      boundBy: "system",
    });
  });

  it("skips auto-bind when threadRequested is false", async () => {
    const handlers = registerHandlersForTest();
    const handler = handlers.get("subagent_spawned");
    if (!handler) {
      throw new Error("expected subagent_spawned hook handler");
    }

    await handler(
      {
        runId: "run-2",
        childSessionKey: "agent:main:subagent:child-2",
        agentId: "main",
        requester: {
          channel: "discord",
          to: "channel:123",
        },
        threadRequested: false,
      },
      {},
    );

    expect(hookMocks.autoBindSpawnedDiscordSubagent).not.toHaveBeenCalled();
  });

  it("unbinds thread routing on subagent_ended", () => {
    const handlers = registerHandlersForTest();
    const handler = handlers.get("subagent_ended");
    if (!handler) {
      throw new Error("expected subagent_ended hook handler");
    }

    handler(
      {
        targetSessionKey: "agent:main:subagent:child",
        targetKind: "subagent",
        reason: "subagent-complete",
        sendFarewell: true,
        accountId: "work",
      },
      {},
    );

    expect(hookMocks.unbindThreadBindingsBySessionKey).toHaveBeenCalledTimes(1);
    expect(hookMocks.unbindThreadBindingsBySessionKey).toHaveBeenCalledWith({
      targetSessionKey: "agent:main:subagent:child",
      accountId: "work",
      targetKind: "subagent",
      reason: "subagent-complete",
      sendFarewell: true,
    });
  });
});
