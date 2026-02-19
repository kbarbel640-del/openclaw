/**
 * Sophie's Memory Integration
 *
 * Bridges Sophie's editing knowledge with OpenClaw's memory system
 * so qualitative insights survive across sessions and are searchable.
 *
 * Memory entries include:
 * - Photographer's style observations ("always lifts shadows on portraits")
 * - Editing session summaries
 * - Feedback the photographer gave Sophie
 * - Scenario-specific notes
 */

import fs from "node:fs";
import path from "node:path";
import type { OpenClawPluginApi } from "../../../src/plugins/types.js";
import { getSophieSession } from "./session-bridge.js";

export function registerSophieMemory(api: OpenClawPluginApi): void {
  const workspaceDir = api.config.agents?.defaults?.workspace;
  if (!workspaceDir) {
    api.logger.warn("[sophie] No workspace configured — memory disabled");
    return;
  }

  const resolvedWorkspace = api.resolvePath(workspaceDir);

  // Write Sophie's knowledge to MEMORY.md for persistent context
  writeSophieMemory(resolvedWorkspace, api);

  // Refresh memory when sessions end (new knowledge may have been acquired)
  api.on("session_end", async () => {
    writeSophieMemory(resolvedWorkspace, api);
  });

  // After catalog ingestion, write a learning summary
  api.on("after_tool_call", async (event) => {
    if (event.toolName !== "sophie_ingest_catalog") return;
    if (event.error) return;

    const result = event.result as Record<string, unknown> | undefined;
    if (!result) return;

    const dateKey = new Date().toISOString().split("T")[0];
    const memoryDir = path.join(resolvedWorkspace, "memory");
    if (!fs.existsSync(memoryDir)) {
      fs.mkdirSync(memoryDir, { recursive: true });
    }

    const entry = [
      "",
      `## Catalog Ingestion — ${new Date().toISOString()}`,
      "",
      `Ingested catalog. Results:`,
      "```json",
      JSON.stringify(result, null, 2),
      "```",
      "",
    ].join("\n");

    const memoryPath = path.join(memoryDir, `${dateKey}.md`);
    fs.appendFileSync(memoryPath, entry, "utf-8");
    api.logger.debug("[sophie] Wrote ingestion summary to memory");
  });
}

function writeSophieMemory(workspaceDir: string, api: OpenClawPluginApi): void {
  let state;
  try {
    state = getSophieSession();
  } catch {
    return;
  }

  const editCount = state.styleDb.getEditCount();
  const scenarios = state.styleDb.listScenarios();

  const lines: string[] = [
    "# Sophie — Editing Knowledge",
    "",
    "## Overview",
    `- Total edits analyzed: ${editCount}`,
    `- Scenarios learned: ${scenarios.length}`,
    `- Last updated: ${new Date().toISOString()}`,
    "",
  ];

  if (scenarios.length > 0) {
    lines.push("## Known Scenarios");
    lines.push("");

    const highConf = scenarios.filter((s) => s.sampleCount >= 20);
    const goodConf = scenarios.filter((s) => s.sampleCount >= 10 && s.sampleCount < 20);
    const lowConf = scenarios.filter((s) => s.sampleCount < 10);

    if (highConf.length > 0) {
      lines.push("### High Confidence (20+ samples)");
      for (const s of highConf) {
        lines.push(`- **${s.label}** — ${s.sampleCount} samples`);
      }
      lines.push("");
    }

    if (goodConf.length > 0) {
      lines.push("### Good Confidence (10-19 samples)");
      for (const s of goodConf) {
        lines.push(`- **${s.label}** — ${s.sampleCount} samples`);
      }
      lines.push("");
    }

    if (lowConf.length > 0) {
      lines.push("### Low Confidence (<10 samples)");
      for (const s of lowConf) {
        lines.push(`- ${s.label} — ${s.sampleCount} samples`);
      }
      lines.push("");
    }
  }

  lines.push(
    "## Photographer Preferences",
    "",
    "_Updated automatically as Sophie learns. Photographer feedback is appended to daily memory logs._",
    "",
  );

  const memoryPath = path.join(workspaceDir, "MEMORY.md");
  try {
    const dir = path.dirname(memoryPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(memoryPath, lines.join("\n") + "\n", "utf-8");
    api.logger.debug("[sophie] Updated MEMORY.md");
  } catch (err) {
    api.logger.warn(`[sophie] Failed to write MEMORY.md: ${err}`);
  }
}
