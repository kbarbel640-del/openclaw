import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";
import type { MsgContext } from "../templating.js";
import type { ModelRoutingStrategy } from "./model-router-strategies/types.js";
import {
  resolveRoutingConfig,
  routeModel,
  registerRoutingStrategy,
  getRoutingStrategy,
  listRoutingStrategies,
} from "./model-router.js";

function makeMsgCtx(overrides?: Partial<MsgContext>): MsgContext {
  return {
    Body: "Hello",
    CommandBody: "Hello",
    RawBody: "Hello",
    ...overrides,
  };
}

describe("resolveRoutingConfig", () => {
  it("returns null when routing is not configured", () => {
    const cfg = {} as OpenClawConfig;
    expect(resolveRoutingConfig(cfg)).toBeNull();
  });

  it("returns null when strategy is passthrough", () => {
    const cfg = {
      agents: { defaults: { model: { routing: { strategy: "passthrough" } } } },
    } as unknown as OpenClawConfig;
    expect(resolveRoutingConfig(cfg)).toBeNull();
  });

  it("returns config when a non-passthrough strategy is set", () => {
    const cfg = {
      agents: {
        defaults: {
          model: {
            routing: {
              strategy: "dynamic-tiered",
              options: {
                classifier: { model: "x" },
                tiers: { fast: "a", standard: "b", deep: "c" },
              },
            },
          },
        },
      },
    } as unknown as OpenClawConfig;
    expect(resolveRoutingConfig(cfg)).toBeTruthy();
    expect(resolveRoutingConfig(cfg)?.strategy).toBe("dynamic-tiered");
  });
});

describe("strategy registry", () => {
  it("has built-in strategies registered", () => {
    const names = listRoutingStrategies();
    expect(names).toContain("passthrough");
    expect(names).toContain("dynamic-tiered");
  });

  it("can look up a strategy by name", () => {
    expect(getRoutingStrategy("passthrough")).toBeDefined();
    expect(getRoutingStrategy("dynamic-tiered")).toBeDefined();
    expect(getRoutingStrategy("nonexistent")).toBeUndefined();
  });

  it("can register a custom strategy", () => {
    const custom: ModelRoutingStrategy = {
      name: "test-custom",
      async route(params) {
        return {
          tier: "custom",
          provider: params.primaryProvider,
          model: params.primaryModel,
          latencyMs: 0,
          reason: "custom-test",
        };
      },
    };
    registerRoutingStrategy(custom);
    expect(getRoutingStrategy("test-custom")).toBe(custom);
    expect(listRoutingStrategies()).toContain("test-custom");
  });
});

describe("routeModel dispatcher", () => {
  it("returns fallback for unknown strategy", async () => {
    const result = await routeModel({
      ctx: makeMsgCtx(),
      config: {} as OpenClawConfig,
      routing: { strategy: "nonexistent" },
      primaryProvider: "anthropic",
      primaryModel: "claude-sonnet-4-5",
    });

    expect(result.provider).toBe("anthropic");
    expect(result.model).toBe("claude-sonnet-4-5");
    expect(result.reason).toMatch(/^fallback:unknown-strategy:/);
  });

  it("dispatches to the correct strategy", async () => {
    const spy: ModelRoutingStrategy = {
      name: "test-spy",
      async route(_params) {
        return {
          tier: "spied",
          provider: "test-provider",
          model: "test-model",
          latencyMs: 42,
          reason: "test-dispatch",
        };
      },
    };
    registerRoutingStrategy(spy);

    const result = await routeModel({
      ctx: makeMsgCtx({ Body: "test message" }),
      config: {} as OpenClawConfig,
      routing: { strategy: "test-spy", options: { key: "value" } },
      primaryProvider: "anthropic",
      primaryModel: "claude-sonnet-4-5",
    });

    expect(result.tier).toBe("spied");
    expect(result.provider).toBe("test-provider");
    expect(result.model).toBe("test-model");
    expect(result.reason).toBe("test-dispatch");
  });

  it("passes options through to the strategy", async () => {
    let receivedOptions: Record<string, unknown> = {};
    const optsSpy: ModelRoutingStrategy = {
      name: "test-opts-spy",
      async route(params) {
        receivedOptions = params.options;
        return {
          tier: "primary",
          provider: params.primaryProvider,
          model: params.primaryModel,
          latencyMs: 0,
          reason: "opts-check",
        };
      },
    };
    registerRoutingStrategy(optsSpy);

    await routeModel({
      ctx: makeMsgCtx(),
      config: {} as OpenClawConfig,
      routing: {
        strategy: "test-opts-spy",
        options: { classifier: { model: "haiku" }, tiers: { fast: "a" } },
      },
      primaryProvider: "anthropic",
      primaryModel: "claude-sonnet-4-5",
    });

    expect(receivedOptions).toEqual({ classifier: { model: "haiku" }, tiers: { fast: "a" } });
  });

  it("forwards recentContext to the strategy", async () => {
    let receivedContext: string | undefined;
    const contextSpy: ModelRoutingStrategy = {
      name: "test-context-spy",
      async route(params) {
        receivedContext = params.recentContext;
        return {
          tier: "primary",
          provider: params.primaryProvider,
          model: params.primaryModel,
          latencyMs: 0,
          reason: "context-check",
        };
      },
    };
    registerRoutingStrategy(contextSpy);

    const context = "Recent conversation:\nUser: debug the cache\nAssistant [sonnet]: Looking...";

    await routeModel({
      ctx: makeMsgCtx(),
      config: {} as OpenClawConfig,
      routing: { strategy: "test-context-spy" },
      primaryProvider: "anthropic",
      primaryModel: "claude-sonnet-4-5",
      recentContext: context,
    });

    expect(receivedContext).toBe(context);
  });

  it("forwards undefined recentContext when not provided", async () => {
    let receivedContext: string | undefined = "should-be-overwritten";
    const contextSpy2: ModelRoutingStrategy = {
      name: "test-context-spy-2",
      async route(params) {
        receivedContext = params.recentContext;
        return {
          tier: "primary",
          provider: params.primaryProvider,
          model: params.primaryModel,
          latencyMs: 0,
          reason: "context-check",
        };
      },
    };
    registerRoutingStrategy(contextSpy2);

    await routeModel({
      ctx: makeMsgCtx(),
      config: {} as OpenClawConfig,
      routing: { strategy: "test-context-spy-2" },
      primaryProvider: "anthropic",
      primaryModel: "claude-sonnet-4-5",
    });

    expect(receivedContext).toBeUndefined();
  });

  it("passes MsgContext through to the strategy", async () => {
    let receivedCtx: MsgContext | undefined;
    const ctxSpy: ModelRoutingStrategy = {
      name: "test-ctx-spy",
      async route(params) {
        receivedCtx = params.ctx;
        return {
          tier: "primary",
          provider: params.primaryProvider,
          model: params.primaryModel,
          latencyMs: 0,
          reason: "ctx-check",
        };
      },
    };
    registerRoutingStrategy(ctxSpy);

    const ctx = makeMsgCtx({
      Body: "analyze this image",
      MediaTypes: ["image/jpeg"],
      Provider: "telegram",
    });

    await routeModel({
      ctx,
      config: {} as OpenClawConfig,
      routing: { strategy: "test-ctx-spy" },
      primaryProvider: "anthropic",
      primaryModel: "claude-sonnet-4-5",
    });

    expect(receivedCtx?.Body).toBe("analyze this image");
    expect(receivedCtx?.MediaTypes).toEqual(["image/jpeg"]);
    expect(receivedCtx?.Provider).toBe("telegram");
  });
});
