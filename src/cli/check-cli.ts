import type { Command } from "commander";
import { checkCommand } from "../commands/check.js";
import { defaultRuntime } from "../runtime.js";
import { formatDocsLink } from "../terminal/links.js";
import { theme } from "../terminal/theme.js";
import { runCommandWithRuntime } from "./cli-utils.js";

export function registerCheckCli(program: Command) {
  const check = program
    .command("check")
    .description("Check OpenClaw installation status")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/check", "docs.openclaw.ai/cli/check")}\n`,
    );

  check
    .command("all")
    .description("Run all installation checks")
    .option("--json", "Output results as JSON", false)
    .option("--verbose", "Show detailed output for each check", false)
    .option("--non-interactive", "Run without prompts", false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await checkCommand(defaultRuntime, {
          json: Boolean(opts.json),
          verbose: Boolean(opts.verbose),
          nonInteractive: Boolean(opts.nonInteractive),
        });
      });
    });

  check
    .command("config")
    .description("Check configuration file status")
    .option("--json", "Output results as JSON", false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        // Import here to avoid circular dependencies
        const { readConfigFileSnapshot } = await import("../config/config.js");
        const snapshot = await readConfigFileSnapshot();

        if (opts.json) {
          defaultRuntime.log(
            JSON.stringify(
              {
                exists: snapshot.exists,
                valid: snapshot.valid,
                issues: snapshot.issues,
              },
              null,
              2,
            ),
          );
          return;
        }

        if (!snapshot.exists) {
          defaultRuntime.error("Configuration file does not exist");
          defaultRuntime.log('Run "openclaw setup" to create one');
          return;
        }

        if (!snapshot.valid) {
          defaultRuntime.error("Configuration file has errors:");
          for (const issue of snapshot.issues) {
            const path = issue.path || "<root>";
            defaultRuntime.error(`  - ${path}: ${issue.message}`);
          }
          return;
        }

        defaultRuntime.log("✓ Configuration file is valid");
      });
    });

  check
    .command("gateway")
    .description("Check gateway configuration status")
    .option("--json", "Output results as JSON", false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        const { loadConfig } = await import("../config/config.js");

        let cfg;
        try {
          cfg = loadConfig();
        } catch {
          if (opts.json) {
            defaultRuntime.log(
              JSON.stringify({
                configured: false,
                error: "Failed to load configuration",
              }),
            );
          } else {
            defaultRuntime.error("Failed to load configuration");
          }
          return;
        }

        const mode = cfg.gateway?.mode;
        const configured = mode === "local" || mode === "remote";

        if (opts.json) {
          defaultRuntime.log(
            JSON.stringify({
              configured,
              mode: mode || null,
            }),
          );
          return;
        }

        if (configured) {
          defaultRuntime.log(`✓ Gateway mode is set to: ${mode}`);
        } else {
          defaultRuntime.error("Gateway mode is not configured");
          defaultRuntime.log('Run "openclaw config set gateway.mode local" to configure');
        }
      });
    });
}
