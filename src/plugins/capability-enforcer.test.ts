import { describe, expect, it, vi } from "vitest";
import {
  createCapabilityEnforcer,
  createGatewayHandlerWrapper,
  createHttpRouteGuard,
} from "./capability-enforcer.js";
import type { PluginCapabilityManifest } from "./capability-manifest.js";

function makeManifest(overrides?: Partial<PluginCapabilityManifest>): PluginCapabilityManifest {
  return {
    manifestVersion: 1,
    pluginId: "test-plugin",
    capabilities: {
      gatewayMethods: [
        { method: "msteams.*", description: "Teams operations" },
        { method: "health", description: "Health check" },
      ],
      httpRoutes: [
        {
          path: "/api/channels/msteams/*",
          methods: ["GET", "POST"],
          auth: "gateway",
          description: "Teams endpoints",
        },
      ],
      config: {
        reads: ["channels.msteams"],
        writes: [],
      },
      filesystem: {
        stateDir: true,
        credentialsDir: true,
      },
      runtime: {
        runCommands: false,
        spawnProcesses: false,
        timers: true,
      },
    },
    ...overrides,
  };
}

function makeLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
}

describe("CapabilityEnforcer", () => {
  describe("gateway method checks", () => {
    it("allows declared methods (glob)", () => {
      const enforcer = createCapabilityEnforcer({
        manifest: makeManifest(),
        mode: "enforce",
        logger: makeLogger(),
      });
      const result = enforcer.checkGatewayMethod("msteams.send");
      expect(result.allowed).toBe(true);
    });

    it("allows declared methods (exact)", () => {
      const enforcer = createCapabilityEnforcer({
        manifest: makeManifest(),
        mode: "enforce",
        logger: makeLogger(),
      });
      expect(enforcer.checkGatewayMethod("health").allowed).toBe(true);
    });

    it("blocks undeclared methods", () => {
      const enforcer = createCapabilityEnforcer({
        manifest: makeManifest(),
        mode: "enforce",
        logger: makeLogger(),
      });
      const result = enforcer.checkGatewayMethod("slack.send");
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.violation.pluginId).toBe("test-plugin");
        expect(result.violation.attempted).toBe("slack.send");
      }
    });

    it("glob does not match different prefix", () => {
      const enforcer = createCapabilityEnforcer({
        manifest: makeManifest(),
        mode: "enforce",
        logger: makeLogger(),
      });
      expect(enforcer.checkGatewayMethod("slack.send").allowed).toBe(false);
    });
  });

  describe("HTTP route checks", () => {
    it("allows matching path + method", () => {
      const enforcer = createCapabilityEnforcer({
        manifest: makeManifest(),
        mode: "enforce",
        logger: makeLogger(),
      });
      expect(enforcer.checkHttpRoute("/api/channels/msteams/webhook", "POST").allowed).toBe(true);
    });

    it("blocks wrong HTTP method", () => {
      const enforcer = createCapabilityEnforcer({
        manifest: makeManifest(),
        mode: "enforce",
        logger: makeLogger(),
      });
      expect(enforcer.checkHttpRoute("/api/channels/msteams/webhook", "DELETE").allowed).toBe(
        false,
      );
    });

    it("blocks unmatched paths", () => {
      const enforcer = createCapabilityEnforcer({
        manifest: makeManifest(),
        mode: "enforce",
        logger: makeLogger(),
      });
      expect(enforcer.checkHttpRoute("/api/channels/slack/webhook", "POST").allowed).toBe(false);
    });
  });

  describe("config access checks", () => {
    it("allows declared read path", () => {
      const enforcer = createCapabilityEnforcer({
        manifest: makeManifest(),
        mode: "enforce",
        logger: makeLogger(),
      });
      expect(enforcer.checkConfigAccess("channels.msteams", "read").allowed).toBe(true);
    });

    it("allows nested read under declared path", () => {
      const enforcer = createCapabilityEnforcer({
        manifest: makeManifest(),
        mode: "enforce",
        logger: makeLogger(),
      });
      expect(enforcer.checkConfigAccess("channels.msteams.token", "read").allowed).toBe(true);
    });

    it("blocks undeclared write", () => {
      const enforcer = createCapabilityEnforcer({
        manifest: makeManifest(),
        mode: "enforce",
        logger: makeLogger(),
      });
      expect(enforcer.checkConfigAccess("channels.msteams", "write").allowed).toBe(false);
    });
  });

  describe("filesystem access checks", () => {
    it("allows when stateDir is declared", () => {
      const enforcer = createCapabilityEnforcer({
        manifest: makeManifest(),
        mode: "enforce",
        logger: makeLogger(),
      });
      expect(enforcer.checkFilesystemAccess("/home/user/.openclaw/extensions/test").allowed).toBe(
        true,
      );
    });

    it("blocks when no filesystem capability", () => {
      const enforcer = createCapabilityEnforcer({
        manifest: makeManifest({
          capabilities: { gatewayMethods: [{ method: "test", description: "t" }] },
        }),
        mode: "enforce",
        logger: makeLogger(),
      });
      expect(enforcer.checkFilesystemAccess("/some/path").allowed).toBe(false);
    });
  });

  describe("runtime capability checks", () => {
    it("allows declared timers", () => {
      const enforcer = createCapabilityEnforcer({
        manifest: makeManifest(),
        mode: "enforce",
        logger: makeLogger(),
      });
      expect(enforcer.checkRuntimeCapability("timers").allowed).toBe(true);
    });

    it("blocks undeclared runCommands", () => {
      const enforcer = createCapabilityEnforcer({
        manifest: makeManifest(),
        mode: "enforce",
        logger: makeLogger(),
      });
      expect(enforcer.checkRuntimeCapability("runCommands").allowed).toBe(false);
    });

    it("blocks undeclared spawnProcesses", () => {
      const enforcer = createCapabilityEnforcer({
        manifest: makeManifest(),
        mode: "enforce",
        logger: makeLogger(),
      });
      expect(enforcer.checkRuntimeCapability("spawnProcesses").allowed).toBe(false);
    });
  });

  describe("enforcement modes", () => {
    it("off mode skips all checks", () => {
      const enforcer = createCapabilityEnforcer({
        manifest: makeManifest(),
        mode: "off",
        logger: makeLogger(),
      });
      expect(enforcer.checkGatewayMethod("anything.random").allowed).toBe(true);
      expect(enforcer.checkHttpRoute("/any/path", "DELETE").allowed).toBe(true);
      expect(enforcer.checkRuntimeCapability("runCommands").allowed).toBe(true);
    });

    it("warn mode returns violations but does not differ from enforce in return shape", () => {
      const logger = makeLogger();
      const enforcer = createCapabilityEnforcer({
        manifest: makeManifest(),
        mode: "warn",
        logger,
      });
      const result = enforcer.checkGatewayMethod("slack.send");
      expect(result.allowed).toBe(false);
      expect(logger.warn).toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it("enforce mode logs errors", () => {
      const logger = makeLogger();
      const enforcer = createCapabilityEnforcer({
        manifest: makeManifest(),
        mode: "enforce",
        logger,
      });
      enforcer.checkGatewayMethod("slack.send");
      expect(logger.error).toHaveBeenCalled();
    });

    it("records violations for audit", () => {
      const enforcer = createCapabilityEnforcer({
        manifest: makeManifest(),
        mode: "enforce",
        logger: makeLogger(),
      });
      enforcer.checkGatewayMethod("slack.send");
      enforcer.checkHttpRoute("/bad/path", "GET");
      expect(enforcer.getViolations()).toHaveLength(2);
    });
  });
});

describe("createGatewayHandlerWrapper", () => {
  it("off mode returns handler as-is", () => {
    const handler = vi.fn();
    const enforcer = createCapabilityEnforcer({
      manifest: makeManifest(),
      mode: "off",
      logger: makeLogger(),
    });
    const wrapper = createGatewayHandlerWrapper(enforcer, "off");
    const wrapped = wrapper(handler, "test.method");
    expect(wrapped).toBe(handler);
  });

  it("enforce mode blocks undeclared methods", async () => {
    const handler = vi.fn();
    const respond = vi.fn();
    const enforcer = createCapabilityEnforcer({
      manifest: makeManifest(),
      mode: "enforce",
      logger: makeLogger(),
    });
    const wrapper = createGatewayHandlerWrapper(enforcer, "enforce");
    const wrapped = wrapper(handler, "undeclared.method");
    await wrapped({
      req: { method: "undeclared.method" } as never,
      params: {},
      client: null,
      isWebchatConnect: () => false,
      respond,
      context: {} as never,
    });
    expect(handler).not.toHaveBeenCalled();
    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        code: "CAPABILITY_DENIED",
      }),
    );
  });

  it("warn mode allows undeclared methods through", async () => {
    const handler = vi.fn();
    const respond = vi.fn();
    const enforcer = createCapabilityEnforcer({
      manifest: makeManifest(),
      mode: "warn",
      logger: makeLogger(),
    });
    const wrapper = createGatewayHandlerWrapper(enforcer, "warn");
    const wrapped = wrapper(handler, "undeclared.method");
    await wrapped({
      req: { method: "undeclared.method" } as never,
      params: {},
      client: null,
      isWebchatConnect: () => false,
      respond,
      context: {} as never,
    });
    expect(handler).toHaveBeenCalled();
  });
});

describe("createHttpRouteGuard", () => {
  it("off mode never blocks", () => {
    const enforcer = createCapabilityEnforcer({
      manifest: makeManifest(),
      mode: "off",
      logger: makeLogger(),
    });
    const guard = createHttpRouteGuard(enforcer, "off", "test-plugin");
    const result = guard(
      { url: "/any/path", method: "DELETE" },
      { headersSent: false, statusCode: 200, setHeader: vi.fn(), end: vi.fn() },
    );
    expect(result.blocked).toBe(false);
  });

  it("enforce mode blocks unmatched routes", () => {
    const enforcer = createCapabilityEnforcer({
      manifest: makeManifest(),
      mode: "enforce",
      logger: makeLogger(),
    });
    const guard = createHttpRouteGuard(enforcer, "enforce", "test-plugin");
    const end = vi.fn();
    const result = guard(
      { url: "/api/channels/slack/webhook", method: "POST" },
      { headersSent: false, statusCode: 200, setHeader: vi.fn(), end },
    );
    expect(result.blocked).toBe(true);
    expect(end).toHaveBeenCalled();
  });

  it("warn mode does not block", () => {
    const enforcer = createCapabilityEnforcer({
      manifest: makeManifest(),
      mode: "warn",
      logger: makeLogger(),
    });
    const guard = createHttpRouteGuard(enforcer, "warn", "test-plugin");
    const result = guard(
      { url: "/api/channels/slack/webhook", method: "POST" },
      { headersSent: false, statusCode: 200, setHeader: vi.fn(), end: vi.fn() },
    );
    expect(result.blocked).toBe(false);
  });
});
