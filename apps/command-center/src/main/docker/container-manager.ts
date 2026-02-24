/**
 * Container Manager — high-level orchestrator for the OpenClaw environment.
 *
 * Abstracts all Docker terminology — callers see "environment", "core service",
 * "agent workspace". Handles creation, start, stop, status, and teardown of
 * the full OpenClaw stack.
 */

import type { DockerEngineClient } from "./engine-client.js";
import type { EnvironmentStatus, ContainerStatus, EnvironmentHealth } from "../../shared/ipc-types.js";
import { OPENCLAW_IMAGE, DEFAULT_GATEWAY_PORT, DEFAULT_BRIDGE_PORT } from "../../shared/constants.js";

/** Labels used to identify OCCC-managed containers. */
const LABELS = {
  managed: "ai.openclaw.managed",
  role: "ai.openclaw.role",
} as const;

type ContainerRole = "gateway" | "cli" | "sandbox";

function roleLabel(role: ContainerRole): Record<string, string> {
  return {
    [LABELS.managed]: "true",
    [LABELS.role]: role,
  };
}

export class ContainerManager {
  constructor(private readonly client: DockerEngineClient) {}

  // ─── Environment Lifecycle ──────────────────────────────────────────────

  /**
   * Create the gateway container and attach it to an existing network.
   *
   * Network and volume creation are the caller's responsibility (use
   * ComposeOrchestrator.up() or InstallerEngine.install() which call
   * NetworkManager/VolumeManager before this). Separating concerns prevents
   * double-creation errors when the orchestrator already ensured them.
   */
  async createEnvironment(config: {
    configDir: string;
    workspaceDir: string;
    gatewayToken: string;
    gatewayPort?: number;
    bridgePort?: number;
    image?: string;
    /** Name of the pre-existing network to attach to. Defaults to "openclaw-net". */
    network?: string;
  }): Promise<void> {
    const image = config.image ?? OPENCLAW_IMAGE;
    const gatewayPort = config.gatewayPort ?? DEFAULT_GATEWAY_PORT;
    const bridgePort = config.bridgePort ?? DEFAULT_BRIDGE_PORT;
    const network = config.network ?? "openclaw-net";

    // Create gateway container (the primary service) attached to the existing network
    const gateway = await this.client.createContainer({
      name: "openclaw-gateway",
      image,
      cmd: [
        "node", "dist/index.js", "gateway",
        "--bind", "lan",
        "--port", String(gatewayPort),
      ],
      env: [
        "HOME=/home/node",
        "TERM=xterm-256color",
        `OPENCLAW_GATEWAY_TOKEN=${config.gatewayToken}`,
        "NODE_ENV=production",
      ],
      ports: {
        [String(gatewayPort)]: gatewayPort,
        [String(bridgePort)]: bridgePort,
      },
      volumes: {
        [config.configDir]: "/home/node/.openclaw",
        [config.workspaceDir]: "/home/node/.openclaw/workspace",
      },
      network,
      labels: roleLabel("gateway"),
    });

    await gateway.start();
  }

  /**
   * Start all stopped OCCC-managed containers.
   */
  async startEnvironment(): Promise<void> {
    const managed = await this.getManagedContainers();
    for (const c of managed) {
      if (c.State !== "running") {
        await this.client.startContainer(c.Id);
      }
    }
  }

  /**
   * Stop all running OCCC-managed containers gracefully.
   */
  async stopEnvironment(): Promise<void> {
    const managed = await this.getManagedContainers();
    for (const c of managed) {
      if (c.State === "running") {
        await this.client.stopContainer(c.Id);
      }
    }
  }

  /**
   * Destroy the entire environment — stops, removes containers, network, volumes.
   */
  async destroyEnvironment(): Promise<void> {
    // Stop and remove all managed containers
    const managed = await this.getManagedContainers();
    for (const c of managed) {
      await this.client.removeContainer(c.Id, true);
    }

    // Remove managed networks
    const networks = await this.client.listManagedNetworks();
    for (const net of networks) {
      try {
        await this.client.getEngine().getNetwork(net.Id).remove();
      } catch {
        // Network may already be removed
      }
    }

    // Note: volumes are NOT removed on destroy (data preservation).
    // User must explicitly purge data separately.
  }

  // ─── Status ─────────────────────────────────────────────────────────────

  /**
   * Get the aggregate status of the OpenClaw environment.
   */
  async getEnvironmentStatus(): Promise<EnvironmentStatus> {
    const managed = await this.getManagedContainers();

    let gateway: ContainerStatus | null = null;
    let cli: ContainerStatus | null = null;
    const sandboxes: ContainerStatus[] = [];

    for (const c of managed) {
      const status = await this.buildContainerStatus(c);
      const role = c.Labels?.[LABELS.role];

      if (role === "gateway") {
        gateway = status;
      } else if (role === "cli") {
        cli = status;
      } else if (role === "sandbox") {
        sandboxes.push(status);
      }
    }

    // Default status if no containers exist
    const defaultStopped: ContainerStatus = {
      id: "",
      name: "Not Created",
      state: "stopped",
      health: "stopped",
      cpu: 0,
      memoryMB: 0,
      networkRx: 0,
      networkTx: 0,
    };

    const gw = gateway ?? defaultStopped;
    const cl = cli ?? defaultStopped;

    // Aggregate health
    const health = this.aggregateHealth(gw, cl, sandboxes);

    // Calculate uptime from gateway (if running)
    let uptime: number | null = null;
    if (gw.id && gw.state === "running") {
      try {
        const inspect = await this.client.inspectContainer(gw.id);
        const startedAt = inspect.State?.StartedAt;
        if (startedAt) {
          uptime = Date.now() - new Date(startedAt).getTime();
        }
      } catch {
        // Ignore inspect errors
      }
    }

    return { health, gateway: gw, cli: cl, sandboxes, uptime };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  private async getManagedContainers() {
    const all = await this.client.listContainers(true);
    return all.filter(
      (c) => c.Labels?.[LABELS.managed] === "true",
    );
  }

  private async buildContainerStatus(
    c: { Id: string; Names?: string[]; State?: string; Labels?: Record<string, string> },
  ): Promise<ContainerStatus> {
    const name = (c.Names?.[0] ?? "").replace(/^\//, "");

    let cpu = 0;
    let memoryMB = 0;
    let networkRx = 0;
    let networkTx = 0;

    if (c.State === "running") {
      try {
        const stats = await this.client.getContainerStats(c.Id);
        cpu = this.calculateCpuPercent(stats as unknown as Record<string, unknown>);
        memoryMB = Math.round((stats.memory_stats?.usage ?? 0) / 1024 / 1024);
        const netStats = stats.networks?.eth0;
        networkRx = netStats?.rx_bytes ?? 0;
        networkTx = netStats?.tx_bytes ?? 0;
      } catch {
        // Stats may not be available
      }
    }

    const state = (c.State ?? "unknown") as ContainerStatus["state"];
    const health: EnvironmentHealth =
      state === "running" ? "healthy" : state === "dead" ? "unhealthy" : "stopped";

    return { id: c.Id, name, state, health, cpu, memoryMB, networkRx, networkTx };
  }

  private calculateCpuPercent(stats: Record<string, unknown>): number {
    const cpuStats = stats.cpu_stats as Record<string, Record<string, number>> | undefined;
    const precpuStats = stats.precpu_stats as Record<string, Record<string, number>> | undefined;
    const cpuDelta =
      (cpuStats?.cpu_usage?.total_usage ?? 0) -
      (precpuStats?.cpu_usage?.total_usage ?? 0);
    const systemDelta =
      ((cpuStats as Record<string, number> | undefined)?.system_cpu_usage ?? 0) -
      ((precpuStats as Record<string, number> | undefined)?.system_cpu_usage ?? 0);
    const numCpus = (cpuStats as Record<string, number> | undefined)?.online_cpus ?? 1;

    if (systemDelta > 0 && cpuDelta > 0) {
      return Math.round((cpuDelta / systemDelta) * numCpus * 100 * 100) / 100;
    }
    return 0;
  }

  private aggregateHealth(
    gateway: ContainerStatus,
    cli: ContainerStatus,
    sandboxes: ContainerStatus[],
  ): EnvironmentHealth {
    if (gateway.health === "unhealthy") { return "unhealthy"; }
    if (gateway.health === "stopped") { return "stopped"; }
    if (sandboxes.some((s) => s.health === "unhealthy")) { return "degraded"; }
    if (gateway.health === "healthy") { return "healthy"; }
    return "unknown";
  }
}
