import type { Command } from "commander";
import { sharedListCommand, sharedSyncCommand } from "../../commands/shared.js";
import { defaultRuntime } from "../../runtime.js";
import { formatDocsLink } from "../../terminal/links.js";
import { theme } from "../../terminal/theme.js";
import { runCommandWithRuntime } from "../cli-utils.js";
import { formatHelpExamples } from "../help-format.js";

export function registerSharedCommands(program: Command) {
  const shared = program
    .command("shared")
    .description("Manage shared resources across agents (skills, tools, infrastructure)")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/shared", "docs.openclaw.ai/cli/shared")}\n`,
    );

  shared
    .command("list")
    .description("List shared resources (skills, files, agents)")
    .option("--json", "Output JSON instead of text", false)
    .option("--skills", "Show only skills", false)
    .option("--tools", "Show only tools", false)
    .addHelpText(
      "after",
      () =>
        `
${theme.heading("Examples:")}
${formatHelpExamples([
  ["openclaw shared", "Show overview of shared resources."],
  ["openclaw shared list --skills", "List all available skills."],
  ["openclaw shared list --json", "Output as JSON."],
])}
`,
    )
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await sharedListCommand(
          {
            json: Boolean(opts.json),
            skills: Boolean(opts.skills),
            tools: Boolean(opts.tools),
          },
          defaultRuntime,
        );
      });
    });

  shared
    .command("skills")
    .description("List all available skills in the workspace")
    .option("--json", "Output JSON instead of text", false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await sharedListCommand({ json: Boolean(opts.json), skills: true }, defaultRuntime);
      });
    });

  shared
    .command("sync")
    .description("Sync SHARED.md reference to all agent AGENTS.md files")
    .addHelpText(
      "after",
      () =>
        `
${theme.heading("Description:")}
  Adds a "Shared Infrastructure" section to all agent AGENTS.md files,
  pointing them to the workspace SHARED.md for shared tools and resources.

${theme.heading("Examples:")}
${formatHelpExamples([["openclaw shared sync", "Update all agents to reference SHARED.md."]])}
`,
    )
    .action(async () => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await sharedSyncCommand(defaultRuntime);
      });
    });

  // Default action shows the list
  shared.action(async () => {
    await runCommandWithRuntime(defaultRuntime, async () => {
      await sharedListCommand({}, defaultRuntime);
    });
  });
}
