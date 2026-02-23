import { getAcpSessionManager } from "../../../acp/control-plane/manager.js";
import type { CommandHandlerResult, HandleCommandsParams } from "../commands-types.js";
import {
  ACP_CWD_USAGE,
  ACP_MODEL_USAGE,
  ACP_PERMISSIONS_USAGE,
  ACP_RESET_OPTIONS_USAGE,
  ACP_SET_MODE_USAGE,
  ACP_STATUS_USAGE,
  ACP_TIMEOUT_USAGE,
  collectAcpErrorText,
  formatAcpCapabilitiesText,
  formatRuntimeOptionsText,
  parseOptionalSingleTarget,
  parseSetCommandInput,
  parseSingleValueCommandInput,
  stopWithText,
} from "./shared.js";
import { resolveAcpTargetSessionKey } from "./targets.js";

export async function handleAcpStatusAction(
  params: HandleCommandsParams,
  restTokens: string[],
): Promise<CommandHandlerResult> {
  const parsed = parseOptionalSingleTarget(restTokens, ACP_STATUS_USAGE);
  if (!parsed.ok) {
    return stopWithText(`⚠️ ${parsed.error}`);
  }
  const target = await resolveAcpTargetSessionKey({
    commandParams: params,
    token: parsed.sessionToken,
  });
  if (!target.ok) {
    return stopWithText(`⚠️ ${target.error}`);
  }

  try {
    const status = await getAcpSessionManager().getSessionStatus({
      cfg: params.cfg,
      sessionKey: target.sessionKey,
    });
    const lines = [
      "ACP status:",
      "-----",
      `session: ${status.sessionKey}`,
      `backend: ${status.backend}`,
      `agent: ${status.agent}`,
      `sessionMode: ${status.mode}`,
      `state: ${status.state}`,
      `runtimeOptions: ${formatRuntimeOptionsText(status.runtimeOptions)}`,
      `capabilities: ${formatAcpCapabilitiesText(status.capabilities.controls)}`,
      `lastActivityAt: ${new Date(status.lastActivityAt).toISOString()}`,
      ...(status.lastError ? [`lastError: ${status.lastError}`] : []),
      ...(status.runtimeStatus?.summary ? [`runtime: ${status.runtimeStatus.summary}`] : []),
      ...(status.runtimeStatus?.details
        ? [`runtimeDetails: ${JSON.stringify(status.runtimeStatus.details)}`]
        : []),
    ];
    return stopWithText(lines.join("\n"));
  } catch (error) {
    return stopWithText(
      collectAcpErrorText({
        error,
        fallbackCode: "ACP_TURN_FAILED",
        fallbackMessage: "Could not read ACP session status.",
      }),
    );
  }
}

export async function handleAcpSetModeAction(
  params: HandleCommandsParams,
  restTokens: string[],
): Promise<CommandHandlerResult> {
  const parsed = parseSingleValueCommandInput(restTokens, ACP_SET_MODE_USAGE);
  if (!parsed.ok) {
    return stopWithText(`⚠️ ${parsed.error}`);
  }
  const target = await resolveAcpTargetSessionKey({
    commandParams: params,
    token: parsed.value.sessionToken,
  });
  if (!target.ok) {
    return stopWithText(`⚠️ ${target.error}`);
  }

  try {
    const options = await getAcpSessionManager().setSessionRuntimeMode({
      cfg: params.cfg,
      sessionKey: target.sessionKey,
      runtimeMode: parsed.value.value,
    });
    return stopWithText(
      `✅ Updated ACP runtime mode for ${target.sessionKey}: ${parsed.value.value}. Effective options: ${formatRuntimeOptionsText(options)}`,
    );
  } catch (error) {
    return stopWithText(
      collectAcpErrorText({
        error,
        fallbackCode: "ACP_TURN_FAILED",
        fallbackMessage: "Could not update ACP runtime mode.",
      }),
    );
  }
}

export async function handleAcpSetAction(
  params: HandleCommandsParams,
  restTokens: string[],
): Promise<CommandHandlerResult> {
  const parsed = parseSetCommandInput(restTokens);
  if (!parsed.ok) {
    return stopWithText(`⚠️ ${parsed.error}`);
  }
  const target = await resolveAcpTargetSessionKey({
    commandParams: params,
    token: parsed.value.sessionToken,
  });
  if (!target.ok) {
    return stopWithText(`⚠️ ${target.error}`);
  }
  const key = parsed.value.key.trim();
  const value = parsed.value.value.trim();

  try {
    const lowerKey = key.toLowerCase();
    if (lowerKey === "cwd") {
      const options = await getAcpSessionManager().updateSessionRuntimeOptions({
        cfg: params.cfg,
        sessionKey: target.sessionKey,
        patch: { cwd: value },
      });
      return stopWithText(
        `✅ Updated ACP cwd for ${target.sessionKey}: ${value}. Effective options: ${formatRuntimeOptionsText(options)}`,
      );
    }
    const options = await getAcpSessionManager().setSessionConfigOption({
      cfg: params.cfg,
      sessionKey: target.sessionKey,
      key,
      value,
    });
    return stopWithText(
      `✅ Updated ACP config option for ${target.sessionKey}: ${key}=${value}. Effective options: ${formatRuntimeOptionsText(options)}`,
    );
  } catch (error) {
    return stopWithText(
      collectAcpErrorText({
        error,
        fallbackCode: "ACP_TURN_FAILED",
        fallbackMessage: "Could not update ACP config option.",
      }),
    );
  }
}

export async function handleAcpCwdAction(
  params: HandleCommandsParams,
  restTokens: string[],
): Promise<CommandHandlerResult> {
  const parsed = parseSingleValueCommandInput(restTokens, ACP_CWD_USAGE);
  if (!parsed.ok) {
    return stopWithText(`⚠️ ${parsed.error}`);
  }
  const target = await resolveAcpTargetSessionKey({
    commandParams: params,
    token: parsed.value.sessionToken,
  });
  if (!target.ok) {
    return stopWithText(`⚠️ ${target.error}`);
  }

  try {
    const options = await getAcpSessionManager().updateSessionRuntimeOptions({
      cfg: params.cfg,
      sessionKey: target.sessionKey,
      patch: { cwd: parsed.value.value },
    });
    return stopWithText(
      `✅ Updated ACP cwd for ${target.sessionKey}: ${parsed.value.value}. Effective options: ${formatRuntimeOptionsText(options)}`,
    );
  } catch (error) {
    return stopWithText(
      collectAcpErrorText({
        error,
        fallbackCode: "ACP_TURN_FAILED",
        fallbackMessage: "Could not update ACP cwd.",
      }),
    );
  }
}

export async function handleAcpPermissionsAction(
  params: HandleCommandsParams,
  restTokens: string[],
): Promise<CommandHandlerResult> {
  const parsed = parseSingleValueCommandInput(restTokens, ACP_PERMISSIONS_USAGE);
  if (!parsed.ok) {
    return stopWithText(`⚠️ ${parsed.error}`);
  }
  const target = await resolveAcpTargetSessionKey({
    commandParams: params,
    token: parsed.value.sessionToken,
  });
  if (!target.ok) {
    return stopWithText(`⚠️ ${target.error}`);
  }
  try {
    const options = await getAcpSessionManager().setSessionConfigOption({
      cfg: params.cfg,
      sessionKey: target.sessionKey,
      key: "approval_policy",
      value: parsed.value.value,
    });
    return stopWithText(
      `✅ Updated ACP permissions profile for ${target.sessionKey}: ${parsed.value.value}. Effective options: ${formatRuntimeOptionsText(options)}`,
    );
  } catch (error) {
    return stopWithText(
      collectAcpErrorText({
        error,
        fallbackCode: "ACP_TURN_FAILED",
        fallbackMessage: "Could not update ACP permissions profile.",
      }),
    );
  }
}

export async function handleAcpTimeoutAction(
  params: HandleCommandsParams,
  restTokens: string[],
): Promise<CommandHandlerResult> {
  const parsed = parseSingleValueCommandInput(restTokens, ACP_TIMEOUT_USAGE);
  if (!parsed.ok) {
    return stopWithText(`⚠️ ${parsed.error}`);
  }
  const timeoutSeconds = Number.parseInt(parsed.value.value, 10);
  if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
    return stopWithText(
      `⚠️ Invalid timeout value "${parsed.value.value}". Use a positive integer.`,
    );
  }
  const target = await resolveAcpTargetSessionKey({
    commandParams: params,
    token: parsed.value.sessionToken,
  });
  if (!target.ok) {
    return stopWithText(`⚠️ ${target.error}`);
  }

  try {
    const options = await getAcpSessionManager().setSessionConfigOption({
      cfg: params.cfg,
      sessionKey: target.sessionKey,
      key: "timeout",
      value: String(timeoutSeconds),
    });
    return stopWithText(
      `✅ Updated ACP timeout for ${target.sessionKey}: ${timeoutSeconds}s. Effective options: ${formatRuntimeOptionsText(options)}`,
    );
  } catch (error) {
    return stopWithText(
      collectAcpErrorText({
        error,
        fallbackCode: "ACP_TURN_FAILED",
        fallbackMessage: "Could not update ACP timeout.",
      }),
    );
  }
}

export async function handleAcpModelAction(
  params: HandleCommandsParams,
  restTokens: string[],
): Promise<CommandHandlerResult> {
  const parsed = parseSingleValueCommandInput(restTokens, ACP_MODEL_USAGE);
  if (!parsed.ok) {
    return stopWithText(`⚠️ ${parsed.error}`);
  }
  const target = await resolveAcpTargetSessionKey({
    commandParams: params,
    token: parsed.value.sessionToken,
  });
  if (!target.ok) {
    return stopWithText(`⚠️ ${target.error}`);
  }
  try {
    const options = await getAcpSessionManager().setSessionConfigOption({
      cfg: params.cfg,
      sessionKey: target.sessionKey,
      key: "model",
      value: parsed.value.value,
    });
    return stopWithText(
      `✅ Updated ACP model for ${target.sessionKey}: ${parsed.value.value}. Effective options: ${formatRuntimeOptionsText(options)}`,
    );
  } catch (error) {
    return stopWithText(
      collectAcpErrorText({
        error,
        fallbackCode: "ACP_TURN_FAILED",
        fallbackMessage: "Could not update ACP model.",
      }),
    );
  }
}

export async function handleAcpResetOptionsAction(
  params: HandleCommandsParams,
  restTokens: string[],
): Promise<CommandHandlerResult> {
  const parsed = parseOptionalSingleTarget(restTokens, ACP_RESET_OPTIONS_USAGE);
  if (!parsed.ok) {
    return stopWithText(`⚠️ ${parsed.error}`);
  }
  const target = await resolveAcpTargetSessionKey({
    commandParams: params,
    token: parsed.sessionToken,
  });
  if (!target.ok) {
    return stopWithText(`⚠️ ${target.error}`);
  }

  try {
    await getAcpSessionManager().resetSessionRuntimeOptions({
      cfg: params.cfg,
      sessionKey: target.sessionKey,
    });
    return stopWithText(`✅ Reset ACP runtime options for ${target.sessionKey}.`);
  } catch (error) {
    return stopWithText(
      collectAcpErrorText({
        error,
        fallbackCode: "ACP_TURN_FAILED",
        fallbackMessage: "Could not reset ACP runtime options.",
      }),
    );
  }
}
