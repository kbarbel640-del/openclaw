import type { OpenClawConfig, ConfigFileSnapshot } from "./types.openclaw.js";
import { validateConfigObjectWithPlugins } from "./validation.js";
import {
  applyModelDefaults,
  applyAgentDefaults,
  applySessionDefaults,
  applyLoggingDefaults,
  applyMessageDefaults,
  applyTalkApiKey,
} from "./defaults.js";
import { normalizeConfigPaths } from "./normalize-paths.js";

/**
 * Fetch config from the OCM metadata HTTP endpoint.
 * Returns a ConfigFileSnapshot compatible with the existing reload pipeline.
 */
export async function readMetadataConfigSnapshot(
  metadataUrl: string,
): Promise<ConfigFileSnapshot> {
  const nonce = process.env.OCM_METADATA_NONCE || "";

  let response: Response;
  try {
    response = await fetch(`${metadataUrl}/v1/config`, {
      headers: nonce ? { "X-Metadata-Nonce": nonce } : {},
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    // Network error — return exists:false so the reload pipeline retries
    return {
      path: "<metadata>",
      exists: false,
      raw: null,
      parsed: undefined,
      resolved: {} as OpenClawConfig,
      valid: false,
      config: {} as OpenClawConfig,
      issues: [{ path: "", message: `metadata fetch failed: ${String(err)}` }],
      warnings: [],
      legacyIssues: [],
    };
  }

  if (!response.ok) {
    return {
      path: "<metadata>",
      exists: false,
      raw: null,
      parsed: undefined,
      resolved: {} as OpenClawConfig,
      valid: false,
      config: {} as OpenClawConfig,
      issues: [{ path: "", message: `metadata HTTP ${response.status}: ${response.statusText}` }],
      warnings: [],
      legacyIssues: [],
    };
  }

  const raw = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      path: "<metadata>",
      exists: true,
      raw,
      parsed: undefined,
      resolved: {} as OpenClawConfig,
      valid: false,
      config: {} as OpenClawConfig,
      issues: [{ path: "", message: `metadata config JSON parse error: ${String(err)}` }],
      warnings: [],
      legacyIssues: [],
    };
  }

  // Validate with plugin support (same as file-based path)
  const validated = validateConfigObjectWithPlugins(parsed);
  if (!validated.ok) {
    return {
      path: "<metadata>",
      exists: true,
      raw,
      parsed,
      resolved: {} as OpenClawConfig,
      valid: false,
      config: {} as OpenClawConfig,
      issues: validated.issues,
      warnings: validated.warnings,
      legacyIssues: [],
    };
  }

  // Apply runtime defaults (same chain as file-based path)
  const snapshotConfig = normalizeConfigPaths(
    applyTalkApiKey(
      applyModelDefaults(
        applyAgentDefaults(
          applySessionDefaults(applyLoggingDefaults(applyMessageDefaults(validated.config))),
        ),
      ),
    ),
  );

  return {
    path: "<metadata>",
    exists: true,
    raw,
    parsed,
    resolved: validated.config,
    valid: true,
    config: snapshotConfig,
    issues: [],
    warnings: validated.warnings,
    legacyIssues: [],
  };
}

/**
 * Start a poller that checks /v1/config-version every N seconds
 * and triggers reload when version changes.
 *
 * Uses the sentinel file approach: writes /tmp/.ocm-config-changed
 * so chokidar picks up the change and triggers the existing reload pipeline.
 */
export function startMetadataConfigPoller(opts: {
  metadataUrl: string;
  pollIntervalMs?: number;
  sentinelPath?: string;
  log: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
}): { stop: () => void } {
  const pollIntervalMs = opts.pollIntervalMs ?? 5000;
  const sentinelPath = opts.sentinelPath ?? "/tmp/.ocm-config-changed";
  const nonce = process.env.OCM_METADATA_NONCE || "";
  let lastVersion = -1;
  let timer: ReturnType<typeof setInterval> | null = null;
  let stopped = false;

  const poll = async () => {
    if (stopped) return;

    try {
      const response = await fetch(`${opts.metadataUrl}/v1/config-version`, {
        headers: nonce ? { "X-Metadata-Nonce": nonce } : {},
        signal: AbortSignal.timeout(5_000),
      });

      if (!response.ok) {
        opts.log.warn(`metadata config-version: HTTP ${response.status}`);
        return;
      }

      const data = (await response.json()) as { version: number };
      const version = data.version;

      if (lastVersion === -1) {
        // First poll — just record the version
        lastVersion = version;
        opts.log.info(`metadata config poller started (version=${version})`);
        return;
      }

      if (version !== lastVersion) {
        opts.log.info(`metadata config version changed: ${lastVersion} -> ${version}`);
        lastVersion = version;

        // Write sentinel file to trigger chokidar watcher
        try {
          const { writeFileSync } = await import("node:fs");
          writeFileSync(sentinelPath, String(version), "utf-8");
        } catch (err) {
          opts.log.error(`failed to write sentinel file: ${String(err)}`);
        }
      }
    } catch (err) {
      opts.log.warn(`metadata config-version poll failed: ${String(err)}`);
    }
  };

  // Start polling
  void poll();
  timer = setInterval(() => void poll(), pollIntervalMs);

  return {
    stop: () => {
      stopped = true;
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
}
