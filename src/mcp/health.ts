/**
 * MCP health monitor — periodic health checks and auto-reconnect.
 *
 * Monitors connected MCP servers via ping and triggers reconnection
 * when a server becomes unresponsive.
 */

import { defaultRuntime } from "../runtime.js";
import type { McpServerConnection } from "./types.js";

const log = {
  info: (...args: unknown[]) => defaultRuntime.log("[mcp:health]", ...args),
  error: (...args: unknown[]) => defaultRuntime.error("[mcp:health]", ...args),
};

const DEFAULT_HEALTH_CHECK_INTERVAL_MS = 60_000;
const MAX_CONSECUTIVE_FAILURES = 3;

// ---------------------------------------------------------------------------
// Health check state per server
// ---------------------------------------------------------------------------

type HealthEntry = {
  connection: McpServerConnection;
  intervalMs: number;
  timer: ReturnType<typeof setInterval> | null;
  consecutiveFailures: number;
  reconnecting: boolean;
};

// ---------------------------------------------------------------------------
// McpHealthMonitor
// ---------------------------------------------------------------------------

/**
 * Manages periodic health checks for MCP server connections.
 *
 * Starts an interval per connection that sends a ping. After
 * `MAX_CONSECUTIVE_FAILURES` failed pings, triggers a reconnect.
 */
export class McpHealthMonitor {
  private entries: Map<string, HealthEntry> = new Map();
  private stopped = false;

  /**
   * Register a connection for health monitoring.
   *
   * @param connection - The MCP server connection.
   * @param intervalMs - Override health check interval (ms). Falls back to
   *                     the value from `connection.config.healthCheckIntervalMs`
   *                     or `DEFAULT_HEALTH_CHECK_INTERVAL_MS`.
   */
  register(connection: McpServerConnection, intervalMs?: number): void {
    if (this.stopped) {
      return;
    }

    const effectiveInterval =
      intervalMs ??
      connection.config.healthCheckIntervalMs ??
      DEFAULT_HEALTH_CHECK_INTERVAL_MS;

    if (effectiveInterval <= 0) {
      return;
    }

    // Don't double-register.
    if (this.entries.has(connection.name)) {
      return;
    }

    const entry: HealthEntry = {
      connection,
      intervalMs: effectiveInterval,
      timer: null,
      consecutiveFailures: 0,
      reconnecting: false,
    };

    entry.timer = setInterval(() => {
      void this.checkHealth(entry);
    }, effectiveInterval);

    // Don't prevent Node from exiting because of the timer.
    if (entry.timer && typeof entry.timer === "object" && "unref" in entry.timer) {
      entry.timer.unref();
    }

    this.entries.set(connection.name, entry);
    log.info(
      `Health checks enabled for "${connection.name}" every ${effectiveInterval}ms`,
    );
  }

  /**
   * Stop monitoring a specific server.
   */
  unregister(serverName: string): void {
    const entry = this.entries.get(serverName);
    if (entry?.timer) {
      clearInterval(entry.timer);
    }
    this.entries.delete(serverName);
  }

  /**
   * Stop all health checks and clean up.
   */
  stopAll(): void {
    this.stopped = true;
    for (const [name, entry] of this.entries) {
      if (entry.timer) {
        clearInterval(entry.timer);
      }
    }
    this.entries.clear();
  }

  /**
   * Get the current health status for all monitored servers.
   */
  getStatus(): ReadonlyMap<string, { consecutiveFailures: number; reconnecting: boolean }> {
    const result = new Map<string, { consecutiveFailures: number; reconnecting: boolean }>();
    for (const [name, entry] of this.entries) {
      result.set(name, {
        consecutiveFailures: entry.consecutiveFailures,
        reconnecting: entry.reconnecting,
      });
    }
    return result;
  }

  /**
   * Manually trigger a health check for a specific server (useful for testing).
   */
  async checkNow(serverName: string): Promise<boolean> {
    const entry = this.entries.get(serverName);
    if (!entry) {
      return false;
    }
    return this.checkHealth(entry);
  }

  /**
   * The number of monitored servers.
   */
  get size(): number {
    return this.entries.size;
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  private async checkHealth(entry: HealthEntry): Promise<boolean> {
    if (entry.reconnecting) {
      return false;
    }

    const healthy = await entry.connection.ping();

    if (healthy) {
      if (entry.consecutiveFailures > 0) {
        log.info(
          `"${entry.connection.name}" recovered after ${entry.consecutiveFailures} failed ping(s)`,
        );
      }
      entry.consecutiveFailures = 0;
      return true;
    }

    entry.consecutiveFailures++;
    log.error(
      `"${entry.connection.name}" ping failed (${entry.consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES})`,
    );

    if (entry.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      await this.attemptReconnect(entry);
    }

    return false;
  }

  private async attemptReconnect(entry: HealthEntry): Promise<void> {
    entry.reconnecting = true;

    log.info(`Attempting reconnect for "${entry.connection.name}"...`);

    try {
      await entry.connection.reconnect();
      entry.consecutiveFailures = 0;
      log.info(`"${entry.connection.name}" reconnected successfully`);
    } catch (err) {
      log.error(
        `"${entry.connection.name}" reconnect failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      entry.reconnecting = false;
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton instance
// ---------------------------------------------------------------------------

let globalMonitor: McpHealthMonitor | null = null;

/**
 * Get or create the global health monitor instance.
 */
export function getMcpHealthMonitor(): McpHealthMonitor {
  if (!globalMonitor) {
    globalMonitor = new McpHealthMonitor();
  }
  return globalMonitor;
}

/**
 * Stop and dispose the global health monitor.
 */
export function stopGlobalHealthMonitor(): void {
  globalMonitor?.stopAll();
  globalMonitor = null;
}

/**
 * Reset the global monitor (for testing).
 */
export function resetHealthMonitorForTest(): void {
  globalMonitor?.stopAll();
  globalMonitor = null;
}
