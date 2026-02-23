/**
 * Compose Orchestrator — programmatic multi-container stack management.
 *
 * Orchestrates the full OpenClaw environment lifecycle:
 *   1. Ensure the isolated bridge network exists.
 *   2. Ensure persistent storage volumes exist.
 *   3. Pull images if missing.
 *   4. Start the gateway (Core Service) container.
 *   5. Optionally start sandbox (Agent Workspace) containers.
 *
 * Uses NetworkManager, VolumeManager, ImageManager, and ContainerManager
 * in concert — no raw dockerode calls.
 */

import type { ContainerManager } from "./container-manager.js";
import type { ImageManager, PullProgressCallback } from "./image-manager.js";
import type { NetworkManager } from "./network-manager.js";
import type { VolumeManager } from "./volume-manager.js";
import { OPENCLAW_IMAGE, DEFAULT_GATEWAY_PORT, DEFAULT_BRIDGE_PORT } from "../../shared/constants.js";

// ─── Stack Definition ────────────────────────────────────────────────────────

export interface StackConfig {
  /** Host directory mounted to /home/node/.openclaw (config + session data). */
  configDir: string;
  /** Host directory for agent workspaces. */
  workspaceDir: string;
  /** Gateway auth token — injected as OPENCLAW_GATEWAY_TOKEN env var. */
  gatewayToken: string;
  /** Gateway port exposed to the host (default 18789). */
  gatewayPort?: number;
  /** Bridge/MCP port exposed to the host (default 18790). */
  bridgePort?: number;
  /** Override the container image. Defaults to openclaw:local. */
  image?: string;
}

export interface StackStatus {
  networkId: string;
  volumeNames: string[];
  /** True if images were pulled as part of this up() call. */
  imagesPulled: boolean;
}

// ─── Orchestrator ────────────────────────────────────────────────────────────

export class ComposeOrchestrator {
  private static readonly NETWORK_NAME = "openclaw-net";
  private static readonly VOLUMES = ["openclaw-home"] as const;

  constructor(
    private readonly containers: ContainerManager,
    private readonly images: ImageManager,
    private readonly networks: NetworkManager,
    private readonly volumes: VolumeManager,
  ) {}

  /**
   * Bring the full stack up — idempotent, safe to call when already running.
   */
  async up(config: StackConfig, onProgress?: PullProgressCallback): Promise<StackStatus> {
    const image = config.image ?? OPENCLAW_IMAGE;

    // 1. Ensure isolated network
    const networkId = await this.networks.ensure(ComposeOrchestrator.NETWORK_NAME);

    // 2. Ensure persistent volumes
    const volumeNames: string[] = [];
    for (const vol of ComposeOrchestrator.VOLUMES) {
      const name = await this.volumes.ensure(vol);
      volumeNames.push(name);
    }

    // 3. Pull image if not present
    const imagesPulled = await this.images.ensure(image, onProgress);

    // 4. Start the gateway environment
    await this.containers.createEnvironment({
      configDir: config.configDir,
      workspaceDir: config.workspaceDir,
      gatewayToken: config.gatewayToken,
      gatewayPort: config.gatewayPort ?? DEFAULT_GATEWAY_PORT,
      bridgePort: config.bridgePort ?? DEFAULT_BRIDGE_PORT,
      image,
    });

    return { networkId, volumeNames, imagesPulled };
  }

  /**
   * Stop all running containers without destroying data.
   */
  async stop(): Promise<void> {
    await this.containers.stopEnvironment();
  }

  /**
   * Start all stopped containers (without recreating anything).
   */
  async start(): Promise<void> {
    await this.containers.startEnvironment();
  }

  /**
   * Tear down all containers and the network.
   * Volumes are intentionally preserved (data is safe).
   */
  async down(): Promise<void> {
    await this.containers.destroyEnvironment();
  }

  /**
   * Full reset — tears down everything INCLUDING volumes (destroys data).
   * Requires explicit opt-in to prevent accidental data loss.
   */
  async purge(): Promise<void> {
    await this.containers.destroyEnvironment();
    for (const vol of ComposeOrchestrator.VOLUMES) {
      await this.volumes.remove(vol);
    }
    await this.networks.removeByName(ComposeOrchestrator.NETWORK_NAME);
  }
}
