import type { Command } from "commander";
import { formatDocsLink } from "../terminal/links.js";
import { theme } from "../terminal/theme.js";
import { formatSkillInfo, formatSkillsCheck, formatSkillsList } from "./skills-cli.format.js";

export type {
  SkillInfoOptions,
  SkillsCheckOptions,
  SkillsListOptions,
} from "./skills-cli.format.js";
export { formatSkillInfo, formatSkillsCheck, formatSkillsList } from "./skills-cli.format.js";

/**
 * Register the skills CLI commands
 */
export function registerSkillsCli(program: Command) {
  const skills = program
    .command("skills")
    .description("List and inspect available skills")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/skills", "docs.openclaw.ai/cli/skills")}\n`,
    );

  skills
    .command("list")
    .description("List all available skills")
    .option("--json", "Output as JSON", false)
    .option("--eligible", "Show only eligible (ready to use) skills", false)
    .option("-v, --verbose", "Show more details including missing requirements", false)
    .action(async (opts) => {
      try {
        const { loadConfig } = await import("../config/config.js");
        const { resolveAgentWorkspaceDir, resolveDefaultAgentId } =
          await import("../agents/agent-scope.js");
        const { buildWorkspaceSkillStatus } = await import("../agents/skills-status.js");
        const { defaultRuntime } = await import("../runtime.js");
        const config = loadConfig();
        const workspaceDir = resolveAgentWorkspaceDir(config, resolveDefaultAgentId(config));
        const report = buildWorkspaceSkillStatus(workspaceDir, { config });
        defaultRuntime.log(formatSkillsList(report, opts));
      } catch (err) {
        const { defaultRuntime } = await import("../runtime.js");
        defaultRuntime.error(String(err));
        defaultRuntime.exit(1);
      }
    });

  skills
    .command("info")
    .description("Show detailed information about a skill")
    .argument("<name>", "Skill name")
    .option("--json", "Output as JSON", false)
    .action(async (name, opts) => {
      try {
        const { loadConfig } = await import("../config/config.js");
        const { resolveAgentWorkspaceDir, resolveDefaultAgentId } =
          await import("../agents/agent-scope.js");
        const { buildWorkspaceSkillStatus } = await import("../agents/skills-status.js");
        const { defaultRuntime } = await import("../runtime.js");
        const config = loadConfig();
        const workspaceDir = resolveAgentWorkspaceDir(config, resolveDefaultAgentId(config));
        const report = buildWorkspaceSkillStatus(workspaceDir, { config });
        defaultRuntime.log(formatSkillInfo(report, name, opts));
      } catch (err) {
        const { defaultRuntime } = await import("../runtime.js");
        defaultRuntime.error(String(err));
        defaultRuntime.exit(1);
      }
    });

  skills
    .command("check")
    .description("Check which skills are ready vs missing requirements")
    .option("--json", "Output as JSON", false)
    .action(async (opts) => {
      try {
        const { loadConfig } = await import("../config/config.js");
        const { resolveAgentWorkspaceDir, resolveDefaultAgentId } =
          await import("../agents/agent-scope.js");
        const { buildWorkspaceSkillStatus } = await import("../agents/skills-status.js");
        const { defaultRuntime } = await import("../runtime.js");
        const config = loadConfig();
        const workspaceDir = resolveAgentWorkspaceDir(config, resolveDefaultAgentId(config));
        const report = buildWorkspaceSkillStatus(workspaceDir, { config });
        defaultRuntime.log(formatSkillsCheck(report, opts));
      } catch (err) {
        const { defaultRuntime } = await import("../runtime.js");
        defaultRuntime.error(String(err));
        defaultRuntime.exit(1);
      }
    });

  // Default action (no subcommand) - show list
  skills.action(async () => {
    try {
      const { loadConfig } = await import("../config/config.js");
      const { resolveAgentWorkspaceDir, resolveDefaultAgentId } =
        await import("../agents/agent-scope.js");
      const { buildWorkspaceSkillStatus } = await import("../agents/skills-status.js");
      const { defaultRuntime } = await import("../runtime.js");
      const config = loadConfig();
      const workspaceDir = resolveAgentWorkspaceDir(config, resolveDefaultAgentId(config));
      const report = buildWorkspaceSkillStatus(workspaceDir, { config });
      defaultRuntime.log(formatSkillsList(report, {}));
    } catch (err) {
      const { defaultRuntime } = await import("../runtime.js");
      defaultRuntime.error(String(err));
      defaultRuntime.exit(1);
    }
  });
}
