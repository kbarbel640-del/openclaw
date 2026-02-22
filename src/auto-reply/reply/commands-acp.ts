import { randomUUID } from "node:crypto";
import { getAcpSessionManager } from "../../acp/control-plane/manager.js";
import { AcpRuntimeError, toAcpRuntimeError } from "../../acp/runtime/errors.js";
import { resolveSessionStorePathForAcp } from "../../acp/runtime/session-meta.js";
import type { AcpRuntimeSessionMode } from "../../acp/runtime/types.js";
import type { OpenClawConfig } from "../../config/config.js";
import { loadSessionStore } from "../../config/sessions.js";
import type { SessionEntry } from "../../config/sessions/types.js";
import {
  getThreadBindingManager,
  resolveThreadBindingIntroText,
  resolveThreadBindingThreadName,
  unbindThreadBindingsBySessionKey,
  type ThreadBindingRecord,
} from "../../discord/monitor/thread-bindings.js";
import { callGateway } from "../../gateway/call.js";
import { logVerbose } from "../../globals.js";
import { normalizeAgentId } from "../../routing/session-key.js";
import {
  isDiscordSurface,
  resolveDiscordAccountId,
  resolveDiscordChannelIdForFocus,
  resolveRequesterSessionKey,
} from "./commands-subagents/shared.js";
import type {
  CommandHandler,
  CommandHandlerResult,
  HandleCommandsParams,
} from "./commands-types.js";

const COMMAND = "/acp";
const SESSION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACP_STEER_OUTPUT_LIMIT = 800;
const ACP_SPAWN_USAGE =
  "Usage: /acp spawn [agentId] [--mode persistent|oneshot] [--thread auto|here|off] [--cwd <path>] [--label <label>].";
const ACP_STEER_USAGE =
  "Usage: /acp steer [--session <session-key|session-id|session-label>] <instruction>";

type AcpAction = "spawn" | "cancel" | "steer" | "close" | "sessions" | "help";

type AcpSpawnThreadMode = "auto" | "here" | "off";

type ParsedSpawnInput = {
  agentId: string;
  mode: AcpRuntimeSessionMode;
  thread: AcpSpawnThreadMode;
  cwd?: string;
  label?: string;
};

type ParsedSteerInput = {
  sessionToken?: string;
  instruction: string;
};

type SpawnRuntimeCloseHandle = {
  runtime: {
    close: (params: {
      handle: { sessionKey: string; backend: string; runtimeSessionName: string };
      reason: string;
    }) => Promise<void>;
  };
  handle: { sessionKey: string; backend: string; runtimeSessionName: string };
};

function stopWithText(text: string): CommandHandlerResult {
  return {
    shouldContinue: false,
    reply: { text },
  };
}

function isAcpEnabled(cfg: OpenClawConfig): boolean {
  return cfg.acp?.enabled !== false;
}

function resolveAcpAction(tokens: string[]): AcpAction {
  const action = tokens[0]?.trim().toLowerCase();
  if (
    action === "spawn" ||
    action === "cancel" ||
    action === "steer" ||
    action === "close" ||
    action === "sessions" ||
    action === "help"
  ) {
    tokens.shift();
    return action;
  }
  if (!action) {
    return "help";
  }
  return "help";
}

function readOptionValue(params: { tokens: string[]; index: number; flag: string }):
  | {
      matched: true;
      value?: string;
      nextIndex: number;
      error?: string;
    }
  | { matched: false } {
  const token = params.tokens[params.index] ?? "";
  if (token === params.flag) {
    const nextValue = params.tokens[params.index + 1]?.trim() ?? "";
    if (!nextValue || nextValue.startsWith("--")) {
      return {
        matched: true,
        nextIndex: params.index + 1,
        error: `${params.flag} requires a value`,
      };
    }
    return {
      matched: true,
      value: nextValue,
      nextIndex: params.index + 2,
    };
  }
  if (token.startsWith(`${params.flag}=`)) {
    const value = token.slice(`${params.flag}=`.length).trim();
    if (!value) {
      return {
        matched: true,
        nextIndex: params.index + 1,
        error: `${params.flag} requires a value`,
      };
    }
    return {
      matched: true,
      value,
      nextIndex: params.index + 1,
    };
  }
  return { matched: false };
}

function resolveDefaultSpawnThreadMode(params: HandleCommandsParams): AcpSpawnThreadMode {
  if (!isDiscordSurface(params)) {
    return "off";
  }
  const currentThreadId =
    params.ctx.MessageThreadId != null ? String(params.ctx.MessageThreadId).trim() : "";
  return currentThreadId ? "here" : "auto";
}

function parseSpawnInput(
  params: HandleCommandsParams,
  tokens: string[],
): { ok: true; value: ParsedSpawnInput } | { ok: false; error: string } {
  let mode: AcpRuntimeSessionMode = "persistent";
  let thread = resolveDefaultSpawnThreadMode(params);
  let cwd: string | undefined;
  let label: string | undefined;
  let rawAgentId: string | undefined;

  for (let i = 0; i < tokens.length; ) {
    const token = tokens[i] ?? "";

    const modeOption = readOptionValue({ tokens, index: i, flag: "--mode" });
    if (modeOption.matched) {
      if (modeOption.error) {
        return { ok: false, error: `${modeOption.error}. ${ACP_SPAWN_USAGE}` };
      }
      const raw = modeOption.value?.trim().toLowerCase();
      if (raw !== "persistent" && raw !== "oneshot") {
        return {
          ok: false,
          error: `Invalid --mode value "${modeOption.value}". Use persistent or oneshot.`,
        };
      }
      mode = raw;
      i = modeOption.nextIndex;
      continue;
    }

    const threadOption = readOptionValue({ tokens, index: i, flag: "--thread" });
    if (threadOption.matched) {
      if (threadOption.error) {
        return { ok: false, error: `${threadOption.error}. ${ACP_SPAWN_USAGE}` };
      }
      const raw = threadOption.value?.trim().toLowerCase();
      if (raw !== "auto" && raw !== "here" && raw !== "off") {
        return {
          ok: false,
          error: `Invalid --thread value "${threadOption.value}". Use auto, here, or off.`,
        };
      }
      thread = raw;
      i = threadOption.nextIndex;
      continue;
    }

    const cwdOption = readOptionValue({ tokens, index: i, flag: "--cwd" });
    if (cwdOption.matched) {
      if (cwdOption.error) {
        return { ok: false, error: `${cwdOption.error}. ${ACP_SPAWN_USAGE}` };
      }
      cwd = cwdOption.value?.trim();
      i = cwdOption.nextIndex;
      continue;
    }

    const labelOption = readOptionValue({ tokens, index: i, flag: "--label" });
    if (labelOption.matched) {
      if (labelOption.error) {
        return { ok: false, error: `${labelOption.error}. ${ACP_SPAWN_USAGE}` };
      }
      label = labelOption.value?.trim();
      i = labelOption.nextIndex;
      continue;
    }

    if (token.startsWith("--")) {
      return {
        ok: false,
        error: `Unknown option: ${token}. ${ACP_SPAWN_USAGE}`,
      };
    }

    if (!rawAgentId) {
      rawAgentId = token.trim();
      i += 1;
      continue;
    }

    return {
      ok: false,
      error: `Unexpected argument: ${token}. ${ACP_SPAWN_USAGE}`,
    };
  }

  const fallbackAgent = params.cfg.acp?.defaultAgent?.trim() || "";
  const normalizedAgentId = normalizeAgentId(rawAgentId || fallbackAgent);
  if (!normalizedAgentId) {
    return { ok: false, error: `Missing ACP agent id. ${ACP_SPAWN_USAGE}` };
  }

  return {
    ok: true,
    value: {
      agentId: normalizedAgentId,
      mode,
      thread,
      cwd,
      label: label || undefined,
    },
  };
}

function parseSteerInput(
  tokens: string[],
): { ok: true; value: ParsedSteerInput } | { ok: false; error: string } {
  let sessionToken: string | undefined;
  const instructionTokens: string[] = [];

  for (let i = 0; i < tokens.length; ) {
    const sessionOption = readOptionValue({
      tokens,
      index: i,
      flag: "--session",
    });
    if (sessionOption.matched) {
      if (sessionOption.error) {
        return {
          ok: false,
          error: `${sessionOption.error}. ${ACP_STEER_USAGE}`,
        };
      }
      sessionToken = sessionOption.value?.trim() || undefined;
      i = sessionOption.nextIndex;
      continue;
    }

    instructionTokens.push(tokens[i]);
    i += 1;
  }

  const instruction = instructionTokens.join(" ").trim();
  if (!instruction) {
    return {
      ok: false,
      error: ACP_STEER_USAGE,
    };
  }

  return {
    ok: true,
    value: {
      sessionToken,
      instruction,
    },
  };
}

function resolveAcpHelpText(): string {
  return [
    "ACP commands:",
    "-----",
    "/acp spawn [agentId] [--mode persistent|oneshot] [--thread auto|here|off] [--cwd <path>] [--label <label>]",
    "/acp cancel [session-key|session-id|session-label]",
    "/acp steer [--session <session-key|session-id|session-label>] <instruction>",
    "/acp close [session-key|session-id|session-label]",
    "/acp sessions",
    "",
    "Notes:",
    "- /focus and /unfocus also work with ACP session keys.",
    "- ACP dispatch of normal thread messages is controlled by acp.dispatch.enabled.",
  ].join("\n");
}

function resolveAcpDispatchPolicyNote(cfg: OpenClawConfig): string | null {
  if (cfg.acp?.enabled === false) {
    return "ACP is disabled by policy (`acp.enabled=false`).";
  }
  if (cfg.acp?.dispatch?.enabled !== true) {
    return "ACP dispatch is disabled by policy (`acp.dispatch.enabled=false`).";
  }
  return null;
}

function isAgentAllowedByPolicy(cfg: OpenClawConfig, agentId: string): boolean {
  const allowed = (cfg.acp?.allowedAgents ?? [])
    .map((entry) => normalizeAgentId(entry))
    .filter(Boolean);
  if (allowed.length === 0) {
    return true;
  }
  const normalized = normalizeAgentId(agentId);
  return allowed.includes(normalized);
}

function resolveDiscordAcpSpawnFlags(params: HandleCommandsParams): {
  enabled: boolean;
  spawnAcpSessions: boolean;
} {
  const accountId = resolveDiscordAccountId(params);
  const root = params.cfg.channels?.discord?.threadBindings;
  const account = params.cfg.channels?.discord?.accounts?.[accountId]?.threadBindings;
  return {
    enabled:
      account?.enabled ?? root?.enabled ?? params.cfg.session?.threadBindings?.enabled ?? true,
    spawnAcpSessions: account?.spawnAcpSessions ?? root?.spawnAcpSessions ?? false,
  };
}

function resolveCommandRequestId(params: HandleCommandsParams): string {
  const value =
    params.ctx.MessageSidFull ??
    params.ctx.MessageSid ??
    params.ctx.MessageSidFirst ??
    params.ctx.MessageSidLast;
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }
  return randomUUID();
}

async function resolveSessionKeyByToken(token: string): Promise<string | null> {
  const trimmed = token.trim();
  if (!trimmed) {
    return null;
  }
  const attempts: Array<Record<string, string>> = [{ key: trimmed }];
  if (SESSION_ID_RE.test(trimmed)) {
    attempts.push({ sessionId: trimmed });
  }
  attempts.push({ label: trimmed });

  for (const params of attempts) {
    try {
      const resolved = await callGateway<{ key?: string }>({
        method: "sessions.resolve",
        params,
        timeoutMs: 8_000,
      });
      const key = typeof resolved?.key === "string" ? resolved.key.trim() : "";
      if (key) {
        return key;
      }
    } catch {
      // Try next resolver strategy.
    }
  }
  return null;
}

function resolveBoundAcpThreadSessionKey(params: HandleCommandsParams): string | undefined {
  if (!isDiscordSurface(params)) {
    return undefined;
  }
  const threadId =
    params.ctx.MessageThreadId != null ? String(params.ctx.MessageThreadId).trim() : "";
  if (!threadId) {
    return undefined;
  }
  const manager = getThreadBindingManager(resolveDiscordAccountId(params));
  const binding = manager?.getByThreadId(threadId);
  if (!binding || binding.targetKind !== "acp") {
    return undefined;
  }
  return binding.targetSessionKey.trim() || undefined;
}

async function resolveAcpTargetSessionKey(params: {
  commandParams: HandleCommandsParams;
  token?: string;
}): Promise<{ ok: true; sessionKey: string } | { ok: false; error: string }> {
  const token = params.token?.trim() || "";
  if (token) {
    const resolved = await resolveSessionKeyByToken(token);
    if (!resolved) {
      return {
        ok: false,
        error: `Unable to resolve session target: ${token}`,
      };
    }
    return { ok: true, sessionKey: resolved };
  }

  const threadBound = resolveBoundAcpThreadSessionKey(params.commandParams);
  if (threadBound) {
    return {
      ok: true,
      sessionKey: threadBound,
    };
  }

  const fallback = resolveRequesterSessionKey(params.commandParams, {
    preferCommandTarget: true,
  });
  if (!fallback) {
    return {
      ok: false,
      error: "Missing session key.",
    };
  }
  return {
    ok: true,
    sessionKey: fallback,
  };
}

function collectAcpErrorText(params: {
  error: unknown;
  fallbackCode: AcpRuntimeError["code"];
  fallbackMessage: string;
}): string {
  const acpError = toAcpRuntimeError({
    error: params.error,
    fallbackCode: params.fallbackCode,
    fallbackMessage: params.fallbackMessage,
  });
  return `ACP error (${acpError.code}): ${acpError.message}`;
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
  initializedRuntime?: SpawnRuntimeCloseHandle;
}) {
  if (params.initializedRuntime) {
    await params.initializedRuntime.runtime
      .close({
        handle: params.initializedRuntime.handle,
        reason: "spawn-failed",
      })
      .catch((err) => {
        logVerbose(`commands-acp: cleanup close failed for ${params.sessionKey}: ${String(err)}`);
      });
  }

  const acpManager = getAcpSessionManager();
  await acpManager
    .closeSession({
      cfg: params.cfg,
      sessionKey: params.sessionKey,
      reason: "spawn-failed",
      allowBackendUnavailable: true,
      requireAcpSession: false,
    })
    .catch((err) => {
      logVerbose(`commands-acp: cleanup close failed for ${params.sessionKey}: ${String(err)}`);
    });

  unbindThreadBindingsBySessionKey({
    targetSessionKey: params.sessionKey,
    targetKind: "acp",
    reason: "spawn-failed",
    sendFarewell: false,
  });

  if (params.shouldDeleteSession) {
    try {
      await callGateway({
        method: "sessions.delete",
        params: {
          key: params.sessionKey,
          deleteTranscript: false,
          emitLifecycleHooks: false,
        },
        timeoutMs: 10_000,
      });
    } catch {
      // Best-effort cleanup only.
    }
  }
}

async function handleAcpSpawnAction(
  params: HandleCommandsParams,
  restTokens: string[],
): Promise<CommandHandlerResult> {
  if (!isAcpEnabled(params.cfg)) {
    return stopWithText("ACP is disabled by policy (`acp.enabled=false`).");
  }

  const parsed = parseSpawnInput(params, restTokens);
  if (!parsed.ok) {
    return stopWithText(`⚠️ ${parsed.error}`);
  }

  const spawn = parsed.value;
  if (!isAgentAllowedByPolicy(params.cfg, spawn.agentId)) {
    return stopWithText(`⚠️ ACP agent "${spawn.agentId}" is not allowed by policy.`);
  }

  const acpManager = getAcpSessionManager();
  const sessionKey = `agent:${spawn.agentId}:acp:${randomUUID()}`;

  let initializedBackend = "";
  let initializedRuntime: SpawnRuntimeCloseHandle | undefined;
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
        shouldDeleteSession: false,
        initializedRuntime,
      });
      return stopWithText(`⚠️ ${bound.error}`);
    }
    binding = bound.binding;
  }

  let sessionCreated = false;
  try {
    await callGateway({
      method: "sessions.patch",
      params: {
        key: sessionKey,
        ...(spawn.label ? { label: spawn.label } : {}),
      },
      timeoutMs: 10_000,
    });
    sessionCreated = true;
  } catch (err) {
    await cleanupFailedSpawn({
      cfg: params.cfg,
      sessionKey,
      shouldDeleteSession: sessionCreated,
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

  const dispatchNote = resolveAcpDispatchPolicyNote(params.cfg);
  if (dispatchNote) {
    parts.push(`ℹ️ ${dispatchNote}`);
  }

  return stopWithText(parts.join(" "));
}

async function handleAcpCancelAction(
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
    return stopWithText(`⚠️ Session is not ACP-enabled: ${target.sessionKey}`);
  }
  if (resolved.kind === "stale") {
    return stopWithText(`⚠️ ${resolved.error.message}`);
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

async function handleAcpSteerAction(
  params: HandleCommandsParams,
  restTokens: string[],
): Promise<CommandHandlerResult> {
  if (!isAcpEnabled(params.cfg)) {
    return stopWithText("ACP is disabled by policy (`acp.enabled=false`).");
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
    return stopWithText(`⚠️ Session is not ACP-enabled: ${target.sessionKey}`);
  }
  if (resolved.kind === "stale") {
    return stopWithText(`⚠️ ${resolved.error.message}`);
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

async function handleAcpCloseAction(
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
    return stopWithText(`⚠️ Session is not ACP-enabled: ${target.sessionKey}`);
  }
  if (resolved.kind === "stale") {
    return stopWithText(`⚠️ ${resolved.error.message}`);
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
    const converted = toAcpRuntimeError({
      error: err,
      fallbackCode: "ACP_TURN_FAILED",
      fallbackMessage: "ACP close failed before completion.",
    });
    return stopWithText(`ACP error (${converted.code}): ${converted.message}`);
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

function formatAcpSessionLine(params: {
  key: string;
  entry: SessionEntry;
  currentSessionKey?: string;
  threadId?: string;
}): string {
  const acp = params.entry.acp;
  if (!acp) {
    return "";
  }
  const marker = params.currentSessionKey === params.key ? "*" : " ";
  const label = params.entry.label?.trim() || acp.agent;
  const threadText = params.threadId ? `, thread:${params.threadId}` : "";
  return `${marker} ${label} (${acp.mode}, ${acp.state}, backend:${acp.backend}${threadText}) -> ${params.key}`;
}

function handleAcpSessionsAction(
  params: HandleCommandsParams,
  restTokens: string[],
): CommandHandlerResult {
  if (restTokens.length > 0) {
    return stopWithText("Usage: /acp sessions");
  }

  const currentSessionKey = resolveBoundAcpThreadSessionKey(params) || params.sessionKey;
  if (!currentSessionKey) {
    return stopWithText("⚠️ Missing session key.");
  }

  const { storePath } = resolveSessionStorePathForAcp({
    cfg: params.cfg,
    sessionKey: currentSessionKey,
  });

  let store: Record<string, SessionEntry>;
  try {
    store = loadSessionStore(storePath);
  } catch {
    store = {};
  }

  const accountId = isDiscordSurface(params) ? resolveDiscordAccountId(params) : undefined;
  const threadBindings = accountId ? getThreadBindingManager(accountId) : null;

  const rows = Object.entries(store)
    .filter(([, entry]) => Boolean(entry?.acp))
    .toSorted(([, a], [, b]) => (b?.updatedAt ?? 0) - (a?.updatedAt ?? 0))
    .slice(0, 20)
    .map(([key, entry]) => {
      const bindingThreadId = threadBindings?.listBySessionKey(key)[0]?.threadId;
      return formatAcpSessionLine({
        key,
        entry,
        currentSessionKey,
        threadId: bindingThreadId,
      });
    })
    .filter(Boolean);

  if (rows.length === 0) {
    return stopWithText("ACP sessions:\n-----\n(none)");
  }

  return stopWithText(["ACP sessions:", "-----", ...rows].join("\n"));
}

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
    case "sessions":
      return handleAcpSessionsAction(params, tokens);
    default:
      return stopWithText(resolveAcpHelpText());
  }
};
