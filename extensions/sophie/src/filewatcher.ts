/**
 * Sophie's File Watcher
 *
 * Monitors the Lightroom catalog file for changes, triggering
 * notifications when new edits are detected. Uses OpenClaw's
 * hook system to integrate with the session lifecycle.
 */

import fs from "node:fs";
import type { OpenClawPluginApi } from "../../../src/plugins/types.js";
import { discoverActiveCatalog } from "../../../src/thelab/learning/catalog-discovery.js";
import { getSophieSession } from "./session-bridge.js";

interface CatalogWatchState {
  path: string;
  lastSize: number;
  lastModified: number;
  checkInterval: ReturnType<typeof setInterval> | null;
}

let watchState: CatalogWatchState | null = null;

export function registerSophieFileWatcher(api: OpenClawPluginApi): void {
  api.on("gateway_start", async () => {
    startWatching(api);
  });

  api.on("gateway_stop", async () => {
    stopWatching();
  });
}

function startWatching(api: OpenClawPluginApi): void {
  const active = discoverActiveCatalog();
  if (!active) {
    api.logger.debug("[sophie] No active Lightroom catalog found — file watcher disabled");
    return;
  }

  try {
    const stat = fs.statSync(active.path);
    watchState = {
      path: active.path,
      lastSize: stat.size,
      lastModified: stat.mtimeMs,
      checkInterval: null,
    };

    // Poll every 60 seconds (Lightroom locks the DB, so chokidar can't watch it)
    watchState.checkInterval = setInterval(() => {
      checkForChanges(api);
    }, 60_000);

    api.logger.info(`[sophie] Watching catalog: ${active.path}`);
  } catch (err) {
    api.logger.warn(`[sophie] Failed to start catalog watcher: ${err}`);
  }
}

function stopWatching(): void {
  if (watchState?.checkInterval) {
    clearInterval(watchState.checkInterval);
    watchState.checkInterval = null;
  }
  watchState = null;
}

function checkForChanges(api: OpenClawPluginApi): void {
  if (!watchState) return;

  try {
    const stat = fs.statSync(watchState.path);

    if (stat.mtimeMs > watchState.lastModified || stat.size !== watchState.lastSize) {
      const sizeDelta = stat.size - watchState.lastSize;
      api.logger.info(
        `[sophie] Catalog changed: size ${sizeDelta >= 0 ? "+" : ""}${sizeDelta} bytes`,
      );

      watchState.lastSize = stat.size;
      watchState.lastModified = stat.mtimeMs;
    }
  } catch {
    // Catalog may be temporarily locked by Lightroom
  }
}
