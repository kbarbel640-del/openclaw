/**
 * Unit tests for VolumeManager.
 * Mock fns created as standalone vi.fn() refs before building mock objects —
 * avoids typescript-eslint(unbound-method) which fires on obj.method access.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { VolumeManager } from "../../src/main/docker/volume-manager.js";
import type { DockerEngineClient } from "../../src/main/docker/engine-client.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeVolumeInfo(overrides: Partial<{ Name: string; Driver: string }> = {}) {
  return {
    Name: overrides.Name ?? "openclaw-home",
    Driver: overrides.Driver ?? "local",
    Mountpoint: `/var/lib/docker/volumes/${overrides.Name ?? "openclaw-home"}/_data`,
    Labels: { "ai.openclaw.managed": "true" },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("VolumeManager", () => {
  // Standalone vi.fn() refs — created before mock objects, no obj.method access
  let createVolumeFn: ReturnType<typeof vi.fn>;
  let listManagedVolumesFn: ReturnType<typeof vi.fn>;
  let removeVolumeFn: ReturnType<typeof vi.fn>;

  let client: DockerEngineClient;
  let manager: VolumeManager;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create fns first, then build client object from them
    createVolumeFn = vi.fn().mockResolvedValue({ Name: "openclaw-home" });
    listManagedVolumesFn = vi.fn().mockResolvedValue([]);
    removeVolumeFn = vi.fn().mockResolvedValue(undefined);

    client = {
      createVolume: createVolumeFn,
      listManagedVolumes: listManagedVolumesFn,
      removeVolume: removeVolumeFn,
    } as unknown as DockerEngineClient;

    manager = new VolumeManager(client);
  });

  // ── create() ────────────────────────────────────────────────────────────

  describe("create()", () => {
    it("calls createVolume with the given name and returns the name", async () => {
      createVolumeFn.mockResolvedValue({ Name: "openclaw-home" } as never);

      const name = await manager.create("openclaw-home");

      expect(createVolumeFn).toHaveBeenCalledWith("openclaw-home");
      expect(name).toBe("openclaw-home");
    });
  });

  // ── ensure() ────────────────────────────────────────────────────────────

  describe("ensure()", () => {
    it("creates the volume when it does not exist", async () => {
      listManagedVolumesFn.mockResolvedValue([]);
      createVolumeFn.mockResolvedValue({ Name: "openclaw-home" } as never);

      const name = await manager.ensure("openclaw-home");

      expect(createVolumeFn).toHaveBeenCalledOnce();
      expect(name).toBe("openclaw-home");
    });

    it("returns existing volume name without creating a duplicate", async () => {
      listManagedVolumesFn.mockResolvedValue([
        makeVolumeInfo({ Name: "openclaw-home" }) as never,
      ]);

      const name = await manager.ensure("openclaw-home");

      expect(createVolumeFn).not.toHaveBeenCalled();
      expect(name).toBe("openclaw-home");
    });
  });

  // ── exists() ────────────────────────────────────────────────────────────

  describe("exists()", () => {
    it("returns true when a volume with the given name exists", async () => {
      listManagedVolumesFn.mockResolvedValue([
        makeVolumeInfo({ Name: "openclaw-home" }) as never,
      ]);

      const result = await manager.exists("openclaw-home");

      expect(result).toBe(true);
    });

    it("returns false when no matching volume exists", async () => {
      listManagedVolumesFn.mockResolvedValue([]);

      const result = await manager.exists("openclaw-home");

      expect(result).toBe(false);
    });
  });

  // ── remove() ────────────────────────────────────────────────────────────

  describe("remove()", () => {
    it("removes a volume by name", async () => {
      await manager.remove("openclaw-home");

      expect(removeVolumeFn).toHaveBeenCalledWith("openclaw-home");
    });

    it("silently ignores 404 not-found errors (idempotent)", async () => {
      removeVolumeFn.mockRejectedValue(
        new Error("404: No such volume"),
      );

      await expect(manager.remove("vol-gone")).resolves.toBeUndefined();
    });

    it("re-throws non-404 errors", async () => {
      removeVolumeFn.mockRejectedValue(new Error("volume in use"));

      await expect(manager.remove("vol-busy")).rejects.toThrow("volume in use");
    });
  });
});
