/**
 * Sophie — OpenClaw Plugin
 * The Lab ® / Department of Vibe
 *
 * Full integration with OpenClaw's infrastructure:
 *   - 10 core editing/learning tools
 *   - 3 cron scheduling tools
 *   - 2 sub-agent delegation tools
 *   - 2 canvas visualization tools
 *   - 2 image handling tools
 *   - 1 metrics/observability tool
 *   - Lifecycle hooks (compaction, tool tracking, session, gateway)
 *   - Persistent memory (MEMORY.md, daily logs)
 *   - Heartbeat (proactive idle tasks)
 *   - File watching (catalog change detection)
 *   - Service lifecycle (startup/shutdown/health)
 *   - Observability (tool call metrics)
 */

import type { OpenClawPluginApi } from "../../src/plugins/types.js";
import { createSophieCanvasTools } from "./src/canvas.js";
import { createSophieCronTools } from "./src/cron.js";
import { registerSophieFileWatcher } from "./src/filewatcher.js";
import { setupSophieHeartbeat } from "./src/heartbeat.js";
import { registerSophieHooks } from "./src/hooks.js";
import { createSophieImageTools } from "./src/image-tools.js";
import { registerSophieLifecycle } from "./src/lifecycle.js";
import { registerSophieMemory } from "./src/memory.js";
import { createSophieMetricsTool } from "./src/observability.js";
import { registerSophieObservability } from "./src/observability.js";
import { loadSkills } from "./src/skill-loader.js";
import { createSophieSubagentTools } from "./src/subagents.js";
import { createSophieTools } from "./src/tools.js";

export default function register(api: OpenClawPluginApi) {
  // --- Tools ---
  const allTools = [
    ...createSophieTools(),
    ...createSophieCronTools(),
    ...createSophieSubagentTools(),
    ...createSophieCanvasTools(),
    ...createSophieImageTools(),
    createSophieMetricsTool(),
  ];

  for (const tool of allTools) {
    api.registerTool(tool);
  }

  // --- Hooks & Lifecycle ---
  registerSophieHooks(api);
  registerSophieMemory(api);
  registerSophieLifecycle(api);
  registerSophieObservability(api);
  registerSophieFileWatcher(api);
  setupSophieHeartbeat(api);

  // --- Photography Skills (async, non-blocking) ---
  loadSkills()
    .then((skills) => {
      api.logger.info(`[sophie] ${skills.length} photography skills loaded`);
    })
    .catch(() => {
      api.logger.warn("[sophie] Failed to load photography skills — continuing without");
    });

  api.logger.info(`[sophie] Plugin loaded — ${allTools.length} tools registered`);
}
