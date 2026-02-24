/**
 * Docker Engine Client — thin wrapper around the Docker Engine API.
 *
 * Uses `dockerode` for all Docker operations. This module provides the
 * low-level Docker primitives that the ContainerManager orchestrates.
 *
 * All Docker-specific terminology stays inside this module — callers
 * use our abstracted types from ipc-types.ts.
 */

import Dockerode from "dockerode";

export class DockerEngineClient {
  private docker: Dockerode;

  constructor(socketPath?: string) {
    this.docker = new Dockerode(
      socketPath ? { socketPath } : undefined,
    );
  }

  /** Get the raw dockerode instance for advanced operations. */
  getEngine(): Dockerode {
    return this.docker;
  }

  /** Ping the Docker daemon to check connectivity. */
  async ping(): Promise<boolean> {
    try {
      await this.docker.ping();
      return true;
    } catch {
      return false;
    }
  }

  /** Get Docker system info. */
  async info(): Promise<Record<string, unknown>> {
    return this.docker.info() as Promise<Record<string, unknown>>;
  }

  /** List all containers (running and stopped). */
  async listContainers(all = true): Promise<Dockerode.ContainerInfo[]> {
    return this.docker.listContainers({ all });
  }

  /** Get a container by ID. */
  getContainer(id: string): Dockerode.Container {
    return this.docker.getContainer(id);
  }

  /** Inspect a container for detailed info. */
  async inspectContainer(id: string): Promise<Dockerode.ContainerInspectInfo> {
    return this.docker.getContainer(id).inspect();
  }

  /** Start a container. */
  async startContainer(id: string): Promise<void> {
    await this.docker.getContainer(id).start();
  }

  /** Stop a container gracefully. */
  async stopContainer(id: string, timeout = 10): Promise<void> {
    await this.docker.getContainer(id).stop({ t: timeout });
  }

  /** Remove a container. */
  async removeContainer(id: string, force = false): Promise<void> {
    await this.docker.getContainer(id).remove({ force, v: true });
  }

  /** Get real-time container stats. */
  async getContainerStats(id: string): Promise<Dockerode.ContainerStats> {
    return this.docker.getContainer(id).stats({ stream: false });
  }

  /** Pull an image by name. Returns a progress stream. */
  async pullImage(imageName: string): Promise<NodeJS.ReadableStream> {
    return this.docker.pull(imageName);
  }

  /** Build an image from a Dockerfile context. */
  async buildImage(
    context: string,
    options: { dockerfile?: string; t?: string; buildargs?: Record<string, string> },
  ): Promise<NodeJS.ReadableStream> {
    return this.docker.buildImage(
      { context, src: ["."] },
      {
        dockerfile: options.dockerfile ?? "Dockerfile",
        t: options.t,
        buildargs: options.buildargs,
      },
    );
  }

  /** List all images. */
  async listImages(): Promise<Dockerode.ImageInfo[]> {
    return this.docker.listImages();
  }

  /** Check if an image exists locally. */
  async imageExists(name: string): Promise<boolean> {
    try {
      await this.docker.getImage(name).inspect();
      return true;
    } catch {
      return false;
    }
  }

  /** Create a Docker network. */
  async createNetwork(name: string): Promise<Dockerode.Network> {
    return this.docker.createNetwork({
      Name: name,
      Driver: "bridge",
      CheckDuplicate: true,  // Prevent silent duplicate network creation
      Internal: false,
      Labels: { "ai.openclaw.managed": "true" },
    });
  }

  /** List networks managed by OCCC. */
  async listManagedNetworks(): Promise<Dockerode.NetworkInspectInfo[]> {
    const networks = await this.docker.listNetworks({
      filters: { label: ["ai.openclaw.managed=true"] },
    });
    return networks;
  }

  /** Create a named volume for persistent data. */
  async createVolume(name: string): Promise<Dockerode.VolumeCreateResponse> {
    return this.docker.createVolume({
      Name: name,
      Labels: { "ai.openclaw.managed": "true" },
    });
  }

  /** List volumes managed by OCCC. */
  async listManagedVolumes(): Promise<Dockerode.VolumeInspectInfo[]> {
    const result = await this.docker.listVolumes({
      filters: { label: ["ai.openclaw.managed=true"] },
    });
    return result.Volumes ?? [];
  }

  /** Remove a network by ID. */
  async removeNetwork(id: string): Promise<void> {
    await this.docker.getNetwork(id).remove();
  }

  /** Remove a named volume. */
  async removeVolume(name: string): Promise<void> {
    await this.docker.getVolume(name).remove({});
  }

  /** Create and start a container with security hardening. */
  async createContainer(options: {
    name: string;
    image: string;
    cmd?: string[];
    env?: string[];
    ports?: Record<string, number>;
    volumes?: Record<string, string>;
    network?: string;
    labels?: Record<string, string>;
  }): Promise<Dockerode.Container> {
    const portBindings: Record<string, { HostPort: string }[]> = {};
    const exposedPorts: Record<string, Record<string, never>> = {};

    if (options.ports) {
      for (const [containerPort, hostPort] of Object.entries(options.ports)) {
        const key = `${containerPort}/tcp`;
        portBindings[key] = [{ HostPort: String(hostPort) }];
        exposedPorts[key] = {};
      }
    }

    const binds: string[] = [];
    if (options.volumes) {
      for (const [hostPath, containerPath] of Object.entries(options.volumes)) {
        binds.push(`${hostPath}:${containerPath}`);
      }
    }

    const container = await this.docker.createContainer({
      name: options.name,
      Image: options.image,
      Cmd: options.cmd,
      Env: options.env,
      ExposedPorts: exposedPorts,
      Labels: {
        "ai.openclaw.managed": "true",
        ...options.labels,
      },
      HostConfig: {
        PortBindings: portBindings,
        Binds: binds,
        NetworkMode: options.network,
        // Security hardening (non-root, capabilities dropped)
        Init: true,
        RestartPolicy: { Name: "unless-stopped" },
        CapDrop: ["ALL"],
        SecurityOpt: ["no-new-privileges:true"],
        ReadonlyRootfs: false, // OpenClaw needs writable /tmp
      },
      // Security: run as non-root user (node, uid 1000)
      User: "1000:1000",
    });

    return container;
  }

  /** Get logs from a container. */
  async getContainerLogs(
    id: string,
    options: { tail?: number; since?: number } = {},
  ): Promise<string> {
    const logs = await this.docker.getContainer(id).logs({
      stdout: true,
      stderr: true,
      tail: options.tail ?? 100,
      since: options.since,
      timestamps: true,
    });
    return logs.toString();
  }
}
