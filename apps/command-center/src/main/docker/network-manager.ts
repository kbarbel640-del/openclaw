/**
 * Network Manager — create and manage isolated Docker bridge networks
 * for the OpenClaw environment.
 *
 * User-facing label: none (networks are an implementation detail).
 * Each environment gets its own isolated bridge network so containers
 * cannot communicate with unrelated services.
 */

import type { DockerEngineClient } from "./engine-client.js";

export interface NetworkSummary {
  id: string;
  name: string;
  driver: string;
  created: string;
  containers: number;
}

export class NetworkManager {
  constructor(private readonly client: DockerEngineClient) {}

  /**
   * Create an isolated bridge network for an OpenClaw environment.
   * Returns the new network ID.
   */
  async create(name: string): Promise<string> {
    const network = await this.client.createNetwork(name);
    const info = await network.inspect() as { Id: string };
    return info.Id;
  }

  /**
   * Ensure a network exists, creating it if absent.
   * Returns the network ID.
   */
  async ensure(name: string): Promise<string> {
    const networks = await this.client.listManagedNetworks();
    const existing = networks.find((n) => n.Name === name);
    if (existing?.Id) { return existing.Id; }
    return this.create(name);
  }

  /**
   * Remove a network by ID.
   * Silently ignores "not found" errors (idempotent).
   */
  async remove(id: string): Promise<void> {
    try {
      await this.client.removeNetwork(id);
    } catch (err) {
      if (!isNotFound(err)) { throw err; }
    }
  }

  /**
   * Remove a network by name (looks up ID first).
   */
  async removeByName(name: string): Promise<void> {
    const networks = await this.client.listManagedNetworks();
    const found = networks.find((n) => n.Name === name);
    if (found?.Id) { await this.remove(found.Id); }
  }

  /**
   * List all OCCC-managed networks.
   */
  async list(): Promise<NetworkSummary[]> {
    const networks = await this.client.listManagedNetworks();
    return networks.map((n) => ({
      id: n.Id ?? "",
      name: n.Name ?? "",
      driver: n.Driver ?? "bridge",
      created: n.Created ?? "",
      containers: Object.keys(n.Containers ?? {}).length,
    }));
  }

  /**
   * Check whether a network with the given name already exists.
   */
  async exists(name: string): Promise<boolean> {
    const networks = await this.client.listManagedNetworks();
    return networks.some((n) => n.Name === name);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function isNotFound(err: unknown): boolean {
  if (err instanceof Error) {
    return err.message.includes("404") || err.message.toLowerCase().includes("no such network");
  }
  return false;
}
