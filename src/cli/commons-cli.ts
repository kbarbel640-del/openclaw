import type { Command } from "commander";
import { defaultRuntime } from "../runtime.js";
import { formatDocsLink } from "../terminal/links.js";
import { theme } from "../terminal/theme.js";
import {
  formatCommonsList,
  formatCommonsSearch,
  formatCommonsInfo,
  formatInstallSuccess,
  formatPublishSuccess,
} from "./commons-cli.format.js";

export type {
  CommonsListOptions,
  CommonsSearchOptions,
  CommonsInfoOptions,
} from "./commons-cli.format.js";
export {
  formatCommonsList,
  formatCommonsSearch,
  formatCommonsInfo,
  formatInstallSuccess,
  formatPublishSuccess,
} from "./commons-cli.format.js";

export function registerCommonsCli(program: Command) {
  const commons = program
    .command("commons")
    .description("FinClaw Commons - browse and install financial skills and templates")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/commons", "docs.openclaw.ai/cli/commons")}\n`,
    );

  commons
    .command("list")
    .description("List all available commons entries")
    .option("--json", "Output as JSON", false)
    .option("--type <type>", "Filter by entry type (skill, strategy, workspace, etc.)")
    .action(async (opts) => {
      try {
        const { loadCommonsIndex, listEntries } = await import("../commons/registry.js");
        const index = await loadCommonsIndex();
        const entries = listEntries(index, opts.type);
        defaultRuntime.log(formatCommonsList(entries, opts));
      } catch (err) {
        defaultRuntime.error(String(err));
        defaultRuntime.exit(1);
      }
    });

  commons
    .command("search")
    .description("Search commons by name, description, or tags")
    .argument("<query>", "Search query")
    .option("--json", "Output as JSON", false)
    .action(async (query, opts) => {
      try {
        const { loadCommonsIndex, searchEntries } = await import("../commons/registry.js");
        const index = await loadCommonsIndex();
        const results = searchEntries(index, query);
        defaultRuntime.log(formatCommonsSearch(results, query, opts));
      } catch (err) {
        defaultRuntime.error(String(err));
        defaultRuntime.exit(1);
      }
    });

  commons
    .command("install")
    .description("Install a commons entry to your workspace")
    .argument("<id>", "Entry ID to install")
    .option("--dir <path>", "Target directory for installation")
    .option("--json", "Output as JSON", false)
    .action(async (id, opts) => {
      try {
        const { loadCommonsIndex, findEntry } = await import("../commons/registry.js");
        const { installCommonsEntry } = await import("../commons/install.js");

        const index = await loadCommonsIndex();
        const entry = findEntry(index, id);
        if (!entry) {
          defaultRuntime.error(`Entry "${id}" not found in commons. Run "openclaw commons list" to see available entries.`);
          defaultRuntime.exit(1);
          return;
        }

        const result = await installCommonsEntry(entry, { targetDir: opts.dir });

        if (opts.json) {
          defaultRuntime.log(JSON.stringify(result, null, 2));
        } else {
          defaultRuntime.log(
            formatInstallSuccess(result.entry, {
              alreadyExisted: result.alreadyExisted,
              installedPath: result.installedPath,
            }),
          );
        }
      } catch (err) {
        defaultRuntime.error(String(err));
        defaultRuntime.exit(1);
      }
    });

  commons
    .command("publish")
    .description("Publish a local skill or content to the commons registry")
    .argument("<path>", "Path to the skill/content directory")
    .option("--type <type>", "Entry type (skill, strategy, workspace, etc.)", "skill")
    .option("--id <id>", "Override entry ID (defaults to directory name)")
    .option("--author <author>", "Author name", "local")
    .option("--json", "Output as JSON", false)
    .action(async (sourcePath, opts) => {
      try {
        const { resolve } = await import("node:path");
        const { publishToCommons } = await import("../commons/publish.js");

        const result = await publishToCommons(resolve(sourcePath), {
          type: opts.type,
          id: opts.id,
          author: opts.author,
        });

        if (opts.json) {
          defaultRuntime.log(JSON.stringify(result, null, 2));
        } else {
          defaultRuntime.log(formatPublishSuccess(result.entry.id, result.registryPath));
        }
      } catch (err) {
        defaultRuntime.error(String(err));
        defaultRuntime.exit(1);
      }
    });

  commons
    .command("info")
    .description("Show detailed information about a commons entry")
    .argument("<id>", "Entry ID")
    .option("--json", "Output as JSON", false)
    .action(async (id, opts) => {
      try {
        const { loadCommonsIndex, findEntry } = await import("../commons/registry.js");

        const index = await loadCommonsIndex();
        const entry = findEntry(index, id);
        if (!entry) {
          defaultRuntime.error(`Entry "${id}" not found in commons. Run "openclaw commons list" to see available entries.`);
          defaultRuntime.exit(1);
          return;
        }

        defaultRuntime.log(formatCommonsInfo(entry, opts));
      } catch (err) {
        defaultRuntime.error(String(err));
        defaultRuntime.exit(1);
      }
    });

  // Default action (no subcommand) - show list
  commons.action(async () => {
    try {
      const { loadCommonsIndex, listEntries } = await import("../commons/registry.js");
      const index = await loadCommonsIndex();
      const entries = listEntries(index);
      defaultRuntime.log(formatCommonsList(entries, {}));
    } catch (err) {
      defaultRuntime.error(String(err));
      defaultRuntime.exit(1);
    }
  });
}
