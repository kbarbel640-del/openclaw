import type { Command } from "commander";
import path from "node:path";
import type { OpenClawConfig } from "../config/config.js";
import type { PluginRecord } from "../plugins/registry.js";
import { formatDocsLink } from "../terminal/links.js";
import { theme } from "../terminal/theme.js";

export type PluginsListOptions = {
  json?: boolean;
  enabled?: boolean;
  verbose?: boolean;
};

export type PluginInfoOptions = {
  json?: boolean;
};

export type PluginUpdateOptions = {
  all?: boolean;
  dryRun?: boolean;
};

export type PluginUninstallOptions = {
  keepFiles?: boolean;
  keepConfig?: boolean;
  force?: boolean;
  dryRun?: boolean;
};

function resolveFileNpmSpecToLocalPath(
  raw: string,
): { ok: true; path: string } | { ok: false; error: string } | null {
  const trimmed = raw.trim();
  if (!trimmed.toLowerCase().startsWith("file:")) {
    return null;
  }
  const rest = trimmed.slice("file:".length);
  if (!rest) {
    return { ok: false, error: "unsupported file: spec: missing path" };
  }
  if (rest.startsWith("///")) {
    // file:///abs/path -> /abs/path
    return { ok: true, path: rest.slice(2) };
  }
  if (rest.startsWith("//localhost/")) {
    // file://localhost/abs/path -> /abs/path
    return { ok: true, path: rest.slice("//localhost".length) };
  }
  if (rest.startsWith("//")) {
    return {
      ok: false,
      error: 'unsupported file: URL host (expected "file:<path>" or "file:///abs/path")',
    };
  }
  return { ok: true, path: rest };
}

function formatPluginLine(
  plugin: PluginRecord,
  verbose = false,
  shortenHomeInString: (s: string) => string,
): string {
  const status =
    plugin.status === "loaded"
      ? theme.success("loaded")
      : plugin.status === "disabled"
        ? theme.warn("disabled")
        : theme.error("error");
  const name = theme.command(plugin.name || plugin.id);
  const idSuffix = plugin.name && plugin.name !== plugin.id ? theme.muted(` (${plugin.id})`) : "";
  const desc = plugin.description
    ? theme.muted(
        plugin.description.length > 60
          ? `${plugin.description.slice(0, 57)}...`
          : plugin.description,
      )
    : theme.muted("(no description)");

  if (!verbose) {
    return `${name}${idSuffix} ${status} - ${desc}`;
  }

  const parts = [
    `${name}${idSuffix} ${status}`,
    `  source: ${theme.muted(shortenHomeInString(plugin.source))}`,
    `  origin: ${plugin.origin}`,
  ];
  if (plugin.version) {
    parts.push(`  version: ${plugin.version}`);
  }
  if (plugin.providerIds.length > 0) {
    parts.push(`  providers: ${plugin.providerIds.join(", ")}`);
  }
  if (plugin.error) {
    parts.push(theme.error(`  error: ${plugin.error}`));
  }
  return parts.join("\n");
}

function applySlotSelectionForPlugin(
  config: OpenClawConfig,
  pluginId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildPluginStatusReport: (...args: any[]) => any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  applyExclusiveSlotSelection: (...args: any[]) => any,
): { config: OpenClawConfig; warnings: string[] } {
  const report = buildPluginStatusReport({ config });
  const plugin = report.plugins.find(
    (entry: { id: string; kind: string }) => entry.id === pluginId,
  );
  if (!plugin) {
    return { config, warnings: [] };
  }
  const result = applyExclusiveSlotSelection({
    config,
    selectedId: plugin.id,
    selectedKind: plugin.kind,
    registry: report,
  });
  return { config: result.config, warnings: result.warnings };
}

function createPluginInstallLogger(runtime: { log: (msg: string) => void }): {
  info: (msg: string) => void;
  warn: (msg: string) => void;
} {
  return {
    info: (msg) => runtime.log(msg),
    warn: (msg) => runtime.log(theme.warn(msg)),
  };
}

function enablePluginInConfig(config: OpenClawConfig, pluginId: string): OpenClawConfig {
  return {
    ...config,
    plugins: {
      ...config.plugins,
      entries: {
        ...config.plugins?.entries,
        [pluginId]: {
          ...(config.plugins?.entries?.[pluginId] as object | undefined),
          enabled: true,
        },
      },
    },
  };
}

function logSlotWarnings(warnings: string[], runtime: { log: (msg: string) => void }) {
  if (warnings.length === 0) {
    return;
  }
  for (const warning of warnings) {
    runtime.log(theme.warn(warning));
  }
}

export function registerPluginsCli(program: Command) {
  const plugins = program
    .command("plugins")
    .description("Manage OpenClaw plugins/extensions")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/plugins", "docs.openclaw.ai/cli/plugins")}\n`,
    );

  plugins
    .command("list")
    .description("List discovered plugins")
    .option("--json", "Print JSON")
    .option("--enabled", "Only show enabled plugins", false)
    .option("--verbose", "Show detailed entries", false)
    .action(async (opts: PluginsListOptions) => {
      const { defaultRuntime } = await import("../runtime.js");
      const { buildPluginStatusReport } = await import("../plugins/status.js");
      const { resolvePluginSourceRoots, formatPluginSourceForTable } =
        await import("../plugins/source-display.js");
      const { renderTable } = await import("../terminal/table.js");
      const { shortenHomeInString } = await import("../utils.js");

      const report = buildPluginStatusReport();
      const list = opts.enabled
        ? report.plugins.filter((p) => p.status === "loaded")
        : report.plugins;

      if (opts.json) {
        const payload = {
          workspaceDir: report.workspaceDir,
          plugins: list,
          diagnostics: report.diagnostics,
        };
        defaultRuntime.log(JSON.stringify(payload, null, 2));
        return;
      }

      if (list.length === 0) {
        defaultRuntime.log(theme.muted("No plugins found."));
        return;
      }

      const loaded = list.filter((p) => p.status === "loaded").length;
      defaultRuntime.log(
        `${theme.heading("Plugins")} ${theme.muted(`(${loaded}/${list.length} loaded)`)}`,
      );

      if (!opts.verbose) {
        const tableWidth = Math.max(60, (process.stdout.columns ?? 120) - 1);
        const sourceRoots = resolvePluginSourceRoots({
          workspaceDir: report.workspaceDir,
        });
        const usedRoots = new Set<keyof typeof sourceRoots>();
        const rows = list.map((plugin) => {
          const desc = plugin.description ? theme.muted(plugin.description) : "";
          const formattedSource = formatPluginSourceForTable(plugin, sourceRoots);
          if (formattedSource.rootKey) {
            usedRoots.add(formattedSource.rootKey);
          }
          const sourceLine = desc ? `${formattedSource.value}\n${desc}` : formattedSource.value;
          return {
            Name: plugin.name || plugin.id,
            ID: plugin.name && plugin.name !== plugin.id ? plugin.id : "",
            Status:
              plugin.status === "loaded"
                ? theme.success("loaded")
                : plugin.status === "disabled"
                  ? theme.warn("disabled")
                  : theme.error("error"),
            Source: sourceLine,
            Version: plugin.version ?? "",
          };
        });

        if (usedRoots.size > 0) {
          defaultRuntime.log(theme.muted("Source roots:"));
          for (const key of ["stock", "workspace", "global"] as const) {
            if (!usedRoots.has(key)) {
              continue;
            }
            const dir = sourceRoots[key];
            if (!dir) {
              continue;
            }
            defaultRuntime.log(`  ${theme.command(`${key}:`)} ${theme.muted(dir)}`);
          }
          defaultRuntime.log("");
        }

        defaultRuntime.log(
          renderTable({
            width: tableWidth,
            columns: [
              { key: "Name", header: "Name", minWidth: 14, flex: true },
              { key: "ID", header: "ID", minWidth: 10, flex: true },
              { key: "Status", header: "Status", minWidth: 10 },
              { key: "Source", header: "Source", minWidth: 26, flex: true },
              { key: "Version", header: "Version", minWidth: 8 },
            ],
            rows,
          }).trimEnd(),
        );
        return;
      }

      const lines: string[] = [];
      for (const plugin of list) {
        lines.push(formatPluginLine(plugin, true, shortenHomeInString));
        lines.push("");
      }
      defaultRuntime.log(lines.join("\n").trim());
    });

  plugins
    .command("info")
    .description("Show plugin details")
    .argument("<id>", "Plugin id")
    .option("--json", "Print JSON")
    .action(async (id: string, opts: PluginInfoOptions) => {
      const { defaultRuntime } = await import("../runtime.js");
      const { buildPluginStatusReport } = await import("../plugins/status.js");
      const { loadConfig } = await import("../config/config.js");
      const { shortenHomeInString, shortenHomePath } = await import("../utils.js");

      const report = buildPluginStatusReport();
      const plugin = report.plugins.find((p) => p.id === id || p.name === id);
      if (!plugin) {
        defaultRuntime.error(`Plugin not found: ${id}`);
        process.exit(1);
      }
      const cfg = loadConfig();
      const install = cfg.plugins?.installs?.[plugin.id];

      if (opts.json) {
        defaultRuntime.log(JSON.stringify(plugin, null, 2));
        return;
      }

      const lines: string[] = [];
      lines.push(theme.heading(plugin.name || plugin.id));
      if (plugin.name && plugin.name !== plugin.id) {
        lines.push(theme.muted(`id: ${plugin.id}`));
      }
      if (plugin.description) {
        lines.push(plugin.description);
      }
      lines.push("");
      lines.push(`${theme.muted("Status:")} ${plugin.status}`);
      lines.push(`${theme.muted("Source:")} ${shortenHomeInString(plugin.source)}`);
      lines.push(`${theme.muted("Origin:")} ${plugin.origin}`);
      if (plugin.version) {
        lines.push(`${theme.muted("Version:")} ${plugin.version}`);
      }
      if (plugin.toolNames.length > 0) {
        lines.push(`${theme.muted("Tools:")} ${plugin.toolNames.join(", ")}`);
      }
      if (plugin.hookNames.length > 0) {
        lines.push(`${theme.muted("Hooks:")} ${plugin.hookNames.join(", ")}`);
      }
      if (plugin.gatewayMethods.length > 0) {
        lines.push(`${theme.muted("Gateway methods:")} ${plugin.gatewayMethods.join(", ")}`);
      }
      if (plugin.providerIds.length > 0) {
        lines.push(`${theme.muted("Providers:")} ${plugin.providerIds.join(", ")}`);
      }
      if (plugin.cliCommands.length > 0) {
        lines.push(`${theme.muted("CLI commands:")} ${plugin.cliCommands.join(", ")}`);
      }
      if (plugin.services.length > 0) {
        lines.push(`${theme.muted("Services:")} ${plugin.services.join(", ")}`);
      }
      if (plugin.error) {
        lines.push(`${theme.error("Error:")} ${plugin.error}`);
      }
      if (install) {
        lines.push("");
        lines.push(`${theme.muted("Install:")} ${install.source}`);
        if (install.spec) {
          lines.push(`${theme.muted("Spec:")} ${install.spec}`);
        }
        if (install.sourcePath) {
          lines.push(`${theme.muted("Source path:")} ${shortenHomePath(install.sourcePath)}`);
        }
        if (install.installPath) {
          lines.push(`${theme.muted("Install path:")} ${shortenHomePath(install.installPath)}`);
        }
        if (install.version) {
          lines.push(`${theme.muted("Recorded version:")} ${install.version}`);
        }
        if (install.installedAt) {
          lines.push(`${theme.muted("Installed at:")} ${install.installedAt}`);
        }
      }
      defaultRuntime.log(lines.join("\n"));
    });

  plugins
    .command("enable")
    .description("Enable a plugin in config")
    .argument("<id>", "Plugin id")
    .action(async (id: string) => {
      const { defaultRuntime } = await import("../runtime.js");
      const { loadConfig, writeConfigFile } = await import("../config/config.js");
      const { buildPluginStatusReport } = await import("../plugins/status.js");
      const { applyExclusiveSlotSelection } = await import("../plugins/slots.js");

      const cfg = loadConfig();
      let next: OpenClawConfig = {
        ...cfg,
        plugins: {
          ...cfg.plugins,
          entries: {
            ...cfg.plugins?.entries,
            [id]: {
              ...(cfg.plugins?.entries as Record<string, { enabled?: boolean }> | undefined)?.[id],
              enabled: true,
            },
          },
        },
      };
      const slotResult = applySlotSelectionForPlugin(
        next,
        id,
        buildPluginStatusReport,
        applyExclusiveSlotSelection,
      );
      next = slotResult.config;
      await writeConfigFile(next);
      logSlotWarnings(slotResult.warnings, defaultRuntime);
      defaultRuntime.log(`Enabled plugin "${id}". Restart the gateway to apply.`);
    });

  plugins
    .command("disable")
    .description("Disable a plugin in config")
    .argument("<id>", "Plugin id")
    .action(async (id: string) => {
      const { defaultRuntime } = await import("../runtime.js");
      const { loadConfig, writeConfigFile } = await import("../config/config.js");

      const cfg = loadConfig();
      const next = {
        ...cfg,
        plugins: {
          ...cfg.plugins,
          entries: {
            ...cfg.plugins?.entries,
            [id]: {
              ...(cfg.plugins?.entries as Record<string, { enabled?: boolean }> | undefined)?.[id],
              enabled: false,
            },
          },
        },
      };
      await writeConfigFile(next);
      defaultRuntime.log(`Disabled plugin "${id}". Restart the gateway to apply.`);
    });

  plugins
    .command("uninstall")
    .description("Uninstall a plugin")
    .argument("<id>", "Plugin id")
    .option("--keep-files", "Keep installed files on disk", false)
    .option("--keep-config", "Deprecated alias for --keep-files", false)
    .option("--force", "Skip confirmation prompt", false)
    .option("--dry-run", "Show what would be removed without making changes", false)
    .action(async (id: string, opts: PluginUninstallOptions) => {
      const os = await import("node:os");
      const { defaultRuntime } = await import("../runtime.js");
      const { loadConfig, writeConfigFile } = await import("../config/config.js");
      const { resolveStateDir } = await import("../config/paths.js");
      const { buildPluginStatusReport } = await import("../plugins/status.js");
      const { resolveUninstallDirectoryTarget, uninstallPlugin } =
        await import("../plugins/uninstall.js");
      const { shortenHomePath } = await import("../utils.js");
      const { promptYesNo } = await import("./prompt.js");

      const cfg = loadConfig();
      const report = buildPluginStatusReport({ config: cfg });
      const extensionsDir = path.join(resolveStateDir(process.env, os.homedir), "extensions");
      const keepFiles = Boolean(opts.keepFiles || opts.keepConfig);

      if (opts.keepConfig) {
        defaultRuntime.log(theme.warn("`--keep-config` is deprecated, use `--keep-files`."));
      }

      // Find plugin by id or name
      const plugin = report.plugins.find((p) => p.id === id || p.name === id);
      const pluginId = plugin?.id ?? id;

      // Check if plugin exists in config
      const hasEntry = pluginId in (cfg.plugins?.entries ?? {});
      const hasInstall = pluginId in (cfg.plugins?.installs ?? {});

      if (!hasEntry && !hasInstall) {
        if (plugin) {
          defaultRuntime.error(
            `Plugin "${pluginId}" is not managed by plugins config/install records and cannot be uninstalled.`,
          );
        } else {
          defaultRuntime.error(`Plugin not found: ${id}`);
        }
        process.exit(1);
      }

      const install = cfg.plugins?.installs?.[pluginId];
      const isLinked = install?.source === "path";

      // Build preview of what will be removed
      const preview: string[] = [];
      if (hasEntry) {
        preview.push("config entry");
      }
      if (hasInstall) {
        preview.push("install record");
      }
      if (cfg.plugins?.allow?.includes(pluginId)) {
        preview.push("allowlist entry");
      }
      if (
        isLinked &&
        install?.sourcePath &&
        cfg.plugins?.load?.paths?.includes(install.sourcePath)
      ) {
        preview.push("load path");
      }
      if (cfg.plugins?.slots?.memory === pluginId) {
        preview.push(`memory slot (will reset to "memory-core")`);
      }
      const deleteTarget = !keepFiles
        ? resolveUninstallDirectoryTarget({
            pluginId,
            hasInstall,
            installRecord: install,
            extensionsDir,
          })
        : null;
      if (deleteTarget) {
        preview.push(`directory: ${shortenHomePath(deleteTarget)}`);
      }

      const pluginName = plugin?.name || pluginId;
      defaultRuntime.log(
        `Plugin: ${theme.command(pluginName)}${pluginName !== pluginId ? theme.muted(` (${pluginId})`) : ""}`,
      );
      defaultRuntime.log(`Will remove: ${preview.length > 0 ? preview.join(", ") : "(nothing)"}`);

      if (opts.dryRun) {
        defaultRuntime.log(theme.muted("Dry run, no changes made."));
        return;
      }

      if (!opts.force) {
        const confirmed = await promptYesNo(`Uninstall plugin "${pluginId}"?`);
        if (!confirmed) {
          defaultRuntime.log("Cancelled.");
          return;
        }
      }

      const result = await uninstallPlugin({
        config: cfg,
        pluginId,
        deleteFiles: !keepFiles,
        extensionsDir,
      });

      if (!result.ok) {
        defaultRuntime.error(result.error);
        process.exit(1);
      }
      for (const warning of result.warnings) {
        defaultRuntime.log(theme.warn(warning));
      }

      await writeConfigFile(result.config);

      const removed: string[] = [];
      if (result.actions.entry) {
        removed.push("config entry");
      }
      if (result.actions.install) {
        removed.push("install record");
      }
      if (result.actions.allowlist) {
        removed.push("allowlist");
      }
      if (result.actions.loadPath) {
        removed.push("load path");
      }
      if (result.actions.memorySlot) {
        removed.push("memory slot");
      }
      if (result.actions.directory) {
        removed.push("directory");
      }

      defaultRuntime.log(
        `Uninstalled plugin "${pluginId}". Removed: ${removed.length > 0 ? removed.join(", ") : "nothing"}.`,
      );
      defaultRuntime.log("Restart the gateway to apply changes.");
    });

  plugins
    .command("install")
    .description("Install a plugin (path, archive, or npm spec)")
    .argument("<path-or-spec>", "Path (.ts/.js/.zip/.tgz/.tar.gz) or an npm package spec")
    .option("-l, --link", "Link a local path instead of copying", false)
    .action(async (raw: string, opts: { link?: boolean }) => {
      const fs = await import("node:fs");
      const { defaultRuntime } = await import("../runtime.js");
      const { loadConfig, writeConfigFile } = await import("../config/config.js");
      const { resolveArchiveKind } = await import("../infra/archive.js");
      const { installPluginFromNpmSpec, installPluginFromPath } =
        await import("../plugins/install.js");
      const { recordPluginInstall } = await import("../plugins/installs.js");
      const { buildPluginStatusReport } = await import("../plugins/status.js");
      const { applyExclusiveSlotSelection } = await import("../plugins/slots.js");
      const { resolveUserPath, shortenHomePath } = await import("../utils.js");

      const fileSpec = resolveFileNpmSpecToLocalPath(raw);
      if (fileSpec && !fileSpec.ok) {
        defaultRuntime.error(fileSpec.error);
        process.exit(1);
      }
      const normalized = fileSpec && fileSpec.ok ? fileSpec.path : raw;
      const resolved = resolveUserPath(normalized);
      const cfg = loadConfig();

      if (fs.existsSync(resolved)) {
        if (opts.link) {
          const existing = cfg.plugins?.load?.paths ?? [];
          const merged = Array.from(new Set([...existing, resolved]));
          const probe = await installPluginFromPath({ path: resolved, dryRun: true });
          if (!probe.ok) {
            defaultRuntime.error(probe.error);
            process.exit(1);
          }

          let next: OpenClawConfig = enablePluginInConfig(
            {
              ...cfg,
              plugins: {
                ...cfg.plugins,
                load: {
                  ...cfg.plugins?.load,
                  paths: merged,
                },
              },
            },
            probe.pluginId,
          );
          next = recordPluginInstall(next, {
            pluginId: probe.pluginId,
            source: "path",
            sourcePath: resolved,
            installPath: resolved,
            version: probe.version,
          });
          const slotResult = applySlotSelectionForPlugin(
            next,
            probe.pluginId,
            buildPluginStatusReport,
            applyExclusiveSlotSelection,
          );
          next = slotResult.config;
          await writeConfigFile(next);
          logSlotWarnings(slotResult.warnings, defaultRuntime);
          defaultRuntime.log(`Linked plugin path: ${shortenHomePath(resolved)}`);
          defaultRuntime.log(`Restart the gateway to load plugins.`);
          return;
        }

        const result = await installPluginFromPath({
          path: resolved,
          logger: createPluginInstallLogger(defaultRuntime),
        });
        if (!result.ok) {
          defaultRuntime.error(result.error);
          process.exit(1);
        }

        let next = enablePluginInConfig(cfg, result.pluginId);
        const source: "archive" | "path" = resolveArchiveKind(resolved) ? "archive" : "path";
        next = recordPluginInstall(next, {
          pluginId: result.pluginId,
          source,
          sourcePath: resolved,
          installPath: result.targetDir,
          version: result.version,
        });
        const slotResult = applySlotSelectionForPlugin(
          next,
          result.pluginId,
          buildPluginStatusReport,
          applyExclusiveSlotSelection,
        );
        next = slotResult.config;
        await writeConfigFile(next);
        logSlotWarnings(slotResult.warnings, defaultRuntime);
        defaultRuntime.log(`Installed plugin: ${result.pluginId}`);
        defaultRuntime.log(`Restart the gateway to load plugins.`);
        return;
      }

      if (opts.link) {
        defaultRuntime.error("`--link` requires a local path.");
        process.exit(1);
      }

      const looksLikePath =
        raw.startsWith(".") ||
        raw.startsWith("~") ||
        path.isAbsolute(raw) ||
        raw.endsWith(".ts") ||
        raw.endsWith(".js") ||
        raw.endsWith(".mjs") ||
        raw.endsWith(".cjs") ||
        raw.endsWith(".tgz") ||
        raw.endsWith(".tar.gz") ||
        raw.endsWith(".tar") ||
        raw.endsWith(".zip");
      if (looksLikePath) {
        defaultRuntime.error(`Path not found: ${resolved}`);
        process.exit(1);
      }

      const result = await installPluginFromNpmSpec({
        spec: raw,
        logger: createPluginInstallLogger(defaultRuntime),
      });
      if (!result.ok) {
        defaultRuntime.error(result.error);
        process.exit(1);
      }

      let next = enablePluginInConfig(cfg, result.pluginId);
      next = recordPluginInstall(next, {
        pluginId: result.pluginId,
        source: "npm",
        spec: raw,
        installPath: result.targetDir,
        version: result.version,
      });
      const slotResult = applySlotSelectionForPlugin(
        next,
        result.pluginId,
        buildPluginStatusReport,
        applyExclusiveSlotSelection,
      );
      next = slotResult.config;
      await writeConfigFile(next);
      logSlotWarnings(slotResult.warnings, defaultRuntime);
      defaultRuntime.log(`Installed plugin: ${result.pluginId}`);
      defaultRuntime.log(`Restart the gateway to load plugins.`);
    });

  plugins
    .command("update")
    .description("Update installed plugins (npm installs only)")
    .argument("[id]", "Plugin id (omit with --all)")
    .option("--all", "Update all tracked plugins", false)
    .option("--dry-run", "Show what would change without writing", false)
    .action(async (id: string | undefined, opts: PluginUpdateOptions) => {
      const { defaultRuntime } = await import("../runtime.js");
      const { loadConfig, writeConfigFile } = await import("../config/config.js");
      const { updateNpmInstalledPlugins } = await import("../plugins/update.js");

      const cfg = loadConfig();
      const installs = cfg.plugins?.installs ?? {};
      const targets = opts.all ? Object.keys(installs) : id ? [id] : [];

      if (targets.length === 0) {
        if (opts.all) {
          defaultRuntime.log("No npm-installed plugins to update.");
          return;
        }
        defaultRuntime.error("Provide a plugin id or use --all.");
        process.exit(1);
      }

      const result = await updateNpmInstalledPlugins({
        config: cfg,
        pluginIds: targets,
        dryRun: opts.dryRun,
        logger: {
          info: (msg) => defaultRuntime.log(msg),
          warn: (msg) => defaultRuntime.log(theme.warn(msg)),
        },
      });

      for (const outcome of result.outcomes) {
        if (outcome.status === "error") {
          defaultRuntime.log(theme.error(outcome.message));
          continue;
        }
        if (outcome.status === "skipped") {
          defaultRuntime.log(theme.warn(outcome.message));
          continue;
        }
        defaultRuntime.log(outcome.message);
      }

      if (!opts.dryRun && result.changed) {
        await writeConfigFile(result.config);
        defaultRuntime.log("Restart the gateway to load plugins.");
      }
    });

  plugins
    .command("doctor")
    .description("Report plugin load issues")
    .action(async () => {
      const { defaultRuntime } = await import("../runtime.js");
      const { buildPluginStatusReport } = await import("../plugins/status.js");

      const report = buildPluginStatusReport();
      const errors = report.plugins.filter((p) => p.status === "error");
      const diags = report.diagnostics.filter((d) => d.level === "error");

      if (errors.length === 0 && diags.length === 0) {
        defaultRuntime.log("No plugin issues detected.");
        return;
      }

      const lines: string[] = [];
      if (errors.length > 0) {
        lines.push(theme.error("Plugin errors:"));
        for (const entry of errors) {
          lines.push(`- ${entry.id}: ${entry.error ?? "failed to load"} (${entry.source})`);
        }
      }
      if (diags.length > 0) {
        if (lines.length > 0) {
          lines.push("");
        }
        lines.push(theme.warn("Diagnostics:"));
        for (const diag of diags) {
          const target = diag.pluginId ? `${diag.pluginId}: ` : "";
          lines.push(`- ${target}${diag.message}`);
        }
      }
      const docs = formatDocsLink("/plugin", "docs.openclaw.ai/plugin");
      lines.push("");
      lines.push(`${theme.muted("Docs:")} ${docs}`);
      defaultRuntime.log(lines.join("\n"));
    });
}
