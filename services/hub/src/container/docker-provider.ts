import { randomBytes } from "node:crypto";
import type { ContainerProvider, SpawnResult, StartResult, RestartResult } from "./provider.js";
import { generateDeviceIdentity, buildPairedDevicesJson } from "../gateway/device-auth.js";

let Docker: typeof import("dockerode") | null = null;

async function getDocker(): Promise<InstanceType<typeof import("dockerode")>> {
  if (!Docker) {
    try {
      Docker = (await import("dockerode")).default;
    } catch {
      throw new Error("Docker is not available — dockerode module not installed");
    }
  }
  return new Docker();
}

// Forward LLM provider keys from the hub's env to spawned containers
function getPassthroughEnv(): string[] {
  const keys = [
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "GOOGLE_API_KEY",
    "CLAUDE_AI_SESSION_KEY",
    "CLAUDE_WEB_SESSION_KEY",
    "CLAUDE_WEB_COOKIE",
  ];
  const env: string[] = [];
  for (const key of keys) {
    const val = process.env[key];
    if (val) {
      env.push(`${key}=${val}`);
    }
  }
  return env;
}

function extractUrls(ports: Record<string, Array<{ HostPort: string }>>): {
  gatewayUrl: string;
  bridgeUrl: string;
} | null {
  const gatewayPort = ports["18789/tcp"]?.[0]?.HostPort;
  const bridgePort = ports["18790/tcp"]?.[0]?.HostPort;
  if (!gatewayPort || !bridgePort) {
    return null;
  }
  return {
    gatewayUrl: `ws://127.0.0.1:${gatewayPort}`,
    bridgeUrl: `http://127.0.0.1:${bridgePort}`,
  };
}

export class DockerProvider implements ContainerProvider {
  async spawn(params: { name: string; image: string }): Promise<SpawnResult> {
    const docker = await getDocker();

    const gatewayToken = randomBytes(32).toString("hex");
    const device = generateDeviceIdentity();

    const configJson = JSON.stringify({
      gateway: {
        mode: "local",
        controlUi: {
          allowInsecureAuth: true,
          dangerouslyDisableDeviceAuth: true,
        },
      },
      agents: {
        defaults: {
          model: { primary: "openai/gpt-5.2" },
        },
      },
    });
    const pairedJson = buildPairedDevicesJson(device);

    const container = await docker.createContainer({
      Image: params.image,
      name: `openclaw-${params.name.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`,
      Env: [
        "HOME=/home/node",
        "TERM=xterm-256color",
        `OPENCLAW_GATEWAY_TOKEN=${gatewayToken}`,
        ...getPassthroughEnv(),
      ],
      Cmd: [
        "sh",
        "-c",
        `mkdir -p /home/node/.openclaw/devices` +
          ` && [ -f /home/node/.openclaw/openclaw.json ] || printf '%s' '${configJson}' > /home/node/.openclaw/openclaw.json` +
          ` && [ -f /home/node/.openclaw/devices/paired.json ] || printf '%s' '${pairedJson}' > /home/node/.openclaw/devices/paired.json` +
          ` && exec node dist/index.js gateway --bind lan --port 18789`,
      ],
      ExposedPorts: {
        "18789/tcp": {},
        "18790/tcp": {},
      },
      HostConfig: {
        PublishAllPorts: true,
        Init: true,
        RestartPolicy: { Name: "unless-stopped" },
      },
    });

    await container.start();

    const info = await container.inspect();
    const urls = extractUrls(info.NetworkSettings.Ports);

    if (!urls) {
      try {
        await container.stop();
        await container.remove();
      } catch {
        /* best effort */
      }
      throw new Error("Failed to discover container ports");
    }

    return {
      containerId: info.Id,
      gatewayUrl: urls.gatewayUrl,
      gatewayToken,
      bridgeUrl: urls.bridgeUrl,
      deviceCredentials: {
        deviceId: device.deviceId,
        publicKeyPem: device.publicKeyPem,
        privateKeyPem: device.privateKeyPem,
        publicKeyBase64Url: device.publicKeyBase64Url,
      },
    };
  }

  async start(containerId: string): Promise<StartResult> {
    const docker = await getDocker();
    const container = docker.getContainer(containerId);
    await container.start();

    const info = await container.inspect();
    const urls = extractUrls(info.NetworkSettings.Ports);
    if (!urls) {
      throw new Error("Failed to discover container ports after start");
    }
    return urls;
  }

  async stop(containerId: string): Promise<void> {
    const docker = await getDocker();
    const container = docker.getContainer(containerId);
    await container.stop();
  }

  async remove(containerId: string): Promise<void> {
    const docker = await getDocker();
    const container = docker.getContainer(containerId);
    try {
      await container.stop();
    } catch {
      /* may already be stopped */
    }
    await container.remove();
  }

  async getLogs(containerId: string, tail = 200): Promise<string> {
    const docker = await getDocker();
    const container = docker.getContainer(containerId);
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail,
      timestamps: true,
    });
    return typeof logs === "string" ? logs : logs.toString("utf-8");
  }

  async getStatus(containerId: string): Promise<string> {
    const docker = await getDocker();
    const container = docker.getContainer(containerId);
    const info = await container.inspect();
    return info.State.Status;
  }

  async getRestartMarker(containerId: string): Promise<string> {
    const docker = await getDocker();
    const container = docker.getContainer(containerId);
    const info = await container.inspect();
    return info.State.StartedAt;
  }

  async waitForRestart(
    containerId: string,
    marker: string,
    opts?: { timeoutMs?: number },
  ): Promise<RestartResult> {
    const docker = await getDocker();
    const container = docker.getContainer(containerId);
    const deadline = Date.now() + (opts?.timeoutMs ?? 30_000);

    while (Date.now() < deadline) {
      const info = await container.inspect();
      if (info.State.StartedAt !== marker && info.State.Status === "running") {
        const urls = extractUrls(info.NetworkSettings.Ports);
        if (urls) {
          return urls;
        }
      }
      await new Promise((r) => setTimeout(r, 1_000));
    }
    throw new Error("Container did not restart within timeout");
  }
}
