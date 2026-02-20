import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerDiscordSubagentHooks } from "./subagent-hooks.js";

const hookMocks = vi.hoisted(() => ({
  unbindThreadBindingsBySessionKey: vi.fn(() => []),
}));

vi.mock("openclaw/plugin-sdk", () => ({
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
    hookMocks.unbindThreadBindingsBySessionKey.mockClear();
  });

  it("registers only subagent_ended hook", () => {
    const handlers = registerHandlersForTest();
    expect(handlers.has("subagent_spawned")).toBe(false);
    expect(handlers.has("subagent_ended")).toBe(true);
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
