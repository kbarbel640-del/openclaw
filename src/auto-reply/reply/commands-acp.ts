import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { getAcpSessionManager } from "../../acp/control-plane/manager.js";
import {
  cleanupFailedAcpSpawn,
  isAcpAgentAllowedByPolicy,
  isAcpEnabledByPolicy,
  resolveDiscordAcpSpawnFlags as resolveSharedDiscordAcpSpawnFlags,
  type AcpSpawnRuntimeCloseHandle,
} from "../../acp/control-plane/spawn.js";
import { formatAcpRuntimeErrorText, toAcpRuntimeErrorText } from "../../acp/runtime/error-text.js";
import { AcpRuntimeError, toAcpRuntimeError } from "../../acp/runtime/errors.js";
import { getAcpRuntimeBackend, requireAcpRuntimeBackend } from "../../acp/runtime/registry.js";
import { resolveSessionStorePathForAcp } from "../../acp/runtime/session-meta.js";
import type { AcpRuntimeSessionMode } from "../../acp/runtime/types.js";
import type { OpenClawConfig } from "../../config/config.js";
import { loadSessionStore } from "../../config/sessions.js";
import type { AcpSessionRuntimeOptions, SessionEntry } from "../../config/sessions/types.js";
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
const ACP_SET_MODE_USAGE = "Usage: /acp set-mode <mode> [session-key|session-id|session-label]";
const ACP_SET_USAGE = "Usage: /acp set <key> <value> [session-key|session-id|session-label]";
const ACP_CWD_USAGE = "Usage: /acp cwd <path> [session-key|session-id|session-label]";
const ACP_PERMISSIONS_USAGE =
  "Usage: /acp permissions <profile> [session-key|session-id|session-label]";
const ACP_TIMEOUT_USAGE = "Usage: /acp timeout <seconds> [session-key|session-id|session-label]";
const ACP_MODEL_USAGE = "Usage: /acp model <model-id> [session-key|session-id|session-label]";
const ACP_RESET_OPTIONS_USAGE = "Usage: /acp reset-options [session-key|session-id|session-label]";
const ACP_STATUS_USAGE = "Usage: /acp status [session-key|session-id|session-label]";
const ACP_INSTALL_USAGE = "Usage: /acp install";
const ACP_DOCTOR_USAGE = "Usage: /acp doctor";

type AcpAction =
  | "spawn"
  | "cancel"
  | "steer"
  | "close"
  | "sessions"
  | "status"
  | "set-mode"
  | "set"
  | "cwd"
  | "permissions"
  | "timeout"
  | "model"
  | "reset-options"
  | "doctor"
  | "install"
  | "help";

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

type ParsedSingleValueCommandInput = {
  value: string;
  sessionToken?: string;
};

type ParsedSetCommandInput = {
  key: string;
  value: string;
  sessionToken?: string;
};

function stopWithText(text: string): CommandHandlerResult {
  return {
    shouldContinue: false,
    reply: { text },
  };
}

function resolveAcpAction(tokens: string[]): AcpAction {
  const action = tokens[0]?.trim().toLowerCase();
  if (
    action === "spawn" ||
    action === "cancel" ||
    action === "steer" ||
    action === "close" ||
    action === "sessions" ||
    action === "status" ||
    action === "set-mode" ||
    action === "set" ||
    action === "cwd" ||
    action === "permissions" ||
    action === "timeout" ||
    action === "model" ||
    action === "reset-options" ||
    action === "doctor" ||
    action === "install" ||
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

function parseSingleValueCommandInput(
  tokens: string[],
  usage: string,
): { ok: true; value: ParsedSingleValueCommandInput } | { ok: false; error: string } {
  const value = tokens[0]?.trim() || "";
  if (!value) {
    return { ok: false, error: usage };
  }
  if (tokens.length > 2) {
    return { ok: false, error: usage };
  }
  const sessionToken = tokens[1]?.trim() || undefined;
  return {
    ok: true,
    value: {
      value,
      sessionToken,
    },
  };
}

function parseSetCommandInput(
  tokens: string[],
): { ok: true; value: ParsedSetCommandInput } | { ok: false; error: string } {
  const key = tokens[0]?.trim() || "";
  const value = tokens[1]?.trim() || "";
  if (!key || !value) {
    return {
      ok: false,
      error: ACP_SET_USAGE,
    };
  }
  if (tokens.length > 3) {
    return {
      ok: false,
      error: ACP_SET_USAGE,
    };
  }
  const sessionToken = tokens[2]?.trim() || undefined;
  return {
    ok: true,
    value: {
      key,
      value,
      sessionToken,
    },
  };
}

function parseOptionalSingleTarget(
  tokens: string[],
  usage: string,
): { ok: true; sessionToken?: string } | { ok: false; error: string } {
  if (tokens.length > 1) {
    return { ok: false, error: usage };
  }
  const token = tokens[0]?.trim() || "";
  return {
    ok: true,
    ...(token ? { sessionToken: token } : {}),
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
    "/acp status [session-key|session-id|session-label]",
    "/acp set-mode <mode> [session-key|session-id|session-label]",
    "/acp set <key> <value> [session-key|session-id|session-label]",
    "/acp cwd <path> [session-key|session-id|session-label]",
    "/acp permissions <profile> [session-key|session-id|session-label]",
    "/acp timeout <seconds> [session-key|session-id|session-label]",
    "/acp model <model-id> [session-key|session-id|session-label]",
    "/acp reset-options [session-key|session-id|session-label]",
    "/acp doctor",
    "/acp install",
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

function resolveConfiguredAcpBackendId(cfg: OpenClawConfig): string {
  return cfg.acp?.backend?.trim() || "acpx";
}

function resolveAcpInstallCommandHint(cfg: OpenClawConfig): string {
  const configured = cfg.acp?.runtime?.installCommand?.trim();
  if (configured) {
    return configured;
  }
  const backendId = resolveConfiguredAcpBackendId(cfg).toLowerCase();
  if (backendId === "acpx") {
    const localPath = path.resolve(process.cwd(), "extensions/acpx");
    if (existsSync(localPath)) {
      return `openclaw plugins install ${localPath}`;
    }
    return "openclaw plugins install @openclaw/acpx";
  }
  return `Install and enable the plugin that provides ACP backend "${backendId}".`;
}

function formatRuntimeOptionsText(options: AcpSessionRuntimeOptions): string {
  const extras = options.backendExtras
    ? Object.entries(options.backendExtras)
        .toSorted(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join(", ")
    : "";
  const parts = [
    options.runtimeMode ? `runtimeMode=${options.runtimeMode}` : null,
    options.model ? `model=${options.model}` : null,
    options.cwd ? `cwd=${options.cwd}` : null,
    options.permissionProfile ? `permissionProfile=${options.permissionProfile}` : null,
    typeof options.timeoutSeconds === "number" ? `timeoutSeconds=${options.timeoutSeconds}` : null,
    extras ? `extras={${extras}}` : null,
  ].filter(Boolean) as string[];
  if (parts.length === 0) {
    return "(none)";
  }
  return parts.join(", ");
}

function formatAcpCapabilitiesText(controls: string[]): string {
  if (controls.length === 0) {
    return "(none)";
  }
  return controls.toSorted().join(", ");
}

function resolveDiscordAcpSpawnFlags(params: HandleCommandsParams): {
  enabled: boolean;
  spawnAcpSessions: boolean;
} {
  const accountId = resolveDiscordAccountId(params);
  return resolveSharedDiscordAcpSpawnFlags(params.cfg, accountId);
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
  return toAcpRuntimeErrorText({
    error: params.error,
    fallbackCode: params.fallbackCode,
    fallbackMessage: params.fallbackMessage,
  });
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

async function handleAcpSpawnAction(
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
  if (!isAcpAgentAllowedByPolicy(params.cfg, spawn.agentId)) {
    return stopWithText(`⚠️ ACP agent "${spawn.agentId}" is not allowed by policy.`);
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
  if (!isAcpEnabledByPolicy(params.cfg)) {
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

async function handleAcpStatusAction(
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

async function handleAcpSetModeAction(
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

async function handleAcpSetAction(
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

async function handleAcpCwdAction(
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

async function handleAcpPermissionsAction(
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

async function handleAcpTimeoutAction(
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

async function handleAcpModelAction(
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

async function handleAcpResetOptionsAction(
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

async function handleAcpDoctorAction(
  params: HandleCommandsParams,
  restTokens: string[],
): Promise<CommandHandlerResult> {
  if (restTokens.length > 0) {
    return stopWithText(`⚠️ ${ACP_DOCTOR_USAGE}`);
  }

  const backendId = resolveConfiguredAcpBackendId(params.cfg);
  const installHint = resolveAcpInstallCommandHint(params.cfg);
  const registeredBackend = getAcpRuntimeBackend(backendId);
  const lines = ["ACP doctor:", "-----", `configuredBackend: ${backendId}`];
  if (registeredBackend) {
    lines.push(`registeredBackend: ${registeredBackend.id}`);
  } else {
    lines.push("registeredBackend: (none)");
  }

  if (registeredBackend?.runtime.doctor) {
    try {
      const report = await registeredBackend.runtime.doctor();
      lines.push(`runtimeDoctor: ${report.ok ? "ok" : "error"} (${report.message})`);
      if (report.code) {
        lines.push(`runtimeDoctorCode: ${report.code}`);
      }
      if (report.installCommand) {
        lines.push(`runtimeDoctorInstall: ${report.installCommand}`);
      }
      for (const detail of report.details ?? []) {
        lines.push(`runtimeDoctorDetail: ${detail}`);
      }
    } catch (error) {
      lines.push(
        `runtimeDoctor: error (${
          toAcpRuntimeError({
            error,
            fallbackCode: "ACP_TURN_FAILED",
            fallbackMessage: "Runtime doctor failed.",
          }).message
        })`,
      );
    }
  }

  try {
    const backend = requireAcpRuntimeBackend(backendId);
    const capabilities = backend.runtime.getCapabilities
      ? await backend.runtime.getCapabilities({})
      : { controls: [] as string[], configOptionKeys: [] as string[] };
    lines.push("healthy: yes");
    lines.push(`capabilities: ${formatAcpCapabilitiesText(capabilities.controls ?? [])}`);
    if ((capabilities.configOptionKeys?.length ?? 0) > 0) {
      lines.push(`configKeys: ${capabilities.configOptionKeys?.join(", ")}`);
    }
    return stopWithText(lines.join("\n"));
  } catch (error) {
    const acpError = toAcpRuntimeError({
      error,
      fallbackCode: "ACP_TURN_FAILED",
      fallbackMessage: "ACP backend doctor failed.",
    });
    lines.push("healthy: no");
    lines.push(formatAcpRuntimeErrorText(acpError));
    lines.push(`next: ${installHint}`);
    lines.push(`next: openclaw config set plugins.entries.${backendId}.enabled true`);
    if (backendId.toLowerCase() === "acpx") {
      lines.push("next: verify acpx is installed (`acpx --help`).");
    }
    return stopWithText(lines.join("\n"));
  }
}

function handleAcpInstallAction(
  params: HandleCommandsParams,
  restTokens: string[],
): CommandHandlerResult {
  if (restTokens.length > 0) {
    return stopWithText(`⚠️ ${ACP_INSTALL_USAGE}`);
  }
  const backendId = resolveConfiguredAcpBackendId(params.cfg);
  const installHint = resolveAcpInstallCommandHint(params.cfg);
  const lines = [
    "ACP install:",
    "-----",
    `configuredBackend: ${backendId}`,
    `run: ${installHint}`,
    `then: openclaw config set plugins.entries.${backendId}.enabled true`,
    "then: /acp doctor",
  ];
  return stopWithText(lines.join("\n"));
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
