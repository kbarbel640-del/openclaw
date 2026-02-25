/**
 * Config Bridge
 *
 * Maps between OpenClaw's config system and TheLabConfig.
 * Allows Sophie's settings to be configured through OpenClaw's
 * openclaw.json while maintaining backward compatibility with
 * standalone TheLabConfig.
 */

import os from "node:os";
import path from "node:path";
import { DEFAULT_CONFIG } from "../../../src/thelab/config/defaults.js";
import type { TheLabConfig } from "../../../src/thelab/config/thelab-config.js";
import { resolveConfigPaths } from "../../../src/thelab/config/thelab-config.js";

/**
 * Plugin-level config that can be set in openclaw.json under plugins.sophie
 */
export interface SophiePluginConfig {
  catalogPath?: string;
  styleDbPath?: string;
  observerPollMs?: number;
  minSamplesForProfile?: number;
  lightroomAppName?: string;
  notifyPhone?: string;
  visionModel?: string;
}

/**
 * Merge OpenClaw plugin config with TheLabConfig defaults.
 * OpenClaw config values override defaults.
 */
export function buildTheLabConfig(pluginConfig?: SophiePluginConfig): TheLabConfig {
  const base = { ...DEFAULT_CONFIG };

  if (pluginConfig?.catalogPath) {
    base.learning.catalogPath = pluginConfig.catalogPath;
  }
  if (pluginConfig?.styleDbPath) {
    base.learning.styleDbPath = pluginConfig.styleDbPath;
  }
  if (pluginConfig?.observerPollMs) {
    base.learning.observerPollMs = pluginConfig.observerPollMs;
  }
  if (pluginConfig?.minSamplesForProfile) {
    base.learning.minSamplesForProfile = pluginConfig.minSamplesForProfile;
  }
  if (pluginConfig?.lightroomAppName) {
    base.lightroom.appName = pluginConfig.lightroomAppName;
  }
  if (pluginConfig?.visionModel) {
    base.models.visionModel = pluginConfig.visionModel;
  }

  return resolveConfigPaths(base);
}

/**
 * Get the default Sophie workspace directory.
 * Used when OpenClaw doesn't specify a workspace.
 */
export function getDefaultWorkspace(): string {
  return path.join(os.homedir(), ".thelab");
}
