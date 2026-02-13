import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { OpenClawConfig } from "../../config/config.js";
import { resolveConfigPath, resolveGatewayLockDir } from "../../config/paths.js";
import { buildGatewayReloadPlan, diffConfigPaths } from "../../gateway/config-reload.js";
import { theme } from "../../terminal/theme.js";

export interface ReloadResult {
  status: "hot" | "restart" | "not-running";
  reasons: string[];
}

/**
 * Resolve the gateway lock file path for the current config.
 * This mirrors the logic in gateway-lock.ts.
 */
function resolveGatewayLockPath(): string {
  const configPath = resolveConfigPath();
  const hash = createHash("sha1").update(configPath).digest("hex").slice(0, 8);
  const lockDir = resolveGatewayLockDir();
  return path.join(lockDir, `gateway.${hash}.lock`);
}

type LockPayload = {
  pid: number;
  createdAt: string;
  configPath: string;
  startTime?: number;
};

/**
 * Read the gateway lock file and extract the PID.
 * Returns null if gateway is not running.
 */
async function getGatewayPid(): Promise<number | null> {
  const lockPath = resolveGatewayLockPath();

  try {
    const raw = await fs.readFile(lockPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<LockPayload>;

    if (typeof parsed.pid !== "number" || parsed.pid <= 0) {
      return null;
    }

    // Check if the process is alive using kill(pid, 0)
    try {
      process.kill(parsed.pid, 0);
      return parsed.pid;
    } catch {
      // Process is not alive
      return null;
    }
  } catch {
    // Lock file doesn't exist or can't be read - gateway not running
    return null;
  }
}

/**
 * Check if the gateway is currently running.
 */
export async function isGatewayRunning(): Promise<boolean> {
  const pid = await getGatewayPid();
  return pid !== null;
}

/**
 * Determine the reload status after a config change.
 *
 * @param oldConfig - The previous config object
 * @param newConfig - The new config object
 * @param changedPath - The specific config path that was changed (e.g., "gateway.port")
 * @returns ReloadResult indicating whether the change requires hot reload, restart, or if gateway is not running
 */
export async function checkReloadStatus(
  oldConfig: OpenClawConfig,
  newConfig: OpenClawConfig,
  _changedPath: string,
): Promise<ReloadResult> {
  // Use diffConfigPaths to get all changed paths between configs
  const changedPaths = diffConfigPaths(oldConfig, newConfig);

  // If nothing changed, treat as hot reload (no action needed)
  if (changedPaths.length === 0) {
    return { status: "hot", reasons: [] };
  }

  // Build the reload plan using the existing gateway logic
  const plan = buildGatewayReloadPlan(changedPaths);

  // Check if gateway is running
  const gatewayPid = await getGatewayPid();
  if (gatewayPid === null) {
    return { status: "not-running", reasons: [] };
  }

  // Determine reload type based on the plan
  if (plan.restartGateway) {
    return {
      status: "restart",
      reasons: plan.restartReasons.length > 0 ? plan.restartReasons : changedPaths,
    };
  }

  return {
    status: "hot",
    reasons: plan.hotReasons.length > 0 ? plan.hotReasons : changedPaths,
  };
}

/**
 * Trigger a gateway restart by sending SIGUSR1 signal.
 * This triggers the graceful reload mechanism in the gateway.
 *
 * @returns true if the restart signal was sent successfully
 */
export async function triggerGatewayRestart(): Promise<boolean> {
  const gatewayPid = await getGatewayPid();

  if (gatewayPid === null) {
    return false;
  }

  try {
    process.kill(gatewayPid, "SIGUSR1");
    return true;
  } catch {
    return false;
  }
}

/**
 * Format the reload result for display in the CLI.
 * Returns the appropriate message based on the reload status.
 */
export function formatReloadMessage(result: ReloadResult, changedPath: string): string[] {
  const lines: string[] = [];

  switch (result.status) {
    case "hot":
      lines.push(theme.success("✅ Applied (hot reload)"));
      break;

    case "restart":
      lines.push(theme.warn("⚠️ Restart required"));
      if (result.reasons.length > 0) {
        const reasonText = result.reasons.join(", ");
        lines.push(`  ${reasonText} need${result.reasons.length === 1 ? "s" : ""} gateway restart`);
      } else {
        lines.push(`  ${changedPath} needs gateway restart`);
      }
      lines.push(`  ${theme.muted("Run:")} ${theme.command("openclaw gateway restart")}`);
      break;

    case "not-running":
      lines.push(theme.info("ℹ️ Applied (gateway not running)"));
      lines.push(`  ${theme.muted("Start with:")} ${theme.command("openclaw gateway start")}`);
      break;
  }

  return lines;
}
