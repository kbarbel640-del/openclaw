/**
 * Sophie's Heartbeat Configuration
 *
 * Writes a HEARTBEAT.md that tells Sophie what to do during idle periods.
 * OpenClaw reads this file periodically and runs the instructions.
 */

import fs from "node:fs";
import path from "node:path";
import type { OpenClawPluginApi } from "../../../src/plugins/types.js";
import { getSophieSession } from "./session-bridge.js";

export function setupSophieHeartbeat(api: OpenClawPluginApi): void {
  const workspaceDir = api.config.agents?.defaults?.workspace;
  if (!workspaceDir) return;

  const heartbeatPath = path.join(api.resolvePath(workspaceDir), "HEARTBEAT.md");

  // Write heartbeat instructions on gateway start
  api.on("gateway_start", async () => {
    writeHeartbeatFile(heartbeatPath, api);
  });

  // Refresh heartbeat after sessions end (state may have changed)
  api.on("session_end", async () => {
    writeHeartbeatFile(heartbeatPath, api);
  });
}

function writeHeartbeatFile(heartbeatPath: string, api: OpenClawPluginApi): void {
  let state;
  try {
    state = getSophieSession();
  } catch {
    return;
  }

  const editCount = state.styleDb.getEditCount();
  const scenarios = state.styleDb.listScenarios();
  const highConf = scenarios.filter((s) => s.sampleCount >= 20);

  const lines: string[] = [
    "# Sophie Heartbeat",
    "",
    "## Current State",
    `- Edits learned: ${editCount}`,
    `- Scenarios: ${scenarios.length} (${highConf.length} high confidence)`,
    `- Editing active: ${state.editingSession !== null}`,
    `- Observing: ${state.observing}`,
    "",
    "## Periodic Tasks",
    "",
  ];

  // Only add tasks if there's meaningful work to do
  if (editCount === 0) {
    lines.push(
      "1. Check if Lightroom is running. If so, remind the photographer that you can learn",
      "   their editing style by ingesting their catalog. Use `sophie_discover_catalogs` to",
      "   find available catalogs.",
    );
  } else if (editCount > 0 && editCount < 50) {
    lines.push(
      "1. You're still learning. Check if the catalog has new edits to ingest.",
      "   If so, run `sophie_ingest_catalog` to continue building your style profile.",
    );
  } else {
    lines.push(
      "1. Check the Lightroom catalog for new edits since last ingestion.",
      "   If new edits are found, run `sophie_ingest_catalog` to keep your style profile current.",
    );
  }

  lines.push(
    "",
    "2. If an editing session is active, check progress and report status.",
    "",
    "3. Keep responses concise. Status updates only — no unsolicited conversation.",
  );

  const content = lines.join("\n") + "\n";

  try {
    const dir = path.dirname(heartbeatPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(heartbeatPath, content, "utf-8");
    api.logger.debug(`[sophie] Wrote heartbeat to ${heartbeatPath}`);
  } catch (err) {
    api.logger.warn(`[sophie] Failed to write heartbeat: ${err}`);
  }
}
