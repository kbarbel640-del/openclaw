/**
 * Cloud.ru Proxy Docker Lifecycle
 *
 * Utilities for checking Docker availability, starting the proxy container,
 * and waiting for it to become healthy. Used by both interactive and
 * non-interactive onboarding flows.
 */

import {
  CLOUDRU_COMPOSE_FILENAME,
  CLOUDRU_PROXY_PORT_DEFAULT,
} from "../config/cloudru-fm.constants.js";
import { runExec } from "../process/exec.js";
import { sleep } from "../utils.js";
import { checkProxyHealth, clearProxyHealthCache } from "./cloudru-proxy-health.js";

export type DockerAvailability = {
  available: boolean;
  composeAvailable: boolean;
  reason?: string;
};

export type ProxyStartResult = {
  ok: boolean;
  error?: string;
};

export type ProxyHealthWaitResult = {
  ok: boolean;
  latencyMs?: number;
  attempts: number;
  error?: string;
};

/**
 * Check whether Docker and Docker Compose are available on the system.
 */
export async function checkDockerAvailability(): Promise<DockerAvailability> {
  try {
    await runExec("docker", ["info", "--format", "{{.ServerVersion}}"], 5_000);
  } catch {
    return {
      available: false,
      composeAvailable: false,
      reason: "Docker is not installed or not running",
    };
  }

  try {
    await runExec("docker", ["compose", "version", "--short"], 5_000);
  } catch {
    return {
      available: true,
      composeAvailable: false,
      reason: "Docker Compose plugin is not installed",
    };
  }

  return { available: true, composeAvailable: true };
}

/**
 * Start the proxy container using the Docker Compose file in the workspace.
 */
export async function startProxyContainer(params: {
  workspaceDir: string;
  composeFilename?: string;
}): Promise<ProxyStartResult> {
  const filename = params.composeFilename ?? CLOUDRU_COMPOSE_FILENAME;

  try {
    await runExec("docker", ["compose", "-f", filename, "up", "-d", "--wait"], {
      timeoutMs: 60_000,
    });
    // Clear any cached health failure so the next check is fresh
    clearProxyHealthCache();
    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

/**
 * Poll the proxy health endpoint until it reports healthy or max attempts exhausted.
 */
export async function waitForProxyHealth(params?: {
  proxyUrl?: string;
  maxAttempts?: number;
  intervalMs?: number;
}): Promise<ProxyHealthWaitResult> {
  const proxyUrl = params?.proxyUrl ?? `http://127.0.0.1:${CLOUDRU_PROXY_PORT_DEFAULT}`;
  const maxAttempts = params?.maxAttempts ?? 10;
  const intervalMs = params?.intervalMs ?? 2_000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    clearProxyHealthCache();
    const result = await checkProxyHealth(proxyUrl);
    if (result.ok) {
      return { ok: true, latencyMs: result.latencyMs, attempts: attempt };
    }
    if (attempt < maxAttempts) {
      await sleep(intervalMs);
    }
  }

  return {
    ok: false,
    attempts: maxAttempts,
    error: `Proxy at ${proxyUrl} did not become healthy after ${maxAttempts} attempts`,
  };
}
