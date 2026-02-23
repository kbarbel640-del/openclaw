/**
 * Volume Manager — create and manage persistent Docker volumes for
 * the OpenClaw environment.
 *
 * User-facing label: "Storage" (never "Docker volume").
 * Volumes survive container restarts and environment rebuilds.
 * Data is only deleted on explicit user action.
 */

import type { DockerEngineClient } from "./engine-client.js";

export interface VolumeSummary {
  name: string;
  driver: string;
  mountpoint: string;
  created: string;
  labels: Record<string, string>;
}

export class VolumeManager {
  constructor(private readonly client: DockerEngineClient) {}

  /**
   * Create a named persistent volume for OpenClaw data.
   * Returns the volume name.
   */
  async create(name: string): Promise<string> {
    await this.client.createVolume(name);
    return name;
  }

  /**
   * Ensure a volume exists, creating it if absent.
   * Returns the volume name.
   */
  async ensure(name: string): Promise<string> {
    const volumes = await this.client.listManagedVolumes();
    const existing = volumes.find((v) => v.Name === name);
    if (existing) { return existing.Name; }
    return this.create(name);
  }

  /**
   * Remove a named volume. Silently ignores "not found" errors (idempotent).
   * WARNING: destroys all data stored in the volume.
   */
  async remove(name: string): Promise<void> {
    try {
      await this.client.removeVolume(name);
    } catch (err) {
      if (!isNotFound(err)) { throw err; }
    }
  }

  /**
   * List all OCCC-managed volumes.
   */
  async list(): Promise<VolumeSummary[]> {
    const volumes = await this.client.listManagedVolumes();
    return volumes.map((v) => ({
      name: v.Name,
      driver: v.Driver,
      mountpoint: v.Mountpoint,
      created: "",
      labels: (v.Labels as Record<string, string>) ?? {},
    }));
  }

  /**
   * Check whether a volume with the given name already exists.
   */
  async exists(name: string): Promise<boolean> {
    const volumes = await this.client.listManagedVolumes();
    return volumes.some((v) => v.Name === name);
  }

  /**
   * Get detailed info on a single volume.
   */
  async inspect(name: string): Promise<VolumeSummary | null> {
    const volumes = await this.client.listManagedVolumes();
    const found = volumes.find((v) => v.Name === name);
    if (!found) { return null; }
    return {
      name: found.Name,
      driver: found.Driver,
      mountpoint: found.Mountpoint,
      created: "",
      labels: (found.Labels as Record<string, string>) ?? {},
    };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function isNotFound(err: unknown): boolean {
  if (err instanceof Error) {
    return err.message.includes("404") || err.message.toLowerCase().includes("no such volume");
  }
  return false;
}
