import { beforeEach, describe, expect, it, vi } from "vitest";

const callGatewayMock = vi.fn();
vi.mock("../gateway/call.js", () => ({
  callGateway: (opts: unknown) => callGatewayMock(opts),
}));

let configOverride: ReturnType<(typeof import("../config/config.js"))["loadConfig"]> = {
  session: {
    mainKey: "main",
    scope: "per-sender",
  },
};

vi.mock("../config/config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../config/config.js")>();
  return {
    ...actual,
    loadConfig: () => configOverride,
    resolveGatewayPort: () => 18789,
  };
});

import "./test-helpers/fast-core-tools.js";
import { createMoltbotTools } from "./moltbot-tools.js";
import { resetSubagentRegistryForTests } from "./subagent-registry.js";

describe("moltbot-tools: sessions_spawn model override hard-fail", () => {
  beforeEach(() => {
    resetSubagentRegistryForTests();
    callGatewayMock.mockReset();
    configOverride = {
      session: {
        mainKey: "main",
        scope: "per-sender",
      },
    };
  });

  it("aborts spawn when sessions.patch fails", async () => {
    const calls: Array<{ method?: string; params?: unknown }> = [];

    callGatewayMock.mockImplementation(async (opts: unknown) => {
      const request = opts as { method?: string; params?: unknown };
      calls.push(request);
      if (request.method === "sessions.patch") {
        throw new Error("invalid model");
      }
      if (request.method === "system-event") {
        return { ok: true };
      }
      return {};
    });

    const tool = createMoltbotTools({
      agentSessionKey: "discord:group:req",
      agentChannel: "discord",
    }).find((candidate) => candidate.name === "sessions_spawn");
    if (!tool) throw new Error("missing sessions_spawn tool");

    const result = await tool.execute("call1", {
      task: "do thing",
      model: "openai/gpt-4o-mini",
    });

    expect(result.details).toMatchObject({
      status: "error",
      childSessionKey: expect.stringMatching(/^agent:main:subagent:/),
    });

    // Ensure we never send the agent spawn request.
    const agentCalls = calls.filter((c) => c.method === "agent");
    expect(agentCalls).toHaveLength(0);

    // And we did emit a failure event.
    const eventCalls = calls.filter((c) => c.method === "system-event");
    expect(eventCalls.length).toBeGreaterThan(0);
  });

  it("aborts spawn when readback verification fails", async () => {
    const calls: Array<{ method?: string; params?: unknown }> = [];
    let patchedKey: string | undefined;

    callGatewayMock.mockImplementation(async (opts: unknown) => {
      const request = opts as { method?: string; params?: any };
      calls.push(request);
      if (request.method === "sessions.patch") {
        patchedKey = String(request.params?.key ?? "");
        return { ok: true, key: patchedKey, entry: { model: "openai/gpt-4o-mini" } };
      }
      if (request.method === "sessions.list") {
        // Return the row, but with the wrong model to force verification failure.
        return {
          ts: Date.now(),
          path: "sessions.json",
          count: 1,
          defaults: { modelProvider: null, model: null, contextTokens: null },
          sessions: [
            {
              key: patchedKey,
              modelProvider: "openai",
              model: "gpt-wrong",
            },
          ],
        };
      }
      if (request.method === "system-event") {
        return { ok: true };
      }
      return {};
    });

    const tool = createMoltbotTools({
      agentSessionKey: "discord:group:req",
      agentChannel: "discord",
    }).find((candidate) => candidate.name === "sessions_spawn");
    if (!tool) throw new Error("missing sessions_spawn tool");

    const result = await tool.execute("call2", {
      task: "do thing",
      model: "openai/gpt-4o-mini",
    });

    expect(result.details?.status).toBe("error");

    const agentCalls = calls.filter((c) => c.method === "agent");
    expect(agentCalls).toHaveLength(0);

    const listCalls = calls.filter((c) => c.method === "sessions.list");
    expect(listCalls).toHaveLength(1);
  });
});
