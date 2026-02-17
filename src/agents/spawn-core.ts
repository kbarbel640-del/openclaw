import crypto from "node:crypto";
import type { ThinkLevel } from "../auto-reply/thinking.js";
import type { DeliveryContext } from "../utils/delivery-context.js";
import { formatThinkingLevels, normalizeThinkLevel } from "../auto-reply/thinking.js";
import { resolveSubagentProviderLimit } from "../config/agent-limits.js";
import { loadConfig } from "../config/config.js";
import { callGateway } from "../gateway/call.js";
import {
  getSubagentDepth,
  isSubagentSessionKey,
  normalizeAgentId,
  parseAgentSessionKey,
} from "../routing/session-key.js";
import { listAgentIds, resolveAgentConfig } from "./agent-scope.js";
import { AGENT_LANE_SUBAGENT } from "./lanes.js";
import {
  resolveAllowRecursiveSpawn,
  resolveMaxChildrenPerAgent,
  resolveMaxSpawnDepth,
  resolveSubagentRunTimeoutSeconds,
} from "./recursive-spawn-config.js";
import { buildSubagentSystemPrompt } from "./subagent-announce.js";
import { resolveSpawnProvider } from "./subagent-provider-limits.js";
import {
  getActiveChildCount,
  getProviderUsage,
  registerSubagentRun,
  releaseChildSlot,
  releaseProviderSlot,
  reserveChildSlot,
  reserveProviderSlot,
} from "./subagent-registry.js";
import {
  resolveDisplaySessionKey,
  resolveInternalSessionKey,
  resolveMainSessionAlias,
} from "./tools/sessions-helpers.js";

export type SpawnCoreCleanup = "delete" | "keep";

export type SpawnCoreParams = {
  task: string;
  cleanup: SpawnCoreCleanup;
  label?: string;
  requestedAgentId?: string;
  modelOverride?: string;
  thinkingOverrideRaw?: string;
  explicitRunTimeoutSeconds?: number;
  requesterSessionKey?: string;
  requesterOrigin?: DeliveryContext;
  requesterAgentIdOverride?: string;
  agentGroupId?: string | null;
  agentGroupChannel?: string | null;
  agentGroupSpace?: string | null;
};

export type SpawnCoreAcceptedResult = {
  status: "accepted";
  childSessionKey: string;
  runId: string;
  modelApplied?: boolean;
  warning?: string;
};

export type SpawnCoreBlockedResult =
  | {
      status: "blocked";
      reason: "parent_limit";
      error: string;
    }
  | {
      status: "blocked";
      reason: "provider_limit";
      provider: string;
      active: number;
      pending: number;
      used: number;
      maxConcurrent: number;
      error: string;
    };

export type SpawnCoreErrorResult = {
  status: "error";
  error: string;
  childSessionKey?: string;
  runId?: string;
};

export type SpawnCoreForbiddenResult = {
  status: "forbidden";
  error: string;
};

export type SpawnCoreFailureResult =
  | SpawnCoreBlockedResult
  | SpawnCoreErrorResult
  | SpawnCoreForbiddenResult;

export type SpawnCoreResult = SpawnCoreAcceptedResult;

export class SpawnError extends Error {
  readonly details: SpawnCoreFailureResult;

  constructor(details: SpawnCoreFailureResult) {
    super(details.error);
    this.name = "SpawnError";
    this.details = details;
  }
}

function splitModelRef(ref?: string) {
  if (!ref) {
    return { provider: undefined, model: undefined };
  }
  const trimmed = ref.trim();
  if (!trimmed) {
    return { provider: undefined, model: undefined };
  }
  const [provider, model] = trimmed.split("/", 2);
  if (model) {
    return { provider, model };
  }
  return { provider: undefined, model: trimmed };
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === "string") {
    return err;
  }
  return "error";
}

function throwSpawn(details: SpawnCoreFailureResult): never {
  throw new SpawnError(details);
}

function normalizeOptionalLabel(label?: string): string | undefined {
  if (typeof label !== "string") {
    return undefined;
  }
  const trimmed = label.trim();
  return trimmed || undefined;
}

function normalizeOptionalThinking(raw?: string): string | undefined {
  if (typeof raw !== "string") {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed || undefined;
}

function normalizeOptionalTimeoutSeconds(value?: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.max(0, Math.floor(value));
}

export async function spawnCore(params: SpawnCoreParams): Promise<SpawnCoreResult> {
  const cfg = loadConfig();
  const { mainKey, alias } = resolveMainSessionAlias(cfg);

  const label = normalizeOptionalLabel(params.label);
  const modelOverride = normalizeOptionalLabel(params.modelOverride);
  const thinkingOverrideRaw = normalizeOptionalThinking(params.thinkingOverrideRaw);

  const requesterSessionKey = params.requesterSessionKey;
  const requesterInternalKey = requesterSessionKey
    ? resolveInternalSessionKey({
        key: requesterSessionKey,
        alias,
        mainKey,
      })
    : alias;
  const requesterDisplayKey = resolveDisplaySessionKey({
    key: requesterInternalKey,
    alias,
    mainKey,
  });

  const requesterAgentId = normalizeAgentId(
    params.requesterAgentIdOverride ?? parseAgentSessionKey(requesterInternalKey)?.agentId,
  );
  const targetAgentId = params.requestedAgentId
    ? normalizeAgentId(params.requestedAgentId)
    : requesterAgentId;

  if (targetAgentId !== requesterAgentId) {
    const knownIds = new Set(listAgentIds(cfg).map((id) => normalizeAgentId(id)));
    if (!knownIds.has(normalizeAgentId(targetAgentId))) {
      throwSpawn({
        status: "error",
        error: `Unknown agent: "${targetAgentId}". Available: ${[...knownIds].join(", ")}`,
      });
    }
  }

  const runTimeoutSeconds =
    normalizeOptionalTimeoutSeconds(params.explicitRunTimeoutSeconds) ??
    resolveSubagentRunTimeoutSeconds(cfg, targetAgentId);

  if (typeof requesterSessionKey === "string" && isSubagentSessionKey(requesterSessionKey)) {
    const currentDepth = getSubagentDepth(requesterSessionKey);
    const allowRecursive = resolveAllowRecursiveSpawn(cfg, requesterAgentId);
    const maxDepth = resolveMaxSpawnDepth(cfg, requesterAgentId);

    if (!allowRecursive) {
      throwSpawn({
        status: "forbidden",
        error:
          "Recursive spawning is not enabled. Set subagents.allowRecursiveSpawn: true in config.",
      });
    }

    if (currentDepth >= maxDepth) {
      throwSpawn({
        status: "forbidden",
        error: `Maximum subagent depth (${maxDepth}) reached. Cannot spawn deeper.`,
      });
    }
  }

  if (targetAgentId !== requesterAgentId) {
    const allowAgents = resolveAgentConfig(cfg, requesterAgentId)?.subagents?.allowAgents ?? [];
    const allowAny = allowAgents.some((value) => value.trim() === "*");
    const normalizedTargetId = targetAgentId.toLowerCase();
    const allowSet = new Set(
      allowAgents
        .filter((value) => value.trim() && value.trim() !== "*")
        .map((value) => normalizeAgentId(value).toLowerCase()),
    );

    if (!allowAny && !allowSet.has(normalizedTargetId)) {
      const allowedText = allowAny
        ? "*"
        : allowSet.size > 0
          ? Array.from(allowSet).join(", ")
          : "none";
      throwSpawn({
        status: "forbidden",
        error: `agentId is not allowed for sessions_spawn (allowed: ${allowedText})`,
      });
    }
  }

  const targetAgentConfig = resolveAgentConfig(cfg, targetAgentId);
  const { model: resolvedModel, provider: resolvedProvider } = resolveSpawnProvider({
    cfg,
    targetAgentId,
    modelOverride,
  });
  const spawnProvider = resolvedProvider ?? "unknown";
  const providerLimit = resolveSubagentProviderLimit(cfg, spawnProvider);

  const maxChildren = resolveMaxChildrenPerAgent(cfg, requesterAgentId);
  const reservedChild = reserveChildSlot(requesterInternalKey, maxChildren);
  if (!reservedChild) {
    const active = getActiveChildCount(requesterInternalKey);
    throwSpawn({
      status: "blocked",
      reason: "parent_limit",
      error: `Cannot spawn: ${active}/${maxChildren} children active. Wait for a child to complete.`,
    });
  }

  const providerReservation = reserveProviderSlot(spawnProvider, providerLimit);
  if (!providerReservation) {
    const usage = getProviderUsage(spawnProvider);
    releaseChildSlot(requesterInternalKey);
    throwSpawn({
      status: "blocked",
      reason: "provider_limit",
      provider: spawnProvider,
      active: usage.active,
      pending: usage.pending,
      used: usage.total,
      maxConcurrent: providerLimit,
      error: `Cannot spawn: provider ${spawnProvider} is at capacity (${usage.total}/${providerLimit}).`,
    });
  }

  let registeredRun = false;
  let modelWarning: string | undefined;
  let modelApplied = false;

  try {
    const childSessionKey =
      typeof requesterSessionKey === "string" && isSubagentSessionKey(requesterSessionKey)
        ? `${requesterSessionKey}:sub:${crypto.randomUUID()}`
        : `agent:${targetAgentId}:subagent:${crypto.randomUUID()}`;

    const parentDepth = getSubagentDepth(requesterInternalKey);
    const childDepth = parentDepth > 0 ? parentDepth + 1 : 1;
    const spawnedByKey = requesterInternalKey;

    const resolvedThinkingDefaultRaw =
      normalizeOptionalThinking(
        (targetAgentConfig?.subagents as Record<string, unknown> | undefined)?.thinking as
          | string
          | undefined,
      ) ??
      normalizeOptionalThinking(
        (cfg.agents?.defaults?.subagents as Record<string, unknown> | undefined)?.thinking as
          | string
          | undefined,
      );

    let thinkingOverride: ThinkLevel | undefined;
    const thinkingCandidateRaw = thinkingOverrideRaw || resolvedThinkingDefaultRaw;
    if (thinkingCandidateRaw) {
      const normalizedThinking = normalizeThinkLevel(thinkingCandidateRaw);
      if (!normalizedThinking) {
        const { provider, model } = splitModelRef(resolvedModel);
        const hint = formatThinkingLevels(provider, model);
        throwSpawn({
          status: "error",
          error: `Invalid thinking level "${thinkingCandidateRaw}". Use one of: ${hint}.`,
        });
      }
      thinkingOverride = normalizedThinking;
    }

    if (resolvedModel) {
      try {
        await callGateway({
          method: "sessions.patch",
          params: { key: childSessionKey, model: resolvedModel },
          timeoutMs: 10_000,
        });
        modelApplied = true;
      } catch (err) {
        const messageText = toErrorMessage(err);
        const recoverable =
          messageText.includes("invalid model") || messageText.includes("model not allowed");
        if (!recoverable) {
          throwSpawn({
            status: "error",
            error: messageText,
            childSessionKey,
          });
        }
        modelWarning = messageText;
      }
    }

    if (thinkingOverride !== undefined) {
      try {
        await callGateway({
          method: "sessions.patch",
          params: {
            key: childSessionKey,
            thinkingLevel: thinkingOverride === "off" ? null : thinkingOverride,
          },
          timeoutMs: 10_000,
        });
      } catch (err) {
        throwSpawn({
          status: "error",
          error: toErrorMessage(err),
          childSessionKey,
        });
      }
    }

    const childSystemPrompt = buildSubagentSystemPrompt({
      requesterSessionKey,
      requesterOrigin: params.requesterOrigin,
      childSessionKey,
      label,
      task: params.task,
    });

    const childIdem = crypto.randomUUID();
    let childRunId: string = childIdem;
    try {
      const response = await callGateway<{ runId: string }>({
        method: "agent",
        params: {
          message: params.task,
          sessionKey: childSessionKey,
          channel: params.requesterOrigin?.channel,
          to: params.requesterOrigin?.to ?? undefined,
          accountId: params.requesterOrigin?.accountId ?? undefined,
          threadId:
            params.requesterOrigin?.threadId != null
              ? String(params.requesterOrigin.threadId)
              : undefined,
          idempotencyKey: childIdem,
          deliver: false,
          lane: AGENT_LANE_SUBAGENT,
          extraSystemPrompt: childSystemPrompt,
          thinking: thinkingOverride,
          timeout: runTimeoutSeconds > 0 ? runTimeoutSeconds : undefined,
          label,
          spawnedBy: spawnedByKey,
          groupId: params.agentGroupId ?? undefined,
          groupChannel: params.agentGroupChannel ?? undefined,
          groupSpace: params.agentGroupSpace ?? undefined,
        },
        timeoutMs: 10_000,
      });
      if (typeof response?.runId === "string" && response.runId) {
        childRunId = response.runId;
      }
    } catch (err) {
      throwSpawn({
        status: "error",
        error: toErrorMessage(err),
        childSessionKey,
        runId: childRunId,
      });
    }

    registerSubagentRun({
      runId: childRunId,
      childSessionKey,
      requesterSessionKey: requesterInternalKey,
      requesterOrigin: params.requesterOrigin,
      requesterDisplayKey,
      task: params.task,
      cleanup: params.cleanup,
      label,
      runTimeoutSeconds,
      depth: childDepth,
      provider: spawnProvider,
      providerReservation,
    });
    registeredRun = true;

    return {
      status: "accepted",
      childSessionKey,
      runId: childRunId,
      modelApplied: resolvedModel ? modelApplied : undefined,
      warning: modelWarning,
    };
  } finally {
    if (!registeredRun) {
      releaseChildSlot(requesterInternalKey);
      releaseProviderSlot(providerReservation);
    }
  }
}
