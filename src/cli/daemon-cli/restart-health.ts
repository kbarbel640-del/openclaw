import fs from "node:fs/promises";
import type { GatewayServiceRuntime } from "../../daemon/service-runtime.js";
import type { GatewayService } from "../../daemon/service.js";
import {
  classifyPortListener,
  formatPortDiagnostics,
  inspectPortUsage,
  type PortUsage,
} from "../../infra/ports.js";
import { sleep } from "../../utils.js";

export const DEFAULT_RESTART_HEALTH_TIMEOUT_MS = 60_000;
export const DEFAULT_RESTART_HEALTH_DELAY_MS = 500;
export const DEFAULT_RESTART_HEALTH_ATTEMPTS = Math.ceil(
  DEFAULT_RESTART_HEALTH_TIMEOUT_MS / DEFAULT_RESTART_HEALTH_DELAY_MS,
);

export type GatewayRestartSnapshot = {
  runtime: GatewayServiceRuntime;
  portUsage: PortUsage;
  healthy: boolean;
  staleGatewayPids: number[];
};

/**
 * Read the parent PID of a process from /proc on Linux.
 * Returns `null` on non-Linux platforms or if the read fails.
 */
export async function readParentPid(pid: number): Promise<number | null> {
  if (process.platform !== "linux") {
    return null;
  }
  try {
    const status = await fs.readFile(`/proc/${pid}/status`, "utf8");
    for (const line of status.split("\n")) {
      if (line.startsWith("PPid:")) {
        const ppid = Number.parseInt(line.slice("PPid:".length).trim(), 10);
        return Number.isFinite(ppid) && ppid > 0 ? ppid : null;
      }
    }
  } catch {
    // Process may have exited or /proc unavailable.
  }
  return null;
}

/**
 * Check whether `descendantPid` is a child/grandchild of `ancestorPid`.
 * Walks the PPid chain up to a small cap to avoid infinite loops.
 */
async function isDescendantOfPid(descendantPid: number, ancestorPid: number): Promise<boolean> {
  let current: number | null = descendantPid;
  let hops = 0;
  while (current != null && current > 0 && hops < 32) {
    const ppid = await readParentPid(current);
    if (ppid === ancestorPid) {
      return true;
    }
    if (ppid == null || ppid === current) {
      return false;
    }
    current = ppid;
    hops += 1;
  }
  return false;
}

export async function inspectGatewayRestart(params: {
  service: GatewayService;
  port: number;
  env?: NodeJS.ProcessEnv;
}): Promise<GatewayRestartSnapshot> {
  const env = params.env ?? process.env;
  let runtime: GatewayServiceRuntime = { status: "unknown" };
  try {
    runtime = await params.service.readRuntime(env);
  } catch (err) {
    runtime = { status: "unknown", detail: String(err) };
  }

  let portUsage: PortUsage;
  try {
    portUsage = await inspectPortUsage(params.port);
  } catch (err) {
    portUsage = {
      port: params.port,
      status: "unknown",
      listeners: [],
      hints: [],
      errors: [String(err)],
    };
  }

  const gatewayListeners =
    portUsage.status === "busy"
      ? portUsage.listeners.filter(
          (listener) => classifyPortListener(listener, params.port) === "gateway",
        )
      : [];
  const running = runtime.status === "running";

  // Check if the runtime PID directly owns the port, or if a child process
  // of the runtime PID owns it (e.g. Node.js worker/child that binds the port).
  let ownsPort: boolean;
  if (runtime.pid != null) {
    const directMatch = portUsage.listeners.some((listener) => listener.pid === runtime.pid);
    if (directMatch) {
      ownsPort = true;
    } else {
      const childChecks = await Promise.all(
        gatewayListeners
          .filter((listener) => listener.pid != null && listener.pid !== runtime.pid)
          .map(async (listener) => isDescendantOfPid(listener.pid!, runtime.pid!)),
      );
      ownsPort = childChecks.some(Boolean);
    }
  } else {
    ownsPort =
      gatewayListeners.length > 0 ||
      (portUsage.status === "busy" && portUsage.listeners.length === 0);
  }

  const healthy = running && ownsPort;

  // Build the set of child PIDs of the runtime process so we don't mark them
  // as stale — they are legitimate children of the current gateway.
  const childPidSet = new Set<number>();
  if (runtime.pid != null && running) {
    const results = await Promise.all(
      gatewayListeners
        .map((listener) => listener.pid)
        .filter((pid): pid is number => Number.isFinite(pid) && pid !== runtime.pid)
        .map(async (pid) => ({ pid, isChild: await isDescendantOfPid(pid, runtime.pid!) })),
    );
    for (const { pid, isChild } of results) {
      if (isChild) {
        childPidSet.add(pid);
      }
    }
  }

  const staleGatewayPids = Array.from(
    new Set(
      gatewayListeners
        .map((listener) => listener.pid)
        .filter((pid): pid is number => Number.isFinite(pid))
        .filter((pid) => runtime.pid == null || pid !== runtime.pid || !running)
        .filter((pid) => !childPidSet.has(pid)),
    ),
  );

  return {
    runtime,
    portUsage,
    healthy,
    staleGatewayPids,
  };
}

export async function waitForGatewayHealthyRestart(params: {
  service: GatewayService;
  port: number;
  attempts?: number;
  delayMs?: number;
  env?: NodeJS.ProcessEnv;
}): Promise<GatewayRestartSnapshot> {
  const attempts = params.attempts ?? DEFAULT_RESTART_HEALTH_ATTEMPTS;
  const delayMs = params.delayMs ?? DEFAULT_RESTART_HEALTH_DELAY_MS;

  let snapshot = await inspectGatewayRestart({
    service: params.service,
    port: params.port,
    env: params.env,
  });

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (snapshot.healthy) {
      return snapshot;
    }
    if (snapshot.staleGatewayPids.length > 0 && snapshot.runtime.status !== "running") {
      return snapshot;
    }
    await sleep(delayMs);
    snapshot = await inspectGatewayRestart({
      service: params.service,
      port: params.port,
      env: params.env,
    });
  }

  return snapshot;
}

export function renderRestartDiagnostics(snapshot: GatewayRestartSnapshot): string[] {
  const lines: string[] = [];
  const runtimeSummary = [
    snapshot.runtime.status ? `status=${snapshot.runtime.status}` : null,
    snapshot.runtime.state ? `state=${snapshot.runtime.state}` : null,
    snapshot.runtime.pid != null ? `pid=${snapshot.runtime.pid}` : null,
    snapshot.runtime.lastExitStatus != null ? `lastExit=${snapshot.runtime.lastExitStatus}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  if (runtimeSummary) {
    lines.push(`Service runtime: ${runtimeSummary}`);
  }

  if (snapshot.portUsage.status === "busy") {
    lines.push(...formatPortDiagnostics(snapshot.portUsage));
  } else {
    lines.push(`Gateway port ${snapshot.portUsage.port} status: ${snapshot.portUsage.status}.`);
  }

  if (snapshot.portUsage.errors?.length) {
    lines.push(`Port diagnostics errors: ${snapshot.portUsage.errors.join("; ")}`);
  }

  return lines;
}

export async function terminateStaleGatewayPids(pids: number[]): Promise<number[]> {
  const killed: number[] = [];
  for (const pid of pids) {
    try {
      process.kill(pid, "SIGTERM");
      killed.push(pid);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code !== "ESRCH") {
        throw err;
      }
    }
  }

  if (killed.length === 0) {
    return killed;
  }

  await sleep(400);

  for (const pid of killed) {
    try {
      process.kill(pid, 0);
      process.kill(pid, "SIGKILL");
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code !== "ESRCH") {
        throw err;
      }
    }
  }

  return killed;
}
