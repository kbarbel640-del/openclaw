/**
 * Unit tests for ComposeOrchestrator.
 * Standalone vi.fn() refs created before mock objects to satisfy
 * typescript-eslint(unbound-method) — no obj.method access anywhere.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ComposeOrchestrator } from "../../src/main/docker/compose-orchestrator.js";
import type { ContainerManager } from "../../src/main/docker/container-manager.js";
import type { ImageManager } from "../../src/main/docker/image-manager.js";
import type { NetworkManager } from "../../src/main/docker/network-manager.js";
import type { VolumeManager } from "../../src/main/docker/volume-manager.js";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const BASE_CONFIG = {
  configDir: "/tmp/config",
  workspaceDir: "/tmp/workspace",
  gatewayToken: "tok-test",
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ComposeOrchestrator", () => {
  // ContainerManager fn refs
  let createEnvironmentFn: ReturnType<typeof vi.fn>;
  let startEnvironmentFn: ReturnType<typeof vi.fn>;
  let stopEnvironmentFn: ReturnType<typeof vi.fn>;
  let destroyEnvironmentFn: ReturnType<typeof vi.fn>;
  let getEnvironmentStatusFn: ReturnType<typeof vi.fn>;

  // NetworkManager fn refs
  let networksEnsureFn: ReturnType<typeof vi.fn>;
  let networksRemoveByNameFn: ReturnType<typeof vi.fn>;

  // ImageManager fn refs
  let imagesEnsureFn: ReturnType<typeof vi.fn>;

  // VolumeManager fn refs
  let volumesEnsureFn: ReturnType<typeof vi.fn>;
  let volumesRemoveFn: ReturnType<typeof vi.fn>;

  // Mock manager instances
  let containers: ContainerManager;
  let images: ImageManager;
  let networks: NetworkManager;
  let volumes: VolumeManager;

  let orchestrator: ComposeOrchestrator;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create fn refs first, then build mock objects from them
    createEnvironmentFn = vi.fn().mockResolvedValue(undefined);
    startEnvironmentFn = vi.fn().mockResolvedValue(undefined);
    stopEnvironmentFn = vi.fn().mockResolvedValue(undefined);
    destroyEnvironmentFn = vi.fn().mockResolvedValue(undefined);
    getEnvironmentStatusFn = vi.fn().mockResolvedValue({ health: "healthy" });

    networksEnsureFn = vi.fn().mockResolvedValue("net-abc");
    networksRemoveByNameFn = vi.fn().mockResolvedValue(undefined);

    imagesEnsureFn = vi.fn().mockResolvedValue(false);

    volumesEnsureFn = vi.fn().mockResolvedValue("openclaw-home");
    volumesRemoveFn = vi.fn().mockResolvedValue(undefined);

    containers = {
      createEnvironment: createEnvironmentFn,
      startEnvironment: startEnvironmentFn,
      stopEnvironment: stopEnvironmentFn,
      destroyEnvironment: destroyEnvironmentFn,
      getEnvironmentStatus: getEnvironmentStatusFn,
    } as unknown as ContainerManager;

    images = {
      ensure: imagesEnsureFn,
      pull: vi.fn(),
    } as unknown as ImageManager;

    networks = {
      ensure: networksEnsureFn,
      removeByName: networksRemoveByNameFn,
    } as unknown as NetworkManager;

    volumes = {
      ensure: volumesEnsureFn,
      remove: volumesRemoveFn,
    } as unknown as VolumeManager;

    orchestrator = new ComposeOrchestrator(containers, images, networks, volumes);
  });

  // ── up() ────────────────────────────────────────────────────────────────

  describe("up()", () => {
    it("ensures the network before creating the environment", async () => {
      await orchestrator.up(BASE_CONFIG);

      expect(networksEnsureFn).toHaveBeenCalledWith("openclaw-net");
      expect(createEnvironmentFn).toHaveBeenCalledOnce();
    });

    it("ensures the volume before creating the environment", async () => {
      await orchestrator.up(BASE_CONFIG);

      expect(volumesEnsureFn).toHaveBeenCalledWith("openclaw-home");
    });

    it("pulls/ensures the image before creating the environment", async () => {
      await orchestrator.up(BASE_CONFIG);

      expect(imagesEnsureFn).toHaveBeenCalledOnce();
    });

    it("passes the network name into createEnvironment", async () => {
      await orchestrator.up(BASE_CONFIG);

      const callArg = createEnvironmentFn.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(callArg?.network).toBe("openclaw-net");
    });

    it("creates the environment with the correct config", async () => {
      await orchestrator.up(BASE_CONFIG);

      expect(createEnvironmentFn).toHaveBeenCalledOnce();
      expect(startEnvironmentFn).not.toHaveBeenCalled();
    });

    it("rolls back the network if createEnvironment fails", async () => {
      createEnvironmentFn.mockRejectedValue(new Error("container create failed"));

      await expect(orchestrator.up(BASE_CONFIG)).rejects.toThrow(
        "container create failed",
      );

      expect(networksRemoveByNameFn).toHaveBeenCalledWith("openclaw-net");
    });

    it("does not start the environment if creation failed", async () => {
      createEnvironmentFn.mockRejectedValue(new Error("oops"));

      await expect(orchestrator.up(BASE_CONFIG)).rejects.toThrow();

      expect(startEnvironmentFn).not.toHaveBeenCalled();
    });
  });

  // ── stop() ──────────────────────────────────────────────────────────────

  describe("stop()", () => {
    it("delegates to ContainerManager.stopEnvironment", async () => {
      await orchestrator.stop();

      expect(stopEnvironmentFn).toHaveBeenCalledOnce();
    });
  });

  // ── start() ─────────────────────────────────────────────────────────────

  describe("start()", () => {
    it("delegates to ContainerManager.startEnvironment", async () => {
      await orchestrator.start();

      expect(startEnvironmentFn).toHaveBeenCalledOnce();
    });
  });

  // ── down() ──────────────────────────────────────────────────────────────

  describe("down()", () => {
    it("destroys the environment via ContainerManager", async () => {
      await orchestrator.down();

      expect(destroyEnvironmentFn).toHaveBeenCalledOnce();
    });
  });

  // ── purge() ─────────────────────────────────────────────────────────────

  describe("purge()", () => {
    it("destroys the environment, removes volumes, and removes the network", async () => {
      await orchestrator.purge();

      expect(destroyEnvironmentFn).toHaveBeenCalledOnce();
      // Volumes must be removed — this is the irreversible data-deletion step
      expect(volumesRemoveFn).toHaveBeenCalledWith("openclaw-home");
      expect(networksRemoveByNameFn).toHaveBeenCalledWith("openclaw-net");
    });
  });
});
