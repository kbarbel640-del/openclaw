import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { OpenClawConfig } from "../config/types.openclaw.js";
import type { GatewayReloadPlan } from "./config-reload.js";
import { createGatewayReloadHandlers } from "./server-reload-handlers.js";

// Mock dependencies that have side effects
vi.mock("../infra/restart.js", () => ({
  setGatewaySigusr1RestartPolicy: vi.fn(),
  authorizeGatewaySigusr1Restart: vi.fn(),
}));

vi.mock("../infra/outbound/target-resolver.js", () => ({
  resetDirectoryCache: vi.fn(),
}));

vi.mock("../process/command-queue.js", () => ({
  setCommandLaneConcurrency: vi.fn(),
}));

vi.mock("../process/lanes.js", () => ({
  CommandLane: { Cron: "cron", Main: "main", Subagent: "subagent" },
}));

vi.mock("../config/agent-limits.js", () => ({
  resolveAgentMaxConcurrent: vi.fn().mockReturnValue(1),
  resolveSubagentMaxConcurrent: vi.fn().mockReturnValue(1),
}));

vi.mock("./hooks.js", () => ({
  resolveHooksConfig: vi.fn().mockReturnValue({}),
}));

function createMockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => createMockLogger()),
  } as unknown as ReturnType<typeof import("../logging/subsystem.js").createSubsystemLogger>;
}

function createMinimalReloadPlan(): GatewayReloadPlan {
  return {
    changedPaths: [],
    restartGateway: false,
    restartReasons: [],
    hotReasons: [],
    reloadHooks: false,
    restartGmailWatcher: false,
    restartBrowserControl: false,
    restartCron: false,
    restartHeartbeat: false,
    restartChannels: new Set(),
    noopPaths: [],
  };
}

function createMockDeps() {
  return {} as ReturnType<typeof import("../cli/deps.js").createDefaultDeps>;
}

function createMockState() {
  return {
    hooksConfig: {},
    heartbeatRunner: { updateConfig: vi.fn(), stop: vi.fn() },
    cronState: {
      cron: { start: vi.fn().mockResolvedValue(undefined), stop: vi.fn() },
      storePath: "/tmp/cron",
    },
    browserControl: null,
  };
}

describe("createGatewayReloadHandlers", () => {
  let mockState: ReturnType<typeof createMockState>;

  beforeEach(() => {
    mockState = createMockState();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("applyHotReload with hardenMode", () => {
    it("re-applies hardening overrides when hardenMode is true", async () => {
      const logReload = { info: vi.fn(), warn: vi.fn() };
      const logHarden = createMockLogger();

      const { applyHotReload } = createGatewayReloadHandlers({
        deps: createMockDeps(),
        broadcast: vi.fn(),
        getState: () => mockState as ReturnType<typeof createMockState>,
        setState: vi.fn(),
        startChannel: vi.fn().mockResolvedValue(undefined),
        stopChannel: vi.fn().mockResolvedValue(undefined),
        logHooks: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
        logBrowser: { error: vi.fn() },
        logChannels: { info: vi.fn(), error: vi.fn() },
        logCron: { error: vi.fn() },
        logReload,
        hardenMode: true,
        logHarden,
      });

      // Config with dangerous settings that should be overridden by hardening
      const insecureConfig: OpenClawConfig = {
        gateway: {
          tls: { enabled: false },
          controlUi: {
            dangerouslyDisableDeviceAuth: true,
            allowInsecureAuth: true,
          },
        },
        tools: {
          profile: "standard",
          elevated: { enabled: true },
        },
      };

      const plan = createMinimalReloadPlan();
      await applyHotReload(plan, insecureConfig);

      // Verify hardening was re-applied (logged)
      expect(logReload.info).toHaveBeenCalledWith(
        "harden: re-applying security overrides to hot-reloaded config",
      );

      // Verify the hardening function logged its actions
      expect(logHarden.info).toHaveBeenCalledWith("harden: TLS forced enabled");
      expect(logHarden.info).toHaveBeenCalledWith(
        "harden: dangerous Control UI overrides disabled",
      );
    });

    it("does not apply hardening when hardenMode is false", async () => {
      const logReload = { info: vi.fn(), warn: vi.fn() };

      const { applyHotReload } = createGatewayReloadHandlers({
        deps: createMockDeps(),
        broadcast: vi.fn(),
        getState: () => mockState as ReturnType<typeof createMockState>,
        setState: vi.fn(),
        startChannel: vi.fn().mockResolvedValue(undefined),
        stopChannel: vi.fn().mockResolvedValue(undefined),
        logHooks: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
        logBrowser: { error: vi.fn() },
        logChannels: { info: vi.fn(), error: vi.fn() },
        logCron: { error: vi.fn() },
        logReload,
        hardenMode: false,
      });

      const insecureConfig: OpenClawConfig = {
        gateway: {
          tls: { enabled: false },
        },
      };

      const plan = createMinimalReloadPlan();
      await applyHotReload(plan, insecureConfig);

      // Verify hardening was NOT applied
      expect(logReload.info).not.toHaveBeenCalledWith(
        "harden: re-applying security overrides to hot-reloaded config",
      );
    });

    it("does not apply hardening when hardenMode is true but logHarden is not provided", async () => {
      const logReload = { info: vi.fn(), warn: vi.fn() };

      const { applyHotReload } = createGatewayReloadHandlers({
        deps: createMockDeps(),
        broadcast: vi.fn(),
        getState: () => mockState as ReturnType<typeof createMockState>,
        setState: vi.fn(),
        startChannel: vi.fn().mockResolvedValue(undefined),
        stopChannel: vi.fn().mockResolvedValue(undefined),
        logHooks: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
        logBrowser: { error: vi.fn() },
        logChannels: { info: vi.fn(), error: vi.fn() },
        logCron: { error: vi.fn() },
        logReload,
        hardenMode: true,
        // logHarden intentionally not provided
      });

      const insecureConfig: OpenClawConfig = {
        gateway: {
          tls: { enabled: false },
        },
      };

      const plan = createMinimalReloadPlan();
      await applyHotReload(plan, insecureConfig);

      // Verify hardening was NOT applied (because logHarden is required)
      expect(logReload.info).not.toHaveBeenCalledWith(
        "harden: re-applying security overrides to hot-reloaded config",
      );
    });

    it("applies hardening before processing other reload actions", async () => {
      const logReload = { info: vi.fn(), warn: vi.fn() };
      const logHarden = createMockLogger();
      const logHooks = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

      // Track call order
      const callOrder: string[] = [];
      logReload.info = vi.fn((msg: string) => {
        if (msg.includes("harden: re-applying")) {
          callOrder.push("harden");
        }
      });

      const { resolveHooksConfig } = await import("./hooks.js");
      (resolveHooksConfig as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callOrder.push("resolveHooksConfig");
        return {};
      });

      const { applyHotReload } = createGatewayReloadHandlers({
        deps: createMockDeps(),
        broadcast: vi.fn(),
        getState: () => mockState as ReturnType<typeof createMockState>,
        setState: vi.fn(),
        startChannel: vi.fn().mockResolvedValue(undefined),
        stopChannel: vi.fn().mockResolvedValue(undefined),
        logHooks,
        logBrowser: { error: vi.fn() },
        logChannels: { info: vi.fn(), error: vi.fn() },
        logCron: { error: vi.fn() },
        logReload,
        hardenMode: true,
        logHarden,
      });

      const plan = createMinimalReloadPlan();
      plan.reloadHooks = true;

      await applyHotReload(plan, {});

      // Hardening should happen before hooks resolution
      expect(callOrder[0]).toBe("harden");
      expect(callOrder[1]).toBe("resolveHooksConfig");
    });

    it("passes hardened config to downstream reload operations", async () => {
      const logReload = { info: vi.fn(), warn: vi.fn() };
      const logHarden = createMockLogger();

      const updateConfigSpy = vi.fn();
      mockState.heartbeatRunner.updateConfig = updateConfigSpy;

      const { applyHotReload } = createGatewayReloadHandlers({
        deps: createMockDeps(),
        broadcast: vi.fn(),
        getState: () => mockState as ReturnType<typeof createMockState>,
        setState: vi.fn(),
        startChannel: vi.fn().mockResolvedValue(undefined),
        stopChannel: vi.fn().mockResolvedValue(undefined),
        logHooks: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
        logBrowser: { error: vi.fn() },
        logChannels: { info: vi.fn(), error: vi.fn() },
        logCron: { error: vi.fn() },
        logReload,
        hardenMode: true,
        logHarden,
      });

      // Config that would have TLS disabled
      const insecureConfig: OpenClawConfig = {
        gateway: {
          tls: { enabled: false },
        },
      };

      const plan = createMinimalReloadPlan();
      plan.restartHeartbeat = true;

      await applyHotReload(plan, insecureConfig);

      // Verify heartbeatRunner received the hardened config (with TLS enabled)
      expect(updateConfigSpy).toHaveBeenCalledTimes(1);
      const passedConfig = updateConfigSpy.mock.calls[0][0];
      expect(passedConfig.gateway?.tls?.enabled).toBe(true);
    });
  });

  describe("requestGatewayRestart", () => {
    it("does not apply hardening (restart will re-apply at startup)", async () => {
      const logReload = { info: vi.fn(), warn: vi.fn() };
      const logHarden = createMockLogger();

      const { requestGatewayRestart } = createGatewayReloadHandlers({
        deps: createMockDeps(),
        broadcast: vi.fn(),
        getState: () => mockState as ReturnType<typeof createMockState>,
        setState: vi.fn(),
        startChannel: vi.fn().mockResolvedValue(undefined),
        stopChannel: vi.fn().mockResolvedValue(undefined),
        logHooks: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
        logBrowser: { error: vi.fn() },
        logChannels: { info: vi.fn(), error: vi.fn() },
        logCron: { error: vi.fn() },
        logReload,
        hardenMode: true,
        logHarden,
      });

      const plan = createMinimalReloadPlan();
      plan.restartGateway = true;
      plan.restartReasons = ["gateway.port"];

      // requestGatewayRestart should not call harden (restart handles it)
      requestGatewayRestart(plan, {});

      // Hardening function should NOT be called during restart request
      expect(logHarden.info).not.toHaveBeenCalled();
    });
  });
});
