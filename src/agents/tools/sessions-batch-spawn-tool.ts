import crypto from "node:crypto";
import { z } from "zod";
import { loadConfig } from "../../config/config.js";
import type { AgentRole } from "../../config/types.agents.js";
import { callGateway } from "../../gateway/call.js";
import {
  isSubagentSessionKey,
  normalizeAgentId,
  parseAgentSessionKey,
} from "../../routing/session-key.js";
import { normalizeDeliveryContext } from "../../utils/delivery-context.js";
import type { GatewayMessageChannel } from "../../utils/message-channel.js";
import {
  canSpawnRole,
  listAgentIds,
  resolveAgentConfig,
  resolveAgentRole,
} from "../agent-scope.js";
import { registerDelegation } from "../delegation-registry.js";
import { AGENT_LANE_SUBAGENT } from "../lanes.js";
import { zodToToolJsonSchema } from "../schema/zod-tool-schema.js";
import { buildSubagentSystemPrompt } from "../subagent-announce.js";
import { registerSubagentRun, getSubagentRunById } from "../subagent-registry.js";
import type { AnyAgentTool } from "./common.js";
import { jsonResult } from "./common.js";
import {
  resolveDisplaySessionKey,
  resolveInternalSessionKey,
  resolveMainSessionAlias,
} from "./sessions-helpers.js";

const batchTaskShape = z.object({
  agentId: z.string(),
  task: z.string(),
  label: z.string().optional(),
  model: z.string().optional(),
});

const SessionsBatchSpawnToolSchema = zodToToolJsonSchema(
  z.object({
    tasks: z.array(batchTaskShape),
    waitMode: z.enum(["all", "any", "none"]).optional(),
    runTimeoutSeconds: z.number().min(0).optional(),
    cleanup: z.enum(["delete", "keep", "idle"]).optional(),
  }),
);

type BatchTask = {
  agentId: string;
  task: string;
  label?: string;
  model?: string;
};

type SpawnedTask = {
  sessionKey: string;
  runId: string;
  agentId: string;
  task: string;
  label?: string;
};

type TaskResult = {
  sessionKey: string;
  runId: string;
  status: "completed" | "error" | "running" | "pending";
  result?: string;
  error?: string;
};

function normalizeModelSelection(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const primary = (value as { primary?: unknown }).primary;
  if (typeof primary === "string" && primary.trim()) {
    return primary.trim();
  }
  return undefined;
}

async function spawnSingleTask(params: {
  task: BatchTask;
  requesterAgentId: string;
  requesterRole: AgentRole;
  requesterInternalKey: string;
  requesterOrigin: ReturnType<typeof normalizeDeliveryContext>;
  cfg: ReturnType<typeof loadConfig>;
  alias: string;
  mainKey: string;
  runTimeoutSeconds: number;
  cleanup: "delete" | "keep" | "idle";
  groupId?: string | null;
  groupChannel?: string | null;
  groupSpace?: string | null;
}): Promise<{ ok: true; spawned: SpawnedTask } | { ok: false; error: string }> {
  const {
    task,
    requesterAgentId,
    requesterRole,
    requesterInternalKey,
    requesterOrigin,
    cfg,
    alias,
    mainKey,
    runTimeoutSeconds,
    cleanup,
    groupId,
    groupChannel,
    groupSpace,
  } = params;

  // Validate agent exists
  const targetAgentId = normalizeAgentId(task.agentId);
  const registeredAgentIds = listAgentIds(cfg).map((id) => id.toLowerCase());
  if (!registeredAgentIds.includes(targetAgentId.toLowerCase())) {
    return {
      ok: false,
      error: `agentId "${targetAgentId}" is not registered. Available: ${registeredAgentIds.join(", ")}`,
    };
  }

  // Check agent allowlist if different from requester
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
      return {
        ok: false,
        error: `agentId "${targetAgentId}" not allowed for batch spawn`,
      };
    }
  }

  // Check role permission
  const targetRole = resolveAgentRole(cfg, targetAgentId);
  if (!canSpawnRole(requesterRole, targetRole)) {
    return {
      ok: false,
      error: `Cannot spawn "${targetAgentId}" (${targetRole}) — insufficient rank`,
    };
  }

  const childSessionKey = `agent:${targetAgentId}:subagent:${crypto.randomUUID()}`;
  const targetAgentConfig = resolveAgentConfig(cfg, targetAgentId);
  const resolvedModel =
    normalizeModelSelection(task.model) ??
    normalizeModelSelection(targetAgentConfig?.subagents?.model) ??
    normalizeModelSelection(cfg.agents?.defaults?.subagents?.model);

  // Apply model if provided
  if (resolvedModel) {
    try {
      await callGateway({
        method: "sessions.patch",
        params: { key: childSessionKey, model: resolvedModel },
        timeoutMs: 10_000,
      });
    } catch (err) {
      const messageText =
        err instanceof Error ? err.message : typeof err === "string" ? err : "error";
      const recoverable =
        messageText.includes("invalid model") || messageText.includes("model not allowed");
      if (!recoverable) {
        return { ok: false, error: messageText };
      }
      // Continue with default model
    }
  }

  const label = task.label || undefined;
  const childSystemPrompt = buildSubagentSystemPrompt({
    requesterSessionKey: requesterInternalKey,
    requesterOrigin,
    childSessionKey,
    label,
    task: task.task,
    cleanup,
  });

  const childIdem = crypto.randomUUID();
  let childRunId: string = childIdem;

  try {
    const response = await callGateway<{ runId: string }>({
      method: "agent",
      params: {
        message: task.task,
        sessionKey: childSessionKey,
        channel: requesterOrigin?.channel,
        idempotencyKey: childIdem,
        deliver: false,
        lane: AGENT_LANE_SUBAGENT,
        extraSystemPrompt: childSystemPrompt,
        timeout: runTimeoutSeconds > 0 ? runTimeoutSeconds : undefined,
        label,
        spawnedBy: requesterInternalKey,
        groupId: groupId ?? undefined,
        groupChannel: groupChannel ?? undefined,
        groupSpace: groupSpace ?? undefined,
      },
      timeoutMs: 10_000,
    });
    if (typeof response?.runId === "string" && response.runId) {
      childRunId = response.runId;
    }
  } catch (err) {
    const messageText =
      err instanceof Error ? err.message : typeof err === "string" ? err : "error";
    return { ok: false, error: messageText };
  }

  const requesterDisplayKey = resolveDisplaySessionKey({
    key: requesterInternalKey,
    alias,
    mainKey,
  });

  registerSubagentRun({
    runId: childRunId,
    childSessionKey,
    requesterSessionKey: requesterInternalKey,
    requesterOrigin,
    requesterDisplayKey,
    task: task.task,
    cleanup,
    label,
    runTimeoutSeconds,
  });

  // Auto-create delegation record
  try {
    registerDelegation({
      fromAgentId: requesterAgentId,
      fromSessionKey: requesterInternalKey,
      fromRole: requesterRole,
      toAgentId: targetAgentId,
      toSessionKey: childSessionKey,
      toRole: targetRole,
      task: task.task.slice(0, 200),
      priority: "normal",
    });
  } catch {
    // Non-critical
  }

  return {
    ok: true,
    spawned: {
      sessionKey: childSessionKey,
      runId: childRunId,
      agentId: targetAgentId,
      task: task.task,
      label,
    },
  };
}

async function pollTaskCompletion(
  spawned: SpawnedTask[],
  waitMode: "all" | "any",
  pollIntervalMs = 1000,
  maxPollMs = 300_000,
): Promise<TaskResult[]> {
  const results: TaskResult[] = [];
  const pending = new Set(spawned.map((s) => s.runId));
  const startTime = Date.now();

  while (pending.size > 0) {
    if (Date.now() - startTime > maxPollMs) {
      // Timeout: mark remaining as pending
      for (const runId of pending) {
        const task = spawned.find((s) => s.runId === runId);
        if (task) {
          results.push({
            sessionKey: task.sessionKey,
            runId: task.runId,
            status: "running",
          });
        }
      }
      break;
    }

    for (const runId of pending) {
      const run = getSubagentRunById(runId);
      if (!run) {
        pending.delete(runId);
        const task = spawned.find((s) => s.runId === runId);
        if (task) {
          results.push({
            sessionKey: task.sessionKey,
            runId,
            status: "error",
            error: "Run not found",
          });
        }
        continue;
      }

      if (run.outcome) {
        pending.delete(runId);
        const task = spawned.find((s) => s.runId === runId);
        if (task) {
          results.push({
            sessionKey: task.sessionKey,
            runId,
            status: run.outcome.status === "ok" ? "completed" : "error",
            error: run.outcome.error,
          });
        }

        // For "any" mode, return as soon as first completes
        if (waitMode === "any" && results.length > 0) {
          // Add remaining as still running
          for (const remainingId of pending) {
            const remainingTask = spawned.find((s) => s.runId === remainingId);
            if (remainingTask) {
              results.push({
                sessionKey: remainingTask.sessionKey,
                runId: remainingId,
                status: "running",
              });
            }
          }
          return results;
        }
      }
    }

    if (pending.size > 0) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }

  return results;
}

export function createSessionsBatchSpawnTool(opts?: {
  agentSessionKey?: string;
  agentChannel?: GatewayMessageChannel;
  agentAccountId?: string;
  agentTo?: string;
  agentThreadId?: string | number;
  agentGroupId?: string | null;
  agentGroupChannel?: string | null;
  agentGroupSpace?: string | null;
  sandboxed?: boolean;
  requesterAgentIdOverride?: string;
}): AnyAgentTool {
  return {
    label: "Sessions",
    name: "sessions_spawn_batch",
    description:
      "Spawn multiple background sub-agent runs in parallel. Use for concurrent task execution. Supports fire-and-forget or wait-for-completion modes.",
    parameters: SessionsBatchSpawnToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const tasks = Array.isArray(params.tasks) ? (params.tasks as BatchTask[]) : [];
      const waitMode =
        params.waitMode === "all" || params.waitMode === "any" || params.waitMode === "none"
          ? params.waitMode
          : "all";
      const cleanup =
        params.cleanup === "keep" || params.cleanup === "delete" || params.cleanup === "idle"
          ? params.cleanup
          : "idle";
      const runTimeoutSeconds =
        typeof params.runTimeoutSeconds === "number" && Number.isFinite(params.runTimeoutSeconds)
          ? Math.max(0, Math.floor(params.runTimeoutSeconds))
          : 0;

      if (tasks.length === 0) {
        return jsonResult({
          status: "error",
          error: "No tasks provided",
        });
      }

      const cfg = loadConfig();
      const { mainKey, alias } = resolveMainSessionAlias(cfg);
      const requesterSessionKey = opts?.agentSessionKey;

      if (typeof requesterSessionKey === "string" && isSubagentSessionKey(requesterSessionKey)) {
        return jsonResult({
          status: "forbidden",
          error: "sessions_spawn_batch is not allowed from sub-agent sessions",
        });
      }

      const requesterInternalKey = requesterSessionKey
        ? resolveInternalSessionKey({
            key: requesterSessionKey,
            alias,
            mainKey,
          })
        : alias;

      const requesterAgentId = normalizeAgentId(
        opts?.requesterAgentIdOverride ?? parseAgentSessionKey(requesterInternalKey)?.agentId,
      );

      const requesterRole = resolveAgentRole(cfg, requesterAgentId);
      const requesterOrigin = normalizeDeliveryContext({
        channel: opts?.agentChannel,
        accountId: opts?.agentAccountId,
        to: opts?.agentTo,
        threadId: opts?.agentThreadId,
      });

      // Spawn all tasks concurrently
      const spawnPromises = tasks.map((task) =>
        spawnSingleTask({
          task,
          requesterAgentId,
          requesterRole,
          requesterInternalKey,
          requesterOrigin,
          cfg,
          alias,
          mainKey,
          runTimeoutSeconds,
          cleanup,
          groupId: opts?.agentGroupId,
          groupChannel: opts?.agentGroupChannel,
          groupSpace: opts?.agentGroupSpace,
        }),
      );

      const spawnResults = await Promise.all(spawnPromises);

      const spawned: SpawnedTask[] = [];
      const errors: { agentId: string; error: string }[] = [];

      for (let i = 0; i < spawnResults.length; i++) {
        const result = spawnResults[i];
        if (result.ok) {
          spawned.push(result.spawned);
        } else {
          errors.push({
            agentId: tasks[i].agentId,
            error: result.error,
          });
        }
      }

      // For "none" mode, return immediately
      if (waitMode === "none") {
        return jsonResult({
          status: "spawned",
          spawned: spawned.length,
          results: spawned.map((s) => ({
            sessionKey: s.sessionKey,
            runId: s.runId,
            status: "pending",
          })),
          errors: errors.length > 0 ? errors : undefined,
        });
      }

      // For "all" or "any" mode, poll for completion
      if (spawned.length === 0) {
        return jsonResult({
          status: "error",
          error: "All spawns failed",
          errors,
        });
      }

      const results = await pollTaskCompletion(spawned, waitMode);

      const allCompleted = results.every((r) => r.status === "completed");
      const anyCompleted = results.some((r) => r.status === "completed");
      const _anyError = results.some((r) => r.status === "error");

      return jsonResult({
        status:
          waitMode === "all"
            ? allCompleted
              ? "completed"
              : "partial"
            : anyCompleted
              ? "completed"
              : "partial",
        results: results.map((r) => ({
          sessionKey: r.sessionKey,
          runId: r.runId,
          status: r.status,
          result: r.result,
          error: r.error,
        })),
        errors: errors.length > 0 ? errors : undefined,
      });
    },
  };
}
