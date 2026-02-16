import type { CommandHandler } from "./commands-types.js";
import { logVerbose } from "../../globals.js";
import { resolveOpenClawPackageRoot } from "../../infra/openclaw-root.js";
import { scheduleGatewaySigusr1Restart } from "../../infra/restart.js";
import { normalizeUpdateChannel } from "../../infra/update-channels.js";
import { runGatewayUpdate, type UpdateRunResult } from "../../infra/update-runner.js";

function formatUpdateResult(result: UpdateRunResult): string {
  if (result.status === "skipped") {
    if (result.reason === "dirty") {
      return "⚠️ Update skipped: working directory has uncommitted changes. Commit or stash them first.";
    }
    if (result.reason === "not-git-install") {
      return "⚠️ Update skipped: not a git install.";
    }
    return `⚠️ Update skipped${result.reason ? `: ${result.reason}` : ""}.`;
  }
  if (result.status === "error") {
    const failedStep = result.steps.find((s) => s.exitCode !== 0);
    const stepName = failedStep?.name ?? result.reason ?? "unknown";
    return `❌ Update failed at step: ${stepName}.`;
  }
  const before = result.before?.version ?? result.before?.sha?.slice(0, 8) ?? "unknown";
  const after = result.after?.version ?? result.after?.sha?.slice(0, 8) ?? "unknown";
  if (before === after) {
    return `✅ Already up to date (${after}).`;
  }
  return `✅ Updated: ${before} → ${after}.`;
}

export const handleUpdateCommand: CommandHandler = async (params, allowTextCommands) => {
  if (!allowTextCommands) {
    return null;
  }
  if (params.command.commandBodyNormalized !== "/update") {
    return null;
  }
  if (!params.command.isAuthorizedSender) {
    logVerbose(
      `Ignoring /update from unauthorized sender: ${params.command.senderId || "<unknown>"}`,
    );
    return { shouldContinue: false };
  }
  if (params.cfg.commands?.update !== true) {
    return {
      shouldContinue: false,
      reply: {
        text: "⚠️ /update is disabled. Set commands.update=true in your config to enable.",
      },
    };
  }

  const configChannel = normalizeUpdateChannel(params.cfg.update?.channel);
  const root =
    (await resolveOpenClawPackageRoot({
      moduleUrl: import.meta.url,
      argv1: process.argv[1],
      cwd: process.cwd(),
    })) ?? process.cwd();

  let result: UpdateRunResult;
  try {
    result = await runGatewayUpdate({
      cwd: root,
      argv1: process.argv[1],
      channel: configChannel ?? undefined,
    });
  } catch (err) {
    return {
      shouldContinue: false,
      reply: {
        text: `❌ Update failed: ${String(err)}`,
      },
    };
  }

  const message = formatUpdateResult(result);

  if (result.status === "ok") {
    const hasSigusr1Listener = process.listenerCount("SIGUSR1") > 0;
    if (hasSigusr1Listener) {
      scheduleGatewaySigusr1Restart({ reason: "/update" });
      return {
        shouldContinue: false,
        reply: {
          text: `${message}\n⚙️ Restarting to apply update...`,
        },
      };
    }
    return {
      shouldContinue: false,
      reply: {
        text: `${message}\n⚠️ Restart the gateway manually to apply the update.`,
      },
    };
  }

  return {
    shouldContinue: false,
    reply: { text: message },
  };
};
