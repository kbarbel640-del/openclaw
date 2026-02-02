/**
 * Lifecycle state tracking for crash detection.
 *
 * Tracks gateway process state to disk. On startup, if the previous state
 * was "running", we know the gateway crashed rather than shut down cleanly.
 *
 * This enables:
 * - Crash detection on restart
 * - Recovery hooks that can resume interrupted work
 * - Uptime tracking
 */

import fs from "node:fs/promises";
import path from "node:path";
import { CONFIG_DIR } from "../utils.js";

const LIFECYCLE_PATH = path.join(CONFIG_DIR, "lifecycle.json");

export type LifecycleState = {
  version: 1;
  pid: number;
  startedAt: number;
  lastHeartbeat: number;
  status: "starting" | "running" | "stopping" | "stopped";
};

export type PreviousShutdown = {
  time: number;
  reason: "clean" | "crash" | "unknown";
  uptime?: number;
};

async function loadLifecycleState(): Promise<LifecycleState | null> {
  try {
    const content = await fs.readFile(LIFECYCLE_PATH, "utf-8");
    return JSON.parse(content) as LifecycleState;
  } catch {
    return null;
  }
}

async function saveLifecycleState(state: LifecycleState): Promise<void> {
  await fs.mkdir(path.dirname(LIFECYCLE_PATH), { recursive: true });
  const tmp = `${LIFECYCLE_PATH}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(state, null, 2), "utf-8");
  await fs.rename(tmp, LIFECYCLE_PATH);
}

/**
 * Call on gateway startup, before full initialization.
 * Returns info about the previous shutdown if we can detect a crash.
 */
export async function markLifecycleStarting(): Promise<PreviousShutdown | null> {
  const previous = await loadLifecycleState();
  let previousShutdown: PreviousShutdown | null = null;

  if (previous) {
    if (previous.status === "running") {
      // Previous state was "running" but we're starting up = crash
      previousShutdown = {
        time: previous.lastHeartbeat,
        reason: "crash",
        uptime: previous.lastHeartbeat - previous.startedAt,
      };
    } else if (previous.status === "stopped") {
      previousShutdown = {
        time: previous.lastHeartbeat,
        reason: "clean",
        uptime: previous.lastHeartbeat - previous.startedAt,
      };
    } else {
      previousShutdown = {
        time: previous.lastHeartbeat,
        reason: "unknown",
      };
    }
  }

  await saveLifecycleState({
    version: 1,
    pid: process.pid,
    startedAt: Date.now(),
    lastHeartbeat: Date.now(),
    status: "starting",
  });

  return previousShutdown;
}

/**
 * Call after gateway is fully initialized and ready to serve.
 */
export async function markLifecycleRunning(): Promise<void> {
  const state = await loadLifecycleState();
  if (state && state.pid === process.pid) {
    state.status = "running";
    state.lastHeartbeat = Date.now();
    await saveLifecycleState(state);
  }
}

/**
 * Call when gateway is beginning clean shutdown.
 */
export async function markLifecycleStopping(): Promise<void> {
  const state = await loadLifecycleState();
  if (state && state.pid === process.pid) {
    state.status = "stopping";
    state.lastHeartbeat = Date.now();
    await saveLifecycleState(state);
  }
}

/**
 * Call after gateway has fully stopped.
 */
export async function markLifecycleStopped(): Promise<void> {
  const state = await loadLifecycleState();
  if (state && state.pid === process.pid) {
    state.status = "stopped";
    state.lastHeartbeat = Date.now();
    await saveLifecycleState(state);
  }
}

/**
 * Update heartbeat timestamp. Call periodically to track liveness.
 */
export async function updateLifecycleHeartbeat(): Promise<void> {
  const state = await loadLifecycleState();
  if (state && state.pid === process.pid) {
    state.lastHeartbeat = Date.now();
    await saveLifecycleState(state);
  }
}

/**
 * Get current lifecycle state (for diagnostics).
 */
export async function getLifecycleState(): Promise<LifecycleState | null> {
  return loadLifecycleState();
}
