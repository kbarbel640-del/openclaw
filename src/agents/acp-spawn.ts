import crypto from "node:crypto";
import { cleanupFailedAcpSpawn, resolveDiscordAcpSpawnFlags } from "../acp/control-plane/spawn.js";
import { isAcpAgentAllowedByPolicy, isAcpEnabledByPolicy } from "../acp/policy.js";
import { requireAcpRuntimeBackend } from "../acp/runtime/registry.js";
import { upsertAcpSessionMeta } from "../acp/runtime/session-meta.js";
import type { AcpRuntimeSessionMode } from "../acp/runtime/types.js";
import { loadConfig } from "../config/config.js";
import type { OpenClawConfig } from "../config/config.js";
import {
  getThreadBindingManager,
  resolveThreadBindingIntroText,
  resolveThreadBindingThreadName,
  type ThreadBindingManager,
  type ThreadBindingRecord,
} from "../discord/monitor/thread-bindings.js";
import { parseDiscordTarget } from "../discord/targets.js";
import { callGateway } from "../gateway/call.js";
import { normalizeAgentId } from "../routing/session-key.js";
import { normalizeDeliveryContext } from "../utils/delivery-context.js";

export const ACP_SPAWN_MODES = ["run", "session"] as const;
export type SpawnAcpMode = (typeof ACP_SPAWN_MODES)[number];

export type SpawnAcpParams = {
  task: string;
  label?: string;
  agentId?: string;
  cwd?: string;
  mode?: SpawnAcpMode;
  thread?: boolean;
};

export type SpawnAcpContext = {
  agentSessionKey?: string;
  agentChannel?: string;
  agentAccountId?: string;
  agentTo?: string;
  agentThreadId?: string | number;
};

export type SpawnAcpResult = {
  status: "accepted" | "forbidden" | "error";
  childSessionKey?: string;
  runId?: string;
  mode?: SpawnAcpMode;
  note?: string;
  error?: string;
};

export const ACP_SPAWN_ACCEPTED_NOTE =
  "initial ACP task queued in isolated session; follow-ups continue in the bound thread.";
export const ACP_SPAWN_SESSION_ACCEPTED_NOTE =
  "thread-bound ACP session stays active after this task; continue in-thread for follow-ups.";

type PreparedAcpThreadBinding = {
  manager: ThreadBindingManager;
  channelId: string;
};

function resolveSpawnMode(params: {
  requestedMode?: SpawnAcpMode;
  threadRequested: boolean;
}): SpawnAcpMode {
  if (params.requestedMode === "run" || params.requestedMode === "session") {
    return params.requestedMode;
  }
  // Thread-bound spawns should default to persistent sessions.
  return params.threadRequested ? "session" : "run";
}

function resolveAcpSessionMode(mode: SpawnAcpMode): AcpRuntimeSessionMode {
  return mode === "session" ? "persistent" : "oneshot";
}

function resolveTargetAcpAgentId(params: {
  requestedAgentId?: string;
  cfg: OpenClawConfig;
}): { ok: true; agentId: string } | { ok: false; error: string } {
  const requested = normalizeOptionalAgentId(params.requestedAgentId);
  if (requested) {
    return { ok: true, agentId: requested };
  }

  const configuredDefault = normalizeOptionalAgentId(params.cfg.acp?.defaultAgent);
  if (configuredDefault) {
    return { ok: true, agentId: configuredDefault };
  }

  return {
    ok: false,
    error:
      "ACP target agent is not configured. Pass `agentId` in `sessions_spawn` or set `acp.defaultAgent` in config.",
  };
}

function normalizeOptionalAgentId(value: string | undefined | null): string | undefined {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    return undefined;
  }
  return normalizeAgentId(trimmed);
}

function summarizeError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === "string") {
    return err;
  }
  return "error";
}

function resolveThreadChannelId(params: {
  manager: ThreadBindingManager;
  to?: string;
  threadId?: string | number;
}): string | undefined {
  const currentThreadId = params.threadId != null ? String(params.threadId).trim() : "";
  if (currentThreadId) {
    const existing = params.manager.getByThreadId(currentThreadId);
    if (existing?.channelId?.trim()) {
      return existing.channelId.trim();
    }
  }

  const to = params.to?.trim() || "";
  if (!to) {
    return undefined;
  }
  try {
    const target = parseDiscordTarget(to, { defaultKind: "channel" });
    if (target?.kind === "channel" && target.id) {
      return target.id;
    }
  } catch {
    // Keep behavior fail-closed; caller surfaces actionable error text.
  }
  return undefined;
}

function prepareAcpThreadBinding(params: {
  cfg: OpenClawConfig;
  channel?: string;
  accountId?: string;
  to?: string;
  threadId?: string | number;
}): { ok: true; binding: PreparedAcpThreadBinding } | { ok: false; error: string } {
  const channel = params.channel?.trim().toLowerCase();
  if (channel !== "discord") {
    return {
      ok: false,
      error: "thread=true for ACP sessions is currently supported only on Discord.",
    };
  }

  const accountId = params.accountId?.trim() || "default";
  const flags = resolveDiscordAcpSpawnFlags(params.cfg, accountId);
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

  const manager = getThreadBindingManager(accountId);
  if (!manager) {
    return {
      ok: false,
      error: "Discord thread bindings are unavailable for this account.",
    };
  }
  const channelId = resolveThreadChannelId({
    manager,
    to: params.to,
    threadId: params.threadId,
  });
  if (!channelId) {
    return {
      ok: false,
      error: "Could not resolve a Discord channel for ACP thread spawn.",
    };
  }

  return {
    ok: true,
    binding: {
      manager,
      channelId,
    },
  };
}

export async function spawnAcpDirect(
  params: SpawnAcpParams,
  ctx: SpawnAcpContext,
): Promise<SpawnAcpResult> {
  const cfg = loadConfig();
  if (!isAcpEnabledByPolicy(cfg)) {
    return {
      status: "forbidden",
      error: "ACP is disabled by policy (`acp.enabled=false`).",
    };
  }

  const requestThreadBinding = params.thread === true;
  const spawnMode = resolveSpawnMode({
    requestedMode: params.mode,
    threadRequested: requestThreadBinding,
  });
  if (spawnMode === "session" && !requestThreadBinding) {
    return {
      status: "error",
      error: 'mode="session" requires thread=true so the ACP session can stay bound to a thread.',
    };
  }

  const targetAgentResult = resolveTargetAcpAgentId({
    requestedAgentId: params.agentId,
    cfg,
  });
  if (!targetAgentResult.ok) {
    return {
      status: "error",
      error: targetAgentResult.error,
    };
  }
  const targetAgentId = targetAgentResult.agentId;
  if (!isAcpAgentAllowedByPolicy(cfg, targetAgentId)) {
    return {
      status: "forbidden",
      error: `ACP agent "${targetAgentId}" is not allowed by policy.`,
    };
  }

  const sessionKey = `agent:${targetAgentId}:acp:${crypto.randomUUID()}`;
  const runtimeMode = resolveAcpSessionMode(spawnMode);

  let preparedBinding: PreparedAcpThreadBinding | null = null;
  if (requestThreadBinding) {
    const prepared = prepareAcpThreadBinding({
      cfg,
      channel: ctx.agentChannel,
      accountId: ctx.agentAccountId,
      to: ctx.agentTo,
      threadId: ctx.agentThreadId,
    });
    if (!prepared.ok) {
      return {
        status: "error",
        error: prepared.error,
      };
    }
    preparedBinding = prepared.binding;
  }

  let binding: ThreadBindingRecord | null = null;
  if (preparedBinding) {
    try {
      binding = await preparedBinding.manager.bindTarget({
        channelId: preparedBinding.channelId,
        createThread: true,
        threadName: resolveThreadBindingThreadName({
          agentId: targetAgentId,
          label: params.label || targetAgentId,
        }),
        targetKind: "acp",
        targetSessionKey: sessionKey,
        agentId: targetAgentId,
        label: params.label || undefined,
        boundBy: "system",
        introText: resolveThreadBindingIntroText({
          agentId: targetAgentId,
          label: params.label || undefined,
          sessionTtlMs: preparedBinding.manager.getSessionTtlMs(),
        }),
      });
    } catch (err) {
      await cleanupFailedAcpSpawn({
        cfg,
        sessionKey,
        shouldDeleteSession: false,
        deleteTranscript: true,
      });
      return {
        status: "error",
        error: `Thread bind failed: ${summarizeError(err)}`,
      };
    }
    if (!binding) {
      await cleanupFailedAcpSpawn({
        cfg,
        sessionKey,
        shouldDeleteSession: false,
        deleteTranscript: true,
      });
      return {
        status: "error",
        error: "Failed to create and bind a Discord thread for this ACP session.",
      };
    }
  }

  let sessionCreated = false;
  try {
    await callGateway({
      method: "sessions.patch",
      params: {
        key: sessionKey,
        ...(params.label ? { label: params.label } : {}),
      },
      timeoutMs: 10_000,
    });
    sessionCreated = true;
    const backend = requireAcpRuntimeBackend(cfg.acp?.backend);
    const upserted = await upsertAcpSessionMeta({
      cfg,
      sessionKey,
      mutate: () => ({
        backend: backend.id,
        agent: targetAgentId,
        runtimeSessionName: sessionKey,
        mode: runtimeMode,
        cwd: params.cwd,
        state: "idle",
        lastActivityAt: Date.now(),
      }),
    });
    if (!upserted?.acp) {
      throw new Error(`Could not persist ACP metadata for ${sessionKey}.`);
    }
  } catch (err) {
    await cleanupFailedAcpSpawn({
      cfg,
      sessionKey,
      shouldDeleteSession: sessionCreated,
      deleteTranscript: true,
    });
    return {
      status: "error",
      error: summarizeError(err),
    };
  }

  const requesterOrigin = normalizeDeliveryContext({
    channel: ctx.agentChannel,
    accountId: ctx.agentAccountId,
    to: ctx.agentTo,
    threadId: ctx.agentThreadId,
  });
  const deliveryThreadIdRaw = binding?.threadId ?? requesterOrigin?.threadId;
  const deliveryThreadId =
    deliveryThreadIdRaw != null ? String(deliveryThreadIdRaw).trim() || undefined : undefined;
  const inferredDeliveryTo =
    requesterOrigin?.to?.trim() || (deliveryThreadId ? `channel:${deliveryThreadId}` : undefined);
  const hasDeliveryTarget = Boolean(requesterOrigin?.channel && inferredDeliveryTo);
  const childIdem = crypto.randomUUID();
  let childRunId: string = childIdem;
  try {
    const response = await callGateway<{ runId?: string }>({
      method: "agent",
      params: {
        message: params.task,
        sessionKey,
        channel: hasDeliveryTarget ? requesterOrigin?.channel : undefined,
        to: hasDeliveryTarget ? inferredDeliveryTo : undefined,
        accountId: hasDeliveryTarget ? (requesterOrigin?.accountId ?? undefined) : undefined,
        threadId: hasDeliveryTarget ? deliveryThreadId : undefined,
        idempotencyKey: childIdem,
        deliver: hasDeliveryTarget,
        label: params.label || undefined,
      },
      timeoutMs: 10_000,
    });
    if (typeof response?.runId === "string" && response.runId.trim()) {
      childRunId = response.runId.trim();
    }
  } catch (err) {
    await cleanupFailedAcpSpawn({
      cfg,
      sessionKey,
      shouldDeleteSession: true,
      deleteTranscript: true,
    });
    return {
      status: "error",
      error: summarizeError(err),
      childSessionKey: sessionKey,
    };
  }

  return {
    status: "accepted",
    childSessionKey: sessionKey,
    runId: childRunId,
    mode: spawnMode,
    note: spawnMode === "session" ? ACP_SPAWN_SESSION_ACCEPTED_NOTE : ACP_SPAWN_ACCEPTED_NOTE,
  };
}
