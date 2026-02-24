import type { IncomingMessage, ServerResponse } from "node:http";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerPluginHttpRoute } from "./http-registry.js";
import type { PluginRegistry } from "./registry.js";

function makeRegistry(): PluginRegistry {
  return {
    httpRoutes: [],
  } as unknown as PluginRegistry;
}

function makeHandler() {
  return vi.fn<(req: IncomingMessage, res: ServerResponse) => void>();
}

describe("registerPluginHttpRoute", () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = makeRegistry();
  });

  it("registers a new route and returns an unregister function", () => {
    const handler = makeHandler();
    const unregister = registerPluginHttpRoute({
      path: "/webhook/test",
      handler,
      registry,
    });

    expect(registry.httpRoutes).toHaveLength(1);
    expect(registry.httpRoutes[0].path).toBe("/webhook/test");

    unregister();
    expect(registry.httpRoutes).toHaveLength(0);
  });

  it("returns a no-op when path is missing", () => {
    const log = vi.fn();
    const unregister = registerPluginHttpRoute({
      path: null,
      handler: makeHandler(),
      registry,
      log,
    });

    expect(registry.httpRoutes).toHaveLength(0);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("missing"));
    expect(() => unregister()).not.toThrow();
  });

  it("replaces a stale route when the same path is registered again", () => {
    const firstHandler = makeHandler();
    const secondHandler = makeHandler();
    const log = vi.fn();

    const unregisterFirst = registerPluginHttpRoute({
      path: "/webhook/dup",
      handler: firstHandler,
      pluginId: "plugin-a",
      registry,
      log,
    });

    expect(registry.httpRoutes).toHaveLength(1);
    expect(registry.httpRoutes[0].handler).toBe(firstHandler);

    // Re-register same path (simulates plugin restart without clean stop)
    const unregisterSecond = registerPluginHttpRoute({
      path: "/webhook/dup",
      handler: secondHandler,
      pluginId: "plugin-a",
      registry,
      log,
    });

    // Old entry replaced, new handler active
    expect(registry.httpRoutes).toHaveLength(1);
    expect(registry.httpRoutes[0].handler).toBe(secondHandler);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("replacing stale"));

    // unregisterSecond removes the new entry
    unregisterSecond();
    expect(registry.httpRoutes).toHaveLength(0);

    // unregisterFirst is now a no-op (entry already gone)
    expect(() => unregisterFirst()).not.toThrow();
  });

  it("unregistering a replaced route does not remove the newer handler", () => {
    const firstHandler = makeHandler();
    const secondHandler = makeHandler();

    const unregisterFirst = registerPluginHttpRoute({
      path: "/webhook/replace",
      handler: firstHandler,
      registry,
    });

    registerPluginHttpRoute({
      path: "/webhook/replace",
      handler: secondHandler,
      registry,
    });

    // The first unregister should be a no-op since its entry was spliced out
    unregisterFirst();
    expect(registry.httpRoutes).toHaveLength(1);
    expect(registry.httpRoutes[0].handler).toBe(secondHandler);
  });

  it("includes plugin hint in replacing log message", () => {
    const log = vi.fn();

    registerPluginHttpRoute({ path: "/wh", handler: makeHandler(), pluginId: "p1", registry, log });
    registerPluginHttpRoute({ path: "/wh", handler: makeHandler(), pluginId: "p1", registry, log });

    expect(log).toHaveBeenCalledWith(expect.stringContaining("(p1)"));
  });

  it("includes account suffix in replacing log message", () => {
    const log = vi.fn();

    registerPluginHttpRoute({
      path: "/wh",
      handler: makeHandler(),
      accountId: "acc1",
      registry,
      log,
    });
    registerPluginHttpRoute({
      path: "/wh",
      handler: makeHandler(),
      accountId: "acc1",
      registry,
      log,
    });

    expect(log).toHaveBeenCalledWith(expect.stringContaining('"acc1"'));
  });
});
