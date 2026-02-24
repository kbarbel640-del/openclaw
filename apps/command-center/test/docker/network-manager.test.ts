/**
 * Unit tests for NetworkManager.
 * Mock fns created as standalone vi.fn() refs before building mock objects —
 * avoids typescript-eslint(unbound-method) which fires on obj.method access.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NetworkManager } from "../../src/main/docker/network-manager.js";
import type { DockerEngineClient } from "../../src/main/docker/engine-client.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeNetworkInfo(overrides: Partial<{ Id: string; Name: string }> = {}) {
  return {
    Id: overrides.Id ?? "net-abc",
    Name: overrides.Name ?? "openclaw-net",
    Driver: "bridge",
    Created: new Date().toISOString(),
    Containers: {},
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("NetworkManager", () => {
  // Standalone vi.fn() refs — created before mock objects, no obj.method access
  let createNetworkFn: ReturnType<typeof vi.fn>;
  let listManagedNetworksFn: ReturnType<typeof vi.fn>;
  let removeNetworkFn: ReturnType<typeof vi.fn>;

  let client: DockerEngineClient;
  let manager: NetworkManager;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create fns first, then build client object from them
    createNetworkFn = vi.fn().mockResolvedValue({
      inspect: vi.fn().mockResolvedValue({ Id: "net-new" }),
    });
    listManagedNetworksFn = vi.fn().mockResolvedValue([]);
    removeNetworkFn = vi.fn().mockResolvedValue(undefined);

    client = {
      createNetwork: createNetworkFn,
      listManagedNetworks: listManagedNetworksFn,
      removeNetwork: removeNetworkFn,
    } as unknown as DockerEngineClient;

    manager = new NetworkManager(client);
  });

  // ── create() ────────────────────────────────────────────────────────────

  describe("create()", () => {
    it("calls createNetwork with the given name and returns the network ID", async () => {
      const mockNetwork = { inspect: vi.fn().mockResolvedValue({ Id: "net-123" }) };
      createNetworkFn.mockResolvedValue(mockNetwork);

      const id = await manager.create("my-network");

      expect(createNetworkFn).toHaveBeenCalledWith("my-network");
      expect(id).toBe("net-123");
    });
  });

  // ── ensure() ────────────────────────────────────────────────────────────

  describe("ensure()", () => {
    it("creates the network when it does not exist", async () => {
      listManagedNetworksFn.mockResolvedValue([]);
      const mockNetwork = { inspect: vi.fn().mockResolvedValue({ Id: "net-new" }) };
      createNetworkFn.mockResolvedValue(mockNetwork);

      const id = await manager.ensure("openclaw-net");

      expect(createNetworkFn).toHaveBeenCalledOnce();
      expect(id).toBe("net-new");
    });

    it("returns existing network ID without creating a duplicate", async () => {
      listManagedNetworksFn.mockResolvedValue([
        makeNetworkInfo({ Id: "existing-net-id", Name: "openclaw-net" }) as never,
      ]);

      const id = await manager.ensure("openclaw-net");

      expect(createNetworkFn).not.toHaveBeenCalled();
      expect(id).toBe("existing-net-id");
    });
  });

  // ── exists() ────────────────────────────────────────────────────────────

  describe("exists()", () => {
    it("returns true when a network with the given name exists", async () => {
      listManagedNetworksFn.mockResolvedValue([
        makeNetworkInfo({ Name: "openclaw-net" }) as never,
      ]);

      const result = await manager.exists("openclaw-net");

      expect(result).toBe(true);
    });

    it("returns false when no matching network exists", async () => {
      listManagedNetworksFn.mockResolvedValue([]);

      const result = await manager.exists("openclaw-net");

      expect(result).toBe(false);
    });
  });

  // ── removeByName() ──────────────────────────────────────────────────────

  describe("removeByName()", () => {
    it("removes the network matching the given name", async () => {
      listManagedNetworksFn.mockResolvedValue([
        makeNetworkInfo({ Id: "net-to-remove", Name: "openclaw-net" }) as never,
      ]);

      await manager.removeByName("openclaw-net");

      expect(removeNetworkFn).toHaveBeenCalledWith("net-to-remove");
    });

    it("does nothing when no matching network exists", async () => {
      listManagedNetworksFn.mockResolvedValue([]);

      await manager.removeByName("openclaw-net");

      expect(removeNetworkFn).not.toHaveBeenCalled();
    });
  });

  // ── remove() ────────────────────────────────────────────────────────────

  describe("remove()", () => {
    it("removes a network by ID", async () => {
      removeNetworkFn.mockResolvedValue(undefined);

      await manager.remove("net-123");

      expect(removeNetworkFn).toHaveBeenCalledWith("net-123");
    });

    it("silently ignores 404 not-found errors (idempotent)", async () => {
      removeNetworkFn.mockRejectedValue(
        new Error("404: No such network"),
      );

      await expect(manager.remove("net-gone")).resolves.toBeUndefined();
    });

    it("re-throws non-404 errors", async () => {
      removeNetworkFn.mockRejectedValue(new Error("connection refused"));

      await expect(manager.remove("net-err")).rejects.toThrow("connection refused");
    });
  });
});
