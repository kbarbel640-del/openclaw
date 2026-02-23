import { getAcpSessionManager } from "../../../acp/control-plane/manager.js";
import {
  parseRuntimeTimeoutSecondsInput,
  validateRuntimeConfigOptionInput,
  validateRuntimeCwdInput,
  validateRuntimeModeInput,
  validateRuntimeModelInput,
  validateRuntimePermissionProfileInput,
} from "../../../acp/control-plane/runtime-options.js";
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
      ...(status.runtimeSessionId ? [`runtimeSessionId: ${status.runtimeSessionId}`] : []),
      ...(status.backendSessionId ? [`backendSessionId: ${status.backendSessionId}`] : []),
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
    const runtimeMode = validateRuntimeModeInput(parsed.value.value);
    const options = await getAcpSessionManager().setSessionRuntimeMode({
      cfg: params.cfg,
      sessionKey: target.sessionKey,
      runtimeMode,
    });
    return stopWithText(
      `✅ Updated ACP runtime mode for ${target.sessionKey}: ${runtimeMode}. Effective options: ${formatRuntimeOptionsText(options)}`,
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
      const cwd = validateRuntimeCwdInput(value);
      const options = await getAcpSessionManager().updateSessionRuntimeOptions({
        cfg: params.cfg,
        sessionKey: target.sessionKey,
        patch: { cwd },
      });
      return stopWithText(
        `✅ Updated ACP cwd for ${target.sessionKey}: ${cwd}. Effective options: ${formatRuntimeOptionsText(options)}`,
      );
    }
    const validated = validateRuntimeConfigOptionInput(key, value);
    const options = await getAcpSessionManager().setSessionConfigOption({
      cfg: params.cfg,
      sessionKey: target.sessionKey,
      key: validated.key,
      value: validated.value,
    });
    return stopWithText(
      `✅ Updated ACP config option for ${target.sessionKey}: ${validated.key}=${validated.value}. Effective options: ${formatRuntimeOptionsText(options)}`,
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
    const cwd = validateRuntimeCwdInput(parsed.value.value);
    const options = await getAcpSessionManager().updateSessionRuntimeOptions({
      cfg: params.cfg,
      sessionKey: target.sessionKey,
      patch: { cwd },
    });
    return stopWithText(
      `✅ Updated ACP cwd for ${target.sessionKey}: ${cwd}. Effective options: ${formatRuntimeOptionsText(options)}`,
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
    const permissionProfile = validateRuntimePermissionProfileInput(parsed.value.value);
    const options = await getAcpSessionManager().setSessionConfigOption({
      cfg: params.cfg,
      sessionKey: target.sessionKey,
      key: "approval_policy",
      value: permissionProfile,
    });
    return stopWithText(
      `✅ Updated ACP permissions profile for ${target.sessionKey}: ${permissionProfile}. Effective options: ${formatRuntimeOptionsText(options)}`,
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
  const target = await resolveAcpTargetSessionKey({
    commandParams: params,
    token: parsed.value.sessionToken,
  });
  if (!target.ok) {
    return stopWithText(`⚠️ ${target.error}`);
  }

  try {
    const timeoutSeconds = parseRuntimeTimeoutSecondsInput(parsed.value.value);
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
    const model = validateRuntimeModelInput(parsed.value.value);
    const options = await getAcpSessionManager().setSessionConfigOption({
      cfg: params.cfg,
      sessionKey: target.sessionKey,
      key: "model",
      value: model,
    });
    return stopWithText(
      `✅ Updated ACP model for ${target.sessionKey}: ${model}. Effective options: ${formatRuntimeOptionsText(options)}`,
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
