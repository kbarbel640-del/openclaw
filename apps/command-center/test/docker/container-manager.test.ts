/**
 * Unit tests for ContainerManager.
 * Mock fns created as standalone vi.fn() refs before building mock objects —
 * avoids typescript-eslint(unbound-method) which fires on obj.method access.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ContainerManager } from "../../src/main/docker/container-manager.js";
import type { DockerEngineClient } from "../../src/main/docker/engine-client.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeContainerInfo(overrides: Partial<{
  Id: string;
  Names: string[];
  State: string;
  Labels: Record<string, string>;
}> = {}) {
  return {
    Id: overrides.Id ?? "abc123",
    Names: overrides.Names ?? ["/openclaw-gateway"],
    State: overrides.State ?? "running",
    Labels: overrides.Labels ?? {
      "ai.openclaw.managed": "true",
      "ai.openclaw.role": "gateway",
    },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ContainerManager", () => {
  // Standalone vi.fn() refs — created before mock objects, no obj.method access
  let createContainerFn: ReturnType<typeof vi.fn>;
  let listContainersFn: ReturnType<typeof vi.fn>;
  let startContainerFn: ReturnType<typeof vi.fn>;
  let stopContainerFn: ReturnType<typeof vi.fn>;
  let removeContainerFn: ReturnType<typeof vi.fn>;
  let inspectContainerFn: ReturnType<typeof vi.fn>;
  let getContainerStatsFn: ReturnType<typeof vi.fn>;
  let createNetworkFn: ReturnType<typeof vi.fn>;
  let createVolumeFn: ReturnType<typeof vi.fn>;
  let listManagedNetworksFn: ReturnType<typeof vi.fn>;
  let getEngineFn: ReturnType<typeof vi.fn>;

  let client: DockerEngineClient;
  let manager: ContainerManager;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create fns first, then build client object from them
    createContainerFn = vi.fn().mockResolvedValue({ start: vi.fn().mockResolvedValue(undefined) });
    listContainersFn = vi.fn().mockResolvedValue([]);
    startContainerFn = vi.fn().mockResolvedValue(undefined);
    stopContainerFn = vi.fn().mockResolvedValue(undefined);
    removeContainerFn = vi.fn().mockResolvedValue(undefined);
    inspectContainerFn = vi.fn().mockResolvedValue({ State: { StartedAt: new Date().toISOString() } });
    getContainerStatsFn = vi.fn().mockResolvedValue({
      cpu_stats: { cpu_usage: { total_usage: 1000 }, system_cpu_usage: 10000, online_cpus: 2 },
      precpu_stats: { cpu_usage: { total_usage: 500 }, system_cpu_usage: 9000 },
      memory_stats: { usage: 52_428_800 }, // 50 MB
      networks: { eth0: { rx_bytes: 1024, tx_bytes: 512 } },
    });
    createNetworkFn = vi.fn();
    createVolumeFn = vi.fn();
    listManagedNetworksFn = vi.fn().mockResolvedValue([]);
    getEngineFn = vi.fn().mockReturnValue({
      getNetwork: vi.fn().mockReturnValue({ remove: vi.fn().mockResolvedValue(undefined) }),
    });

    client = {
      createContainer: createContainerFn,
      listContainers: listContainersFn,
      startContainer: startContainerFn,
      stopContainer: stopContainerFn,
      removeContainer: removeContainerFn,
      inspectContainer: inspectContainerFn,
      getContainerStats: getContainerStatsFn,
      createNetwork: createNetworkFn,
      createVolume: createVolumeFn,
      listManagedNetworks: listManagedNetworksFn,
      getEngine: getEngineFn,
    } as unknown as DockerEngineClient;

    manager = new ContainerManager(client);
  });

  // ── createEnvironment() ─────────────────────────────────────────────────

  describe("createEnvironment()", () => {
    it("creates and starts the gateway container", async () => {
      const startFn = vi.fn().mockResolvedValue(undefined);
      createContainerFn.mockResolvedValue({ start: startFn });

      await manager.createEnvironment({
        configDir: "/tmp/config",
        workspaceDir: "/tmp/workspace",
        gatewayToken: "tok-123",
      });

      expect(createContainerFn).toHaveBeenCalledOnce();
      expect(startFn).toHaveBeenCalledOnce();
    });

    it("uses the provided network name", async () => {
      createContainerFn.mockResolvedValue({ start: vi.fn() });

      await manager.createEnvironment({
        configDir: "/tmp/config",
        workspaceDir: "/tmp/workspace",
        gatewayToken: "tok-456",
        network: "custom-net",
      });

      const callArg = createContainerFn.mock.calls[0][0];
      expect(callArg.network).toBe("custom-net");
    });

    it("defaults to openclaw-net when network not specified", async () => {
      createContainerFn.mockResolvedValue({ start: vi.fn() });

      await manager.createEnvironment({
        configDir: "/tmp/config",
        workspaceDir: "/tmp/workspace",
        gatewayToken: "tok-789",
      });

      const callArg = createContainerFn.mock.calls[0][0];
      expect(callArg.network).toBe("openclaw-net");
    });

    it("does NOT create network or volume directly (caller's responsibility)", async () => {
      createContainerFn.mockResolvedValue({ start: vi.fn() });

      await manager.createEnvironment({
        configDir: "/tmp/config",
        workspaceDir: "/tmp/workspace",
        gatewayToken: "tok-abc",
      });

      // Regression guard: no direct network/volume creation inside createEnvironment
      expect(createNetworkFn).not.toHaveBeenCalled();
      expect(createVolumeFn).not.toHaveBeenCalled();
    });

    it("includes the gateway token as an env var", async () => {
      createContainerFn.mockResolvedValue({ start: vi.fn() });

      const gatewayToken = "my-secret-token";
      await manager.createEnvironment({
        configDir: "/tmp/config",
        workspaceDir: "/tmp/workspace",
        gatewayToken,
      });

      const callArg = createContainerFn.mock.calls[0][0];
      expect(callArg.env).toContain(`OPENCLAW_GATEWAY_TOKEN=${gatewayToken}`);
    });

    it("sets the managed label on the container", async () => {
      createContainerFn.mockResolvedValue({ start: vi.fn() });

      await manager.createEnvironment({
        configDir: "/tmp/config",
        workspaceDir: "/tmp/workspace",
        gatewayToken: "tok",
      });

      const callArg = createContainerFn.mock.calls[0][0];
      expect(callArg.labels?.["ai.openclaw.managed"]).toBe("true");
      expect(callArg.labels?.["ai.openclaw.role"]).toBe("gateway");
    });

    it("propagates errors from createContainer", async () => {
      createContainerFn.mockRejectedValue(new Error("no such image"));

      await expect(
        manager.createEnvironment({
          configDir: "/tmp/config",
          workspaceDir: "/tmp/workspace",
          gatewayToken: "tok",
        }),
      ).rejects.toThrow("no such image");
    });
  });

  // ── startEnvironment() ───────────────────────────────────────────────────

  describe("startEnvironment()", () => {
    it("starts only stopped managed containers", async () => {
      listContainersFn.mockResolvedValue([
        makeContainerInfo({ Id: "c1", State: "stopped" }),
        makeContainerInfo({ Id: "c2", State: "running" }),
      ] as never[]);

      await manager.startEnvironment();

      expect(startContainerFn).toHaveBeenCalledOnce();
      expect(startContainerFn.mock.calls[0][0]).toBe("c1");
    });

    it("does nothing when all containers are running", async () => {
      listContainersFn.mockResolvedValue([
        makeContainerInfo({ Id: "c1", State: "running" }),
      ] as never[]);

      await manager.startEnvironment();

      expect(startContainerFn).not.toHaveBeenCalled();
    });

    it("does nothing when no managed containers exist", async () => {
      listContainersFn.mockResolvedValue([]);

      await manager.startEnvironment();

      expect(startContainerFn).not.toHaveBeenCalled();
    });
  });

  // ── stopEnvironment() ────────────────────────────────────────────────────

  describe("stopEnvironment()", () => {
    it("stops only running managed containers", async () => {
      listContainersFn.mockResolvedValue([
        makeContainerInfo({ Id: "c1", State: "running" }),
        makeContainerInfo({ Id: "c2", State: "stopped" }),
      ] as never[]);

      await manager.stopEnvironment();

      expect(stopContainerFn).toHaveBeenCalledOnce();
      expect(stopContainerFn.mock.calls[0][0]).toBe("c1");
    });

    it("does nothing when no running containers exist", async () => {
      listContainersFn.mockResolvedValue([
        makeContainerInfo({ Id: "c1", State: "stopped" }),
      ] as never[]);

      await manager.stopEnvironment();

      expect(stopContainerFn).not.toHaveBeenCalled();
    });
  });

  // ── destroyEnvironment() ─────────────────────────────────────────────────

  describe("destroyEnvironment()", () => {
    it("removes all managed containers", async () => {
      listContainersFn.mockResolvedValue([
        makeContainerInfo({ Id: "c1" }),
        makeContainerInfo({ Id: "c2" }),
      ] as never[]);
      listManagedNetworksFn.mockResolvedValue([]);

      await manager.destroyEnvironment();

      expect(removeContainerFn).toHaveBeenCalledTimes(2);
    });

    it("removes managed networks", async () => {
      listContainersFn.mockResolvedValue([]);
      listManagedNetworksFn.mockResolvedValue([
        { Id: "net-1", Name: "openclaw-net" } as never,
      ]);

      const mockEngine = { getNetwork: vi.fn().mockReturnValue({ remove: vi.fn().mockResolvedValue(undefined) }) };
      getEngineFn.mockReturnValue(mockEngine);

      await manager.destroyEnvironment();

      expect(mockEngine.getNetwork).toHaveBeenCalledWith("net-1");
    });
  });

  // ── getEnvironmentStatus() ───────────────────────────────────────────────

  describe("getEnvironmentStatus()", () => {
    it("returns stopped status when no containers exist", async () => {
      listContainersFn.mockResolvedValue([]);

      const status = await manager.getEnvironmentStatus();

      expect(status.health).toBe("stopped");
      expect(status.gateway.state).toBe("stopped");
      expect(status.uptime).toBeNull();
    });

    it("returns healthy status when gateway is running", async () => {
      listContainersFn.mockResolvedValue([
        makeContainerInfo({ Id: "gw-1", State: "running" }),
      ] as never[]);

      const status = await manager.getEnvironmentStatus();

      expect(status.health).toBe("healthy");
      expect(status.gateway.state).toBe("running");
    });

    it("populates resource stats for running containers", async () => {
      listContainersFn.mockResolvedValue([
        makeContainerInfo({ Id: "gw-1", State: "running" }),
      ] as never[]);

      const status = await manager.getEnvironmentStatus();

      expect(status.gateway.memoryMB).toBe(50); // 52_428_800 bytes ≈ 50 MB
      expect(status.gateway.networkRx).toBe(1024);
      expect(status.gateway.networkTx).toBe(512);
    });

    it("calculates uptime from gateway inspect", async () => {
      const startedAt = new Date(Date.now() - 60_000).toISOString(); // 1 min ago
      listContainersFn.mockResolvedValue([
        makeContainerInfo({ Id: "gw-1", State: "running" }),
      ] as never[]);
      inspectContainerFn.mockResolvedValue({
        State: { StartedAt: startedAt },
      } as never);

      const status = await manager.getEnvironmentStatus();

      expect(status.uptime).toBeGreaterThan(0);
      expect(status.uptime).toBeLessThan(120_000); // less than 2 min
    });

    it("returns unhealthy aggregate when gateway state is dead", async () => {
      listContainersFn.mockResolvedValue([
        makeContainerInfo({ Id: "gw-1", State: "dead" }),
      ] as never[]);

      const status = await manager.getEnvironmentStatus();

      expect(status.health).toBe("unhealthy");
    });
  });
});
