import type { Command } from "commander";
import { messageCommand } from "../../../commands/message.js";
import { danger, setVerbose } from "../../../globals.js";
import { CHANNEL_TARGET_DESCRIPTION } from "../../../infra/outbound/channel-target.js";
import { defaultRuntime } from "../../../runtime.js";
import { theme } from "../../../terminal/theme.js";
import { lintExternalReplyText } from "../../../terminal/external-reply-lint.js";
import { runCommandWithRuntime } from "../../cli-utils.js";
import { createDefaultDeps } from "../../deps.js";
import { ensurePluginRegistryLoaded } from "../../plugin-registry.js";

export type MessageCliHelpers = {
  withMessageBase: (command: Command) => Command;
  withMessageTarget: (command: Command) => Command;
  withRequiredMessageTarget: (command: Command) => Command;
  runMessageAction: (action: string, opts: Record<string, unknown>) => Promise<void>;
};

export function createMessageCliHelpers(
  message: Command,
  messageChannelOptions: string,
): MessageCliHelpers {
  const withMessageBase = (command: Command) =>
    command
      .option("--channel <channel>", `Channel: ${messageChannelOptions}`)
      .option("--account <id>", "Channel account id (accountId)")
      .option("--json", "Output result as JSON", false)
      .option("--dry-run", "Print payload and skip sending", false)
      .option(
        "--no-lint",
        "Disable message lint warnings (question marks, headings, code fences, long lines)",
      )
      .option("--verbose", "Verbose logging", false);

  const withMessageTarget = (command: Command) =>
    command.option("-t, --target <dest>", CHANNEL_TARGET_DESCRIPTION);
  const withRequiredMessageTarget = (command: Command) =>
    command.requiredOption("-t, --target <dest>", CHANNEL_TARGET_DESCRIPTION);

  const runMessageAction = async (action: string, opts: Record<string, unknown>) => {
    setVerbose(Boolean(opts.verbose));

    const lintEnabled = opts.lint !== false;
    if (lintEnabled) {
      const text = typeof opts.message === "string" ? opts.message : null;
      if (text && text.trim().length > 0) {
        const warnings = lintExternalReplyText(text);
        if (warnings.length > 0) {
          defaultRuntime.error(theme.warn("Message lint warnings:"));
          for (const warning of warnings) {
            defaultRuntime.error(theme.warn(`- ${warning}`));
          }
          defaultRuntime.error(
            theme.muted("Tip: pass --no-lint to disable these warnings."),
          );
        }
      }
    }

    ensurePluginRegistryLoaded();
    const deps = createDefaultDeps();
    await runCommandWithRuntime(
      defaultRuntime,
      async () => {
        await messageCommand(
          {
            ...(() => {
              const { account, ...rest } = opts;
              return {
                ...rest,
                accountId: typeof account === "string" ? account : undefined,
              };
            })(),
            action,
          },
          deps,
          defaultRuntime,
        );
      },
      (err) => {
        defaultRuntime.error(danger(String(err)));
        defaultRuntime.exit(1);
      },
    );
  };

  // `message` is only used for `message.help({ error: true })`, keep the
  // command-specific helpers grouped here.
  void message;

  return {
    withMessageBase,
    withMessageTarget,
    withRequiredMessageTarget,
    runMessageAction,
  };
}
