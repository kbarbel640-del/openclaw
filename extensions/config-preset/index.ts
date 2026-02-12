import fs from "node:fs/promises";
import path from "node:path";
import JSON5 from "json5";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { OpenClawConfig } from "openclaw/plugin-sdk";

/**
 * Deep-merge `patch` into `base` (RFC 7396 semantics).
 * Only sets keys that are missing in `base` — never overwrites existing values.
 */
function mergeDefaults(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined) continue;

    if (
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof result[key] === "object" &&
      result[key] !== null &&
      !Array.isArray(result[key])
    ) {
      // Both sides are objects — recurse without overwriting.
      result[key] = mergeDefaults(
        result[key] as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    } else if (!(key in result)) {
      // Key missing in base — set it.
      result[key] = value;
    }
    // Key already exists in base — leave it untouched.
  }
  return result;
}

function resolvePresetPath(api: OpenClawPluginApi): string {
  const file = (api.pluginConfig?.file as string | undefined)?.trim();
  if (file) return api.resolvePath(file);
  return path.join(path.dirname(api.source), "preset.json5");
}

async function loadPreset(presetPath: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await fs.readFile(presetPath, "utf-8");
    const parsed = JSON5.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Marker key stored in config.meta to avoid re-applying. */
const APPLIED_KEY = "configPresetApplied";

const plugin = {
  id: "config-preset",
  name: "Config Preset",
  description: "Apply default config presets to openclaw.json on gateway start",

  register(api: OpenClawPluginApi) {
    const presetPath = resolvePresetPath(api);

    api.on("gateway_start", async () => {
      // Skip if already applied.
      const meta = api.config.meta as Record<string, unknown> | undefined;
      if (meta?.[APPLIED_KEY]) return;

      const preset = await loadPreset(presetPath);
      if (!preset) {
        api.logger.warn(`config-preset: could not load preset from ${presetPath}`);
        return;
      }

      try {
        // Dynamic import so we don't hard-depend on internal config IO at module level.
        const { readConfigFileSnapshot, writeConfigFile } = await import(
          "../../src/config/io.js"
        );

        const snapshot = await readConfigFileSnapshot();
        const current = (snapshot.config ?? {}) as Record<string, unknown>;
        const merged = mergeDefaults(current, preset) as OpenClawConfig;

        // Mark as applied so we don't re-run.
        merged.meta = {
          ...(merged.meta ?? {}),
          [APPLIED_KEY]: true,
        } as OpenClawConfig["meta"];

        await writeConfigFile(merged);
        api.logger.info(`config-preset: applied defaults from ${presetPath}`);
      } catch (err) {
        api.logger.error(`config-preset: failed to write config — ${String(err)}`);
      }
    });
  },
};

export default plugin;
export { mergeDefaults };
