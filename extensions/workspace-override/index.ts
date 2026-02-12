import fs from "node:fs/promises";
import path from "node:path";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";

/** Workspace files that can be overridden, in display order. */
const OVERRIDABLE_FILES = [
  "AGENTS.md",
  "SOUL.md",
  "TOOLS.md",
  "IDENTITY.md",
  "USER.md",
  "HEARTBEAT.md",
] as const;

function resolveOverridesDir(api: OpenClawPluginApi): string {
  const dir = (api.pluginConfig?.dir as string | undefined)?.trim();
  if (dir) return api.resolvePath(dir);
  // Default: bundled overrides/ folder next to this plugin's entry file.
  return path.join(path.dirname(api.source), "overrides");
}

/** Read all override files that exist in the overrides directory. */
async function loadOverrides(
  dir: string,
): Promise<Array<{ name: string; content: string }>> {
  const results: Array<{ name: string; content: string }> = [];
  for (const name of OVERRIDABLE_FILES) {
    try {
      const content = await fs.readFile(path.join(dir, name), "utf-8");
      const trimmed = content.trim();
      if (trimmed) {
        results.push({ name, content: trimmed });
      }
    } catch {
      // File doesn't exist — skip.
    }
  }
  return results;
}

/** Build the prependContext string from loaded overrides. */
export function buildOverrideContext(
  overrides: Array<{ name: string; content: string }>,
): string {
  const sections = overrides
    .map((o) => `## ${o.name} (override)\n\n${o.content}`)
    .join("\n\n");

  return [
    "<workspace-overrides>",
    "The following workspace file overrides take precedence over the corresponding files in Project Context.",
    "If a file appears here AND in Project Context, follow the override version.\n",
    sections,
    "</workspace-overrides>",
  ].join("\n");
}

const plugin = {
  id: "workspace-override",
  name: "Workspace Override",
  description: "Override default agent workspace .md documents with custom versions",

  register(api) {
    const overridesDir = resolveOverridesDir(api);

    api.on(
      "before_agent_start",
      async () => {
        const overrides = await loadOverrides(overridesDir);
        if (overrides.length === 0) return;

        api.logger.info?.(
          `workspace-override: injecting ${overrides.length} override(s) from ${overridesDir}`,
        );

        return { prependContext: buildOverrideContext(overrides) };
      },
      { priority: 50 },
    );
  },
};

export default plugin;
