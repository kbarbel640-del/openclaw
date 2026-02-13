import { describe, expect, it } from "vitest";
import type { PluginRegistry } from "./registry.js";
import { createHookRunner } from "./hooks.js";

function createEmptyRegistry(): PluginRegistry {
  return {
    plugins: [],
    tools: [],
    hooks: [],
    typedHooks: [],
    channels: [],
    providers: [],
    gatewayHandlers: {},
    httpHandlers: [],
    httpRoutes: [],
    cliRegistrars: [],
    services: [],
    commands: [],
    diagnostics: [],
  };
}

describe("before_agent_prepare hook runner", () => {
  it("merges model/provider/tools/skills from sequential handlers", async () => {
    const registry = createEmptyRegistry();
    registry.typedHooks.push({
      pluginId: "p1",
      hookName: "before_agent_prepare",
      priority: 20,
      source: "test",
      handler: async () => ({
        model: "claude-4",
        tools: { allow: ["web_search", "web_fetch"] },
        skills: ["core-safety"],
      }),
    });
    registry.typedHooks.push({
      pluginId: "p2",
      hookName: "before_agent_prepare",
      priority: 10,
      source: "test",
      handler: async () => ({
        provider: "anthropic",
        tools: { allow: ["browser"], deny: ["exec"] },
        skills: ["public-faq"],
      }),
    });

    const runner = createHookRunner(registry);
    const result = await runner.runBeforeAgentPrepare(
      { prompt: "hello" },
      {
        agentId: "main",
        sessionKey: "main",
        peerId: "ana",
        senderE164: "+15550001111",
      },
    );

    expect(result).toEqual({
      model: "claude-4",
      provider: "anthropic",
      tools: {
        allow: ["web_search", "web_fetch", "browser"],
        deny: ["exec"],
      },
      skills: ["core-safety", "public-faq"],
    });
  });

  it("preserves explicit empty allowlist when other hooks update non-tool fields", async () => {
    const registry = createEmptyRegistry();
    registry.typedHooks.push({
      pluginId: "tier-policy",
      hookName: "before_agent_prepare",
      priority: 20,
      source: "test",
      handler: async () => ({
        tools: { allow: [] },
      }),
    });
    registry.typedHooks.push({
      pluginId: "provider-picker",
      hookName: "before_agent_prepare",
      priority: 10,
      source: "test",
      handler: async () => ({
        provider: "anthropic",
      }),
    });

    const runner = createHookRunner(registry);
    const result = await runner.runBeforeAgentPrepare(
      { prompt: "hello" },
      {
        agentId: "main",
        sessionKey: "main",
        peerId: "ana",
        senderE164: "+15550001111",
      },
    );

    expect(result).toEqual({
      provider: "anthropic",
      tools: {
        allow: [],
      },
    });
  });
});
