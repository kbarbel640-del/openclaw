/**
 * Plugin Detector — SophieConnect Plugin Availability
 *
 * Probes localhost:47290 to check if the SophieConnect Lightroom plugin
 * is running and responsive. Used by the LightroomController to decide
 * whether to use TCP (fast, direct) or Peekaboo (screenshot-based).
 */

import { Socket } from "node:net";

export interface PluginDetectorConfig {
  host: string;
  port: number;
  probeTimeoutMs: number;
}

const DEFAULT_CONFIG: PluginDetectorConfig = {
  host: "127.0.0.1",
  port: 47290,
  probeTimeoutMs: 2000,
};

/** Cache for plugin availability */
let pluginAvailable: boolean | null = null;
let lastProbeTime = 0;
const PROBE_CACHE_MS = 30_000; // Re-probe every 30 seconds

/**
 * Check if the SophieConnect plugin is running on the expected port.
 * Results are cached for 30 seconds.
 */
export async function isPluginAvailable(
  config: Partial<PluginDetectorConfig> = {},
): Promise<boolean> {
  const now = Date.now();

  // Return cached result if recent
  if (pluginAvailable !== null && now - lastProbeTime < PROBE_CACHE_MS) {
    return pluginAvailable;
  }

  const opts = { ...DEFAULT_CONFIG, ...config };
  pluginAvailable = await probePort(opts.host, opts.port, opts.probeTimeoutMs);
  lastProbeTime = now;

  if (pluginAvailable) {
    console.log(`[PluginDetector] SophieConnect plugin detected on port ${opts.port}`);
  }

  return pluginAvailable;
}

/**
 * Force a fresh probe, ignoring the cache.
 */
export async function forceProbe(config: Partial<PluginDetectorConfig> = {}): Promise<boolean> {
  pluginAvailable = null;
  lastProbeTime = 0;
  return isPluginAvailable(config);
}

/**
 * Reset the availability cache.
 */
export function resetPluginDetectorCache(): void {
  pluginAvailable = null;
  lastProbeTime = 0;
}

/**
 * Probe a TCP port to check if something is listening.
 */
function probePort(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new Socket();

    socket.setTimeout(timeoutMs);

    socket.connect(port, host, () => {
      // Try sending a ping command
      socket.write(JSON.stringify({ action: "ping" }) + "\n");
    });

    socket.on("data", (data) => {
      const response = data.toString().trim();
      try {
        const parsed = JSON.parse(response) as { status?: string };
        socket.destroy();
        resolve(parsed.status === "ok");
      } catch {
        socket.destroy();
        // Something responded but not our plugin
        resolve(false);
      }
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });

    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });
  });
}
