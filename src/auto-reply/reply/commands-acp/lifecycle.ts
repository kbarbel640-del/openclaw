import { randomUUID } from "node:crypto";
import { getAcpSessionManager } from "../../../acp/control-plane/manager.js";
import {
  cleanupFailedAcpSpawn,
  resolveDiscordAcpSpawnFlags as resolveSharedDiscordAcpSpawnFlags,
  type AcpSpawnRuntimeCloseHandle,
} from "../../../acp/control-plane/spawn.js";
import {
  isAcpEnabledByPolicy,
  resolveAcpAgentPolicyError,
  resolveAcpDispatchPolicyError,
  resolveAcpDispatchPolicyMessage,
} from "../../../acp/policy.js";
import { toAcpRuntimeErrorText } from "../../../acp/runtime/error-text.js";
import { AcpRuntimeError } from "../../../acp/runtime/errors.js";
import type { OpenClawConfig } from "../../../config/config.js";
import {
  getThreadBindingManager,
  resolveThreadBindingIntroText,
  resolveThreadBindingThreadName,
  unbindThreadBindingsBySessionKey,
  type ThreadBindingRecord,
} from "../../../discord/monitor/thread-bindings.js";
import { callGateway } from "../../../gateway/call.js";
import {
  isDiscordSurface,
  resolveDiscordAccountId,
  resolveDiscordChannelIdForFocus,
} from "../commands-subagents/shared.js";
import type { CommandHandlerResult, HandleCommandsParams } from "../commands-types.js";
import {
  ACP_STEER_OUTPUT_LIMIT,
  collectAcpErrorText,
  parseSpawnInput,
  parseSteerInput,
  resolveCommandRequestId,
  stopWithText,
  type AcpSpawnThreadMode,
} from "./shared.js";
import { resolveAcpTargetSessionKey } from "./targets.js";

function resolveDiscordAcpSpawnFlags(params: HandleCommandsParams): {
  enabled: boolean;
  spawnAcpSessions: boolean;
} {
  const accountId = resolveDiscordAccountId(params);
  return resolveSharedDiscordAcpSpawnFlags(params.cfg, accountId);
}

async function bindSpawnedAcpSessionToDiscordThread(params: {
  commandParams: HandleCommandsParams;
  sessionKey: string;
  agentId: string;
  label?: string;
  threadMode: AcpSpawnThreadMode;
}): Promise<{ ok: true; binding: ThreadBindingRecord } | { ok: false; error: string }> {
  const { commandParams, threadMode } = params;
  if (threadMode === "off") {
    return {
      ok: false,
      error: "internal: thread binding is disabled for this spawn",
    };
  }

  if (!isDiscordSurface(commandParams)) {
    return {
      ok: false,
      error: "ACP thread binding is only available on Discord.",
    };
  }

  const flags = resolveDiscordAcpSpawnFlags(commandParams);
  if (!flags.enabled) {
    return {
      ok: false,
      error:
        "Discord thread bindings are disabled (set channels.discord.threadBindings.enabled=true to override for this account, or session.threadBindings.enabled=true globally).",
    };
  }
  if (!flags.spawnAcpSessions) {
    return {
      ok: false,
      error:
        "Discord thread-bound ACP spawns are disabled for this account (set channels.discord.threadBindings.spawnAcpSessions=true to enable).",
    };
  }

  const accountId = resolveDiscordAccountId(commandParams);
  const manager = getThreadBindingManager(accountId);
  if (!manager) {
    return {
      ok: false,
      error: "Discord thread bindings are unavailable for this account.",
    };
  }

  const currentThreadId =
    commandParams.ctx.MessageThreadId != null
      ? String(commandParams.ctx.MessageThreadId).trim()
      : "";

  if (threadMode === "here" && !currentThreadId) {
    return {
      ok: false,
      error: "--thread here requires running /acp spawn inside a Discord thread.",
    };
  }

  const threadId = currentThreadId || undefined;
  const createThread = !threadId;
  const channelId = createThread ? resolveDiscordChannelIdForFocus(commandParams) : undefined;

  if (createThread && !channelId) {
    return {
      ok: false,
      error: "Could not resolve a Discord channel for ACP thread spawn.",
    };
  }

  const senderId = commandParams.command.senderId?.trim() || "";
  if (threadId) {
    const existingBinding = manager.getByThreadId(threadId);
    if (
      existingBinding &&
      existingBinding.boundBy &&
      existingBinding.boundBy !== "system" &&
      senderId &&
      senderId !== existingBinding.boundBy
    ) {
      return {
        ok: false,
        error: `Only ${existingBinding.boundBy} can rebind this thread.`,
      };
    }
  }

  const label = params.label || params.agentId;
  const binding = await manager.bindTarget({
    threadId,
    channelId,
    createThread,
    threadName: resolveThreadBindingThreadName({
      agentId: params.agentId,
      label,
    }),
    targetKind: "acp",
    targetSessionKey: params.sessionKey,
    agentId: params.agentId,
    label,
    boundBy: senderId || "unknown",
    introText: resolveThreadBindingIntroText({
      agentId: params.agentId,
      label,
      sessionTtlMs: manager.getSessionTtlMs(),
    }),
  });

  if (!binding) {
    return {
      ok: false,
      error: "Failed to bind a Discord thread to the new ACP session.",
    };
  }

  return {
    ok: true,
    binding,
  };
}

async function cleanupFailedSpawn(params: {
  cfg: OpenClawConfig;
  sessionKey: string;
  shouldDeleteSession: boolean;
  initializedRuntime?: AcpSpawnRuntimeCloseHandle;
}) {
  await cleanupFailedAcpSpawn({
    cfg: params.cfg,
    sessionKey: params.sessionKey,
    shouldDeleteSession: params.shouldDeleteSession,
    deleteTranscript: false,
    runtimeCloseHandle: params.initializedRuntime,
  });
}

export async function handleAcpSpawnAction(
  params: HandleCommandsParams,
  restTokens: string[],
): Promise<CommandHandlerResult> {
  if (!isAcpEnabledByPolicy(params.cfg)) {
    return stopWithText("ACP is disabled by policy (`acp.enabled=false`).");
  }

  const parsed = parseSpawnInput(params, restTokens);
  if (!parsed.ok) {
    return stopWithText(`⚠️ ${parsed.error}`);
  }

  const spawn = parsed.value;
  const agentPolicyError = resolveAcpAgentPolicyError(params.cfg, spawn.agentId);
  if (agentPolicyError) {
    return stopWithText(
      collectAcpErrorText({
        error: agentPolicyError,
        fallbackCode: "ACP_SESSION_INIT_FAILED",
        fallbackMessage: "ACP target agent is not allowed by policy.",
      }),
    );
  }

  const acpManager = getAcpSessionManager();
  const sessionKey = `agent:${spawn.agentId}:acp:${randomUUID()}`;

  let initializedBackend = "";
  let initializedRuntime: AcpSpawnRuntimeCloseHandle | undefined;
  try {
    const initialized = await acpManager.initializeSession({
      cfg: params.cfg,
      sessionKey,
      agent: spawn.agentId,
      mode: spawn.mode,
      cwd: spawn.cwd,
    });
    initializedRuntime = {
      runtime: initialized.runtime,
      handle: initialized.handle,
    };
    initializedBackend = initialized.handle.backend || initialized.meta.backend;
  } catch (err) {
    return stopWithText(
      collectAcpErrorText({
        error: err,
        fallbackCode: "ACP_SESSION_INIT_FAILED",
        fallbackMessage: "Could not initialize ACP session runtime.",
      }),
    );
  }

  let binding: ThreadBindingRecord | null = null;
  if (spawn.thread !== "off") {
    const bound = await bindSpawnedAcpSessionToDiscordThread({
      commandParams: params,
      sessionKey,
      agentId: spawn.agentId,
      label: spawn.label,
      threadMode: spawn.thread,
    });
    if (!bound.ok) {
      await cleanupFailedSpawn({
        cfg: params.cfg,
        sessionKey,
        shouldDeleteSession: true,
        initializedRuntime,
      });
      return stopWithText(`⚠️ ${bound.error}`);
    }
    binding = bound.binding;
  }

  try {
    await callGateway({
      method: "sessions.patch",
      params: {
        key: sessionKey,
        ...(spawn.label ? { label: spawn.label } : {}),
      },
      timeoutMs: 10_000,
    });
  } catch (err) {
    await cleanupFailedSpawn({
      cfg: params.cfg,
      sessionKey,
      shouldDeleteSession: true,
      initializedRuntime,
    });
    const message = err instanceof Error ? err.message : String(err);
    return stopWithText(`⚠️ ACP spawn failed: ${message}`);
  }

  const parts = [
    `✅ Spawned ACP session ${sessionKey} (${spawn.mode}, backend ${initializedBackend}).`,
  ];
  if (binding) {
    const currentThreadId =
      params.ctx.MessageThreadId != null ? String(params.ctx.MessageThreadId).trim() : "";
    if (currentThreadId && binding.threadId === currentThreadId) {
      parts.push(`Bound this thread to ${sessionKey}.`);
    } else {
      parts.push(`Created thread ${binding.threadId} and bound it to ${sessionKey}.`);
    }
  } else {
    parts.push("Session is unbound (use /focus <session-key> to bind a Discord thread).");
  }

  const dispatchNote = resolveAcpDispatchPolicyMessage(params.cfg);
  if (dispatchNote) {
    parts.push(`ℹ️ ${dispatchNote}`);
  }

  return stopWithText(parts.join(" "));
}

export async function handleAcpCancelAction(
  params: HandleCommandsParams,
  restTokens: string[],
): Promise<CommandHandlerResult> {
  const acpManager = getAcpSessionManager();
  const token = restTokens.join(" ").trim() || undefined;
  const target = await resolveAcpTargetSessionKey({
    commandParams: params,
    token,
  });
  if (!target.ok) {
    return stopWithText(`⚠️ ${target.error}`);
  }

  const resolved = acpManager.resolveSession({
    cfg: params.cfg,
    sessionKey: target.sessionKey,
  });
  if (resolved.kind === "none") {
    return stopWithText(
      collectAcpErrorText({
        error: new AcpRuntimeError(
          "ACP_SESSION_INIT_FAILED",
          `Session is not ACP-enabled: ${target.sessionKey}`,
        ),
        fallbackCode: "ACP_SESSION_INIT_FAILED",
        fallbackMessage: "Session is not ACP-enabled.",
      }),
    );
  }
  if (resolved.kind === "stale") {
    return stopWithText(
      collectAcpErrorText({
        error: resolved.error,
        fallbackCode: "ACP_SESSION_INIT_FAILED",
        fallbackMessage: resolved.error.message,
      }),
    );
  }

  try {
    await acpManager.cancelSession({
      cfg: params.cfg,
      sessionKey: target.sessionKey,
      reason: "manual-cancel",
    });
    return stopWithText(`✅ Cancel requested for ACP session ${target.sessionKey}.`);
  } catch (err) {
    return stopWithText(
      collectAcpErrorText({
        error: err,
        fallbackCode: "ACP_TURN_FAILED",
        fallbackMessage: "ACP cancel failed before completion.",
      }),
    );
  }
}

async function runAcpSteer(params: {
  cfg: OpenClawConfig;
  sessionKey: string;
  instruction: string;
  requestId: string;
}): Promise<string> {
  const acpManager = getAcpSessionManager();
  let output = "";

  await acpManager.runTurn({
    cfg: params.cfg,
    sessionKey: params.sessionKey,
    text: params.instruction,
    mode: "steer",
    requestId: params.requestId,
    onEvent: (event) => {
      if (event.type !== "text_delta") {
        return;
      }
      if (event.stream && event.stream !== "output") {
        return;
      }
      if (event.text) {
        output += event.text;
        if (output.length > ACP_STEER_OUTPUT_LIMIT) {
          output = `${output.slice(0, ACP_STEER_OUTPUT_LIMIT)}…`;
        }
      }
    },
  });
  return output.trim();
}

export async function handleAcpSteerAction(
  params: HandleCommandsParams,
  restTokens: string[],
): Promise<CommandHandlerResult> {
  const dispatchPolicyError = resolveAcpDispatchPolicyError(params.cfg);
  if (dispatchPolicyError) {
    return stopWithText(
      collectAcpErrorText({
        error: dispatchPolicyError,
        fallbackCode: "ACP_DISPATCH_DISABLED",
        fallbackMessage: dispatchPolicyError.message,
      }),
    );
  }

  const parsed = parseSteerInput(restTokens);
  if (!parsed.ok) {
    return stopWithText(`⚠️ ${parsed.error}`);
  }
  const acpManager = getAcpSessionManager();

  const target = await resolveAcpTargetSessionKey({
    commandParams: params,
    token: parsed.value.sessionToken,
  });
  if (!target.ok) {
    return stopWithText(`⚠️ ${target.error}`);
  }

  const resolved = acpManager.resolveSession({
    cfg: params.cfg,
    sessionKey: target.sessionKey,
  });
  if (resolved.kind === "none") {
    return stopWithText(
      collectAcpErrorText({
        error: new AcpRuntimeError(
          "ACP_SESSION_INIT_FAILED",
          `Session is not ACP-enabled: ${target.sessionKey}`,
        ),
        fallbackCode: "ACP_SESSION_INIT_FAILED",
        fallbackMessage: "Session is not ACP-enabled.",
      }),
    );
  }
  if (resolved.kind === "stale") {
    return stopWithText(
      collectAcpErrorText({
        error: resolved.error,
        fallbackCode: "ACP_SESSION_INIT_FAILED",
        fallbackMessage: resolved.error.message,
      }),
    );
  }

  try {
    const steerOutput = await runAcpSteer({
      cfg: params.cfg,
      sessionKey: target.sessionKey,
      instruction: parsed.value.instruction,
      requestId: `${resolveCommandRequestId(params)}:steer`,
    });

    if (!steerOutput) {
      return stopWithText(`✅ ACP steer sent to ${target.sessionKey}.`);
    }
    return stopWithText(`✅ ACP steer sent to ${target.sessionKey}.\n${steerOutput}`);
  } catch (err) {
    return stopWithText(
      collectAcpErrorText({
        error: err,
        fallbackCode: "ACP_TURN_FAILED",
        fallbackMessage: "ACP steer failed before completion.",
      }),
    );
  }
}

export async function handleAcpCloseAction(
  params: HandleCommandsParams,
  restTokens: string[],
): Promise<CommandHandlerResult> {
  const acpManager = getAcpSessionManager();
  const token = restTokens.join(" ").trim() || undefined;
  const target = await resolveAcpTargetSessionKey({
    commandParams: params,
    token,
  });
  if (!target.ok) {
    return stopWithText(`⚠️ ${target.error}`);
  }

  const resolved = acpManager.resolveSession({
    cfg: params.cfg,
    sessionKey: target.sessionKey,
  });
  if (resolved.kind === "none") {
    return stopWithText(
      collectAcpErrorText({
        error: new AcpRuntimeError(
          "ACP_SESSION_INIT_FAILED",
          `Session is not ACP-enabled: ${target.sessionKey}`,
        ),
        fallbackCode: "ACP_SESSION_INIT_FAILED",
        fallbackMessage: "Session is not ACP-enabled.",
      }),
    );
  }
  if (resolved.kind === "stale") {
    return stopWithText(
      collectAcpErrorText({
        error: resolved.error,
        fallbackCode: "ACP_SESSION_INIT_FAILED",
        fallbackMessage: resolved.error.message,
      }),
    );
  }

  let runtimeNotice = "";
  try {
    const closed = await acpManager.closeSession({
      cfg: params.cfg,
      sessionKey: target.sessionKey,
      reason: "manual-close",
      allowBackendUnavailable: true,
      clearMeta: true,
    });
    runtimeNotice = closed.runtimeNotice ? ` (${closed.runtimeNotice})` : "";
  } catch (err) {
    return stopWithText(
      toAcpRuntimeErrorText({
        error: err,
        fallbackCode: "ACP_TURN_FAILED",
        fallbackMessage: "ACP close failed before completion.",
      }),
    );
  }

  const removedBindings = unbindThreadBindingsBySessionKey({
    targetSessionKey: target.sessionKey,
    targetKind: "acp",
    reason: "manual",
    sendFarewell: true,
  });

  return stopWithText(
    `✅ Closed ACP session ${target.sessionKey}${runtimeNotice}. Removed ${removedBindings.length} binding${removedBindings.length === 1 ? "" : "s"}.`,
  );
}
