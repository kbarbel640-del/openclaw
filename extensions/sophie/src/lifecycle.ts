/**
 * Sophie's Plugin Lifecycle
 *
 * Manages startup and shutdown of Sophie's stateful resources:
 * - StyleDatabase connection
 * - File watchers
 * - Metric flushing
 */

import type { OpenClawPluginApi } from "../../../src/plugins/types.js";
import { buildTheLabConfig, type SophiePluginConfig } from "./config-bridge.js";
import { getSophieSession, closeSophieSession } from "./session-bridge.js";

export function registerSophieLifecycle(api: OpenClawPluginApi): void {
  const pluginConfig = api.pluginConfig as SophiePluginConfig | undefined;

  api.registerService({
    name: "sophie-editor",
    description: "Sophie's photo editing engine — manages style database and editing sessions",

    async start() {
      api.logger.info("[sophie] Initializing...");

      // Build config from plugin settings
      const config = buildTheLabConfig(pluginConfig);

      // Initialize session state (lazy, but we warm it here)
      const state = getSophieSession();

      const editCount = state.styleDb.getEditCount();
      const scenarios = state.styleDb.listScenarios();

      api.logger.info(
        `[sophie] Ready. ${editCount} edits learned across ${scenarios.length} scenarios.`,
      );
    },

    async stop() {
      api.logger.info("[sophie] Shutting down...");
      closeSophieSession();
      api.logger.info("[sophie] Clean shutdown complete.");
    },

    async health() {
      try {
        const state = getSophieSession();
        const editCount = state.styleDb.getEditCount();
        return {
          status: "healthy" as const,
          details: {
            editsLearned: editCount,
            editingActive: state.editingSession !== null,
            observing: state.observing,
          },
        };
      } catch (err) {
        return {
          status: "unhealthy" as const,
          details: {
            error: err instanceof Error ? err.message : String(err),
          },
        };
      }
    },
  });
}
