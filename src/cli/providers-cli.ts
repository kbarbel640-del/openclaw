/**
 * Providers CLI registration.
 * Commands for LLM provider detection and usage monitoring.
 */

import type { Command } from "commander";
import {
  providersListCommand,
  providersStatusCommand,
  providersUsageCommand,
  type UsagePeriod,
} from "../commands/providers/index.js";
import { defaultRuntime } from "../runtime.js";
import { formatDocsLink } from "../terminal/links.js";
import { theme } from "../terminal/theme.js";
import { runCommandWithRuntime } from "./cli-utils.js";

function runProvidersCommand(action: () => Promise<void>) {
  return runCommandWithRuntime(defaultRuntime, action);
}

export function registerProvidersCli(program: Command) {
  const providers = program
    .command("providers")
    .description("LLM provider detection and usage monitoring")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/providers", "docs.openclaw.ai/cli/providers")}\n`,
    );

  providers
    .command("list")
    .description("List known LLM providers and detection status")
    .option("--all", "Show all providers including not detected", false)
    .option("--provider <id>", "Filter by provider ID")
    .option("--json", "Output JSON", false)
    .option("--plain", "Plain output (no colors)", false)
    .action(async (opts) => {
      await runProvidersCommand(async () => {
        await providersListCommand(
          {
            all: Boolean(opts.all),
            provider: opts.provider as string | undefined,
            json: Boolean(opts.json),
            plain: Boolean(opts.plain),
          },
          defaultRuntime,
        );
      });
    });

  providers
    .command("status")
    .description("Show detailed status for one or more providers")
    .option("--provider <id>", "Provider ID to check")
    .option("--json", "Output JSON", false)
    .option("--plain", "Plain output (no colors)", false)
    .action(async (opts) => {
      await runProvidersCommand(async () => {
        await providersStatusCommand(
          {
            provider: opts.provider as string | undefined,
            json: Boolean(opts.json),
            plain: Boolean(opts.plain),
          },
          defaultRuntime,
        );
      });
    });

  providers
    .command("usage")
    .description("Show LLM usage statistics by provider/model")
    .option("--period <period>", "Time period: today, week, month, all", "all")
    .option("--provider <id>", "Filter by provider ID")
    .option("--model <id>", "Filter by model ID")
    .option("--json", "Output JSON", false)
    .option("--plain", "Plain output (no colors)", false)
    .action(async (opts) => {
      await runProvidersCommand(async () => {
        await providersUsageCommand(
          {
            period: opts.period as UsagePeriod | undefined,
            provider: opts.provider as string | undefined,
            model: opts.model as string | undefined,
            json: Boolean(opts.json),
            plain: Boolean(opts.plain),
          },
          defaultRuntime,
        );
      });
    });

  // Default action: show detected providers
  providers.action(async () => {
    await runProvidersCommand(async () => {
      await providersListCommand({}, defaultRuntime);
    });
  });
}
