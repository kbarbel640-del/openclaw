import { logVerbose } from "../../globals.js";
import {
  handleAcpDoctorAction,
  handleAcpInstallAction,
  handleAcpSessionsAction,
} from "./commands-acp/diagnostics.js";
import {
  handleAcpCancelAction,
  handleAcpCloseAction,
  handleAcpSpawnAction,
  handleAcpSteerAction,
} from "./commands-acp/lifecycle.js";
import {
  handleAcpCwdAction,
  handleAcpModelAction,
  handleAcpPermissionsAction,
  handleAcpResetOptionsAction,
  handleAcpSetAction,
  handleAcpSetModeAction,
  handleAcpStatusAction,
  handleAcpTimeoutAction,
} from "./commands-acp/runtime-options.js";
import {
  COMMAND,
  resolveAcpAction,
  resolveAcpHelpText,
  stopWithText,
} from "./commands-acp/shared.js";
import type { CommandHandler } from "./commands-types.js";

export const handleAcpCommand: CommandHandler = async (params, allowTextCommands) => {
  if (!allowTextCommands) {
    return null;
  }

  const normalized = params.command.commandBodyNormalized;
  if (!normalized.startsWith(COMMAND)) {
    return null;
  }

  if (!params.command.isAuthorizedSender) {
    logVerbose(`Ignoring /acp from unauthorized sender: ${params.command.senderId || "<unknown>"}`);
    return { shouldContinue: false };
  }

  const rest = normalized.slice(COMMAND.length).trim();
  const tokens = rest.split(/\s+/).filter(Boolean);
  const action = resolveAcpAction(tokens);

  switch (action) {
    case "help":
      return stopWithText(resolveAcpHelpText());
    case "spawn":
      return await handleAcpSpawnAction(params, tokens);
    case "cancel":
      return await handleAcpCancelAction(params, tokens);
    case "steer":
      return await handleAcpSteerAction(params, tokens);
    case "close":
      return await handleAcpCloseAction(params, tokens);
    case "status":
      return await handleAcpStatusAction(params, tokens);
    case "set-mode":
      return await handleAcpSetModeAction(params, tokens);
    case "set":
      return await handleAcpSetAction(params, tokens);
    case "cwd":
      return await handleAcpCwdAction(params, tokens);
    case "permissions":
      return await handleAcpPermissionsAction(params, tokens);
    case "timeout":
      return await handleAcpTimeoutAction(params, tokens);
    case "model":
      return await handleAcpModelAction(params, tokens);
    case "reset-options":
      return await handleAcpResetOptionsAction(params, tokens);
    case "doctor":
      return await handleAcpDoctorAction(params, tokens);
    case "install":
      return handleAcpInstallAction(params, tokens);
    case "sessions":
      return handleAcpSessionsAction(params, tokens);
    default:
      return stopWithText(resolveAcpHelpText());
  }
};
