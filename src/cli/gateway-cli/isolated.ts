import { randomBytes } from "node:crypto";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { writeConfigFile } from "../../config/config.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { resolveUserPath } from "../../utils.js";
import { applyCliProfileEnv } from "../profile.js";

const gatewayLog = createSubsystemLogger("gateway");

export type SetupIsolatedGatewayOptions = {
  port?: number | null;
};

/**
 * Scaffold a fully isolated gateway environment. Creates a unique
 * profile with its own state dir, writes minimal config, sets all
 * SKIP env vars, and registers cleanup on process exit.
 *
 * Returns the resolved state dir so callers can inspect it.
 */
export async function setupIsolatedGateway(
  opts: SetupIsolatedGatewayOptions = {},
): Promise<{ stateDir: string; profile: string }> {
  const suffix = randomBytes(4).toString("hex");
  const profile = `test-${suffix}`;

  // Apply profile env vars (OPENCLAW_STATE_DIR, OPENCLAW_CONFIG_PATH,
  // OPENCLAW_PROFILE). State dir becomes ~/.openclaw-test-<hex>.
  applyCliProfileEnv({ profile });

  const stateDir = process.env.OPENCLAW_STATE_DIR!;

  // Skip all channels and sidecars for clean isolation.
  process.env.OPENCLAW_SKIP_CHANNELS = "1";
  process.env.OPENCLAW_SKIP_BROWSER_CONTROL_SERVER = "1";
  process.env.OPENCLAW_SKIP_CANVAS_HOST = "1";
  process.env.OPENCLAW_SKIP_GMAIL_WATCHER = "1";
  process.env.OPENCLAW_SKIP_CRON = "1";

  // If no explicit port, signal auto-pick via env.
  if (opts.port != null && opts.port > 0) {
    process.env.OPENCLAW_GATEWAY_PORT = String(opts.port);
  }

  // Create minimal directory structure.
  const workspaceDir = path.join(stateDir, "workspace");
  await fs.mkdir(path.join(stateDir, "agents", "main", "sessions"), {
    recursive: true,
  });
  await fs.mkdir(workspaceDir, { recursive: true });

  // Write minimal config.
  const resolvedWorkspace = resolveUserPath(workspaceDir);
  await writeConfigFile({
    gateway: {
      mode: "local",
      bind: "loopback",
    },
    agents: {
      defaults: {
        workspace: resolvedWorkspace,
        skipBootstrap: true,
      },
      list: [
        {
          id: "test",
          default: true,
          workspace: resolvedWorkspace,
        },
      ],
    },
  });

  // Register cleanup on process exit. Synchronous removal is the
  // only reliable option inside the "exit" event handler.
  const cleanup = () => {
    try {
      fsSync.rmSync(stateDir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup.
    }
  };
  process.on("exit", cleanup);

  gatewayLog.info(`isolated profile "${profile}"`);
  gatewayLog.info(`isolated state dir "${stateDir}"`);

  return { stateDir, profile };
}
