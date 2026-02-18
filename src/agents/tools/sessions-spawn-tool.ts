import crypto from "node:crypto";

import { Type } from "@sinclair/typebox";

import { formatThinkingLevels, normalizeThinkLevel } from "../../auto-reply/thinking.js";
import { loadConfig } from "../../config/config.js";
import { callGateway } from "../../gateway/call.js";
import {
  isSubagentSessionKey,
  normalizeAgentId,
  parseAgentSessionKey,
} from "../../routing/session-key.js";
import { normalizeDeliveryContext } from "../../utils/delivery-context.js";
import type { GatewayMessageChannel } from "../../utils/message-channel.js";
import { resolveAgentConfig } from "../agent-scope.js";
import { AGENT_LANE_SUBAGENT } from "../lanes.js";
import { optionalStringEnum } from "../schema/typebox.js";
import { buildSubagentSystemPrompt } from "../subagent-announce.js";
import { registerSubagentRun } from "../subagent-registry.js";
import type { AnyAgentTool } from "./common.js";
import { jsonResult, readStringParam } from "./common.js";
import {
  resolveDisplaySessionKey,
  resolveInternalSessionKey,
  resolveMainSessionAlias,
} from "./sessions-helpers.js";

const SessionsSpawnToolSchema = Type.Object({
  task: Type.String(),
  label: Type.Optional(Type.String()),
  agentId: Type.Optional(Type.String()),
  model: Type.Optional(Type.String()),
  thinking: Type.Optional(Type.String()),
  runTimeoutSeconds: Type.Optional(Type.Number({ minimum: 0 })),
  // Back-compat alias. Prefer runTimeoutSeconds.
  timeoutSeconds: Type.Optional(Type.Number({ minimum: 0 })),
  cleanup: optionalStringEnum(["delete", "keep"] as const),
});

function splitModelRef(ref?: string) {
  if (!ref) return { provider: undefined, model: undefined };
  const trimmed = ref.trim();
  if (!trimmed) return { provider: undefined, model: undefined };
  const [provider, model] = trimmed.split("/", 2);
  if (model) return { provider, model };
  return { provider: undefined, model: trimmed };
}

function normalizeModelSelection(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (!value || typeof value !== "object") return undefined;
  const primary = (value as { primary?: unknown }).primary;
  if (typeof primary === "string" && primary.trim()) return primary.trim();
  return undefined;
}

async function emitSessionsSpawnModelOverrideEvent(text: string) {
  try {
    await callGateway({
      method: "system-event",
      params: { text },
      timeoutMs: 5_000,
    });
  } catch {
    // Best-effort only; never fail spawn because observability failed.
  }
}

async function verifySessionModelApplied(opts: {
  childSessionKey: string;
  /**
   * Spawn requester key. Historically we attempted to filter sessions.list by this value, but the
   * session store isn't guaranteed to have spawnedBy populated at the moment we patch model.
   * Kept for observability/back-compat.
   */
  spawnedBy: string;
  agentId: string;
  expectedModelRef: string;
  /**
   * sessions.patch result entry (if available). Prefer this over sessions.list readback to avoid
   * races and sessions.list filtering changes.
   */
  patchedEntry?: { modelProvider?: unknown; model?: unknown } | null;
}) {
  const { provider: expectedProvider, model: expectedModel } = splitModelRef(opts.expectedModelRef);

  const resolveActualFromEntry = (entry?: { modelProvider?: unknown; model?: unknown } | null) => {
    if (!entry) return { provider: undefined, model: undefined };
    const provider = typeof entry.modelProvider === "string" ? entry.modelProvider : undefined;
    const model = typeof entry.model === "string" ? entry.model : undefined;
    return { provider, model };
  };

  // Fast path: sessions.patch already validated the model catalog and returns the updated entry.
  // Use it for HARD FAIL verification when it contains provider/model.
  const patched = resolveActualFromEntry(opts.patchedEntry);
  // Only use patchedEntry for verification when it contains *both* provider+model. This preserves
  // the older semantics where we asserted the gateway resolved a provider (needed when the caller
  // passes a bare model name).
  if (patched.provider && patched.model) {
    const actualProvider = patched.provider;
    const actualModel = patched.model;

    if (expectedProvider) {
      if (actualProvider !== expectedProvider || actualModel !== expectedModel) {
        throw new Error(
          (
            "model override verification failed: expected " +
            expectedProvider +
            "/" +
            expectedModel +
            " but read back " +
            (actualProvider ?? "") +
            "/" +
            (actualModel ?? "")
          ).trim(),
        );
      }
      return;
    }

    if (actualModel !== expectedModel) {
      throw new Error(
        (
          "model override verification failed: expected model " +
          expectedModel +
          " but read back " +
          (actualModel ?? "")
        ).trim(),
      );
    }
    return;
  }

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const findRow = async (params: Record<string, unknown>) => {
    const list = (await callGateway({
      method: "sessions.list",
      params,
      timeoutMs: 10_000,
    })) as {
      sessions?: Array<{ key?: string; modelProvider?: string; model?: string }>;
    };
    return Array.isArray(list?.sessions)
      ? list.sessions.find((s) => s?.key === opts.childSessionKey)
      : undefined;
  };

  // HARD FAIL semantics must be robust: sessions.patch is synchronous, but in practice we can
  // observe brief propagation delays depending on store target and concurrent writes.
  //
  // Important: DO NOT filter by spawnedBy here. spawnedBy may not be set until the subsequent
  // agent run is enqueued, and this verification happens immediately after sessions.patch.
  const maxAttempts = 6;
  let row: { key?: string; modelProvider?: string; model?: string } | undefined = undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    row = await findRow({
      // Limit is a safety valve; agentId should narrow sufficiently.
      limit: 512,
      agentId: opts.agentId,
      includeGlobal: true,
      includeUnknown: true,
    });
    if (row) break;
    // Exponential backoff: 25ms, 50ms, 100ms, 200ms, 400ms...
    await sleep(25 * Math.pow(2, attempt));
  }

  // Fallback: broaden the query if agentId filtering doesn't match for some reason.
  if (!row) {
    row = await findRow({
      limit: 2048,
      includeGlobal: true,
      includeUnknown: true,
      // If the store is huge, search narrows cheaply (pure string filter).
      search: opts.childSessionKey,
    });
  }

  if (!row) {
    throw new Error(
      "model override verification failed: session not found in sessions.list readback (key=" +
        opts.childSessionKey +
        ")",
    );
  }

  const actualProvider = typeof row.modelProvider === "string" ? row.modelProvider : undefined;
  const actualModel = typeof row.model === "string" ? row.model : undefined;

  if (expectedProvider) {
    if (actualProvider !== expectedProvider || actualModel !== expectedModel) {
      throw new Error(
        (
          "model override verification failed: expected " +
          expectedProvider +
          "/" +
          expectedModel +
          " but read back " +
          (actualProvider ?? "") +
          "/" +
          (actualModel ?? "")
        ).trim(),
      );
    }
    return;
  }

  // If the caller didn't specify provider, we can still assert the model matches and the
  // gateway resolved *some* provider.
  if (actualModel !== expectedModel) {
    throw new Error(
      (
        "model override verification failed: expected model " +
        expectedModel +
        " but read back " +
        (actualModel ?? "")
      ).trim(),
    );
  }
  if (!actualProvider) {
    throw new Error("model override verification failed: missing modelProvider in readback");
  }
}

export function createSessionsSpawnTool(opts?: {
  agentSessionKey?: string;
  agentChannel?: GatewayMessageChannel;
  agentAccountId?: string;
  agentTo?: string;
  agentThreadId?: string | number;
  agentGroupId?: string | null;
  agentGroupChannel?: string | null;
  agentGroupSpace?: string | null;
  sandboxed?: boolean;
  /** Explicit agent ID override for cron/hook sessions where session key parsing may not work. */
  requesterAgentIdOverride?: string;
}): AnyAgentTool {
  return {
    label: "Sessions",
    name: "sessions_spawn",
    description:
      "Spawn a background sub-agent run in an isolated session and announce the result back to the requester chat.",
    parameters: SessionsSpawnToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const task = readStringParam(params, "task", { required: true });
      const label = typeof params.label === "string" ? params.label.trim() : "";
      const requestedAgentId = readStringParam(params, "agentId");
      const modelOverride = readStringParam(params, "model");
      const thinkingOverrideRaw = readStringParam(params, "thinking");
      const cleanup =
        params.cleanup === "keep" || params.cleanup === "delete"
          ? (params.cleanup as "keep" | "delete")
          : "keep";
      const requesterOrigin = normalizeDeliveryContext({
        channel: opts?.agentChannel,
        accountId: opts?.agentAccountId,
        to: opts?.agentTo,
        threadId: opts?.agentThreadId,
      });
      const runTimeoutSeconds = (() => {
        const explicit =
          typeof params.runTimeoutSeconds === "number" && Number.isFinite(params.runTimeoutSeconds)
            ? Math.max(0, Math.floor(params.runTimeoutSeconds))
            : undefined;
        if (explicit !== undefined) return explicit;
        const legacy =
          typeof params.timeoutSeconds === "number" && Number.isFinite(params.timeoutSeconds)
            ? Math.max(0, Math.floor(params.timeoutSeconds))
            : undefined;
        return legacy ?? 0;
      })();
      let modelApplied = false;
      let modelVerified = false;

      const cfg = loadConfig();
      const { mainKey, alias } = resolveMainSessionAlias(cfg);
      const requesterSessionKey = opts?.agentSessionKey;
      if (typeof requesterSessionKey === "string" && isSubagentSessionKey(requesterSessionKey)) {
        return jsonResult({
          status: "forbidden",
          error: "sessions_spawn is not allowed from sub-agent sessions",
        });
      }
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
        opts?.requesterAgentIdOverride ?? parseAgentSessionKey(requesterInternalKey)?.agentId,
      );
      const targetAgentId = requestedAgentId
        ? normalizeAgentId(requestedAgentId)
        : requesterAgentId;
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
          return jsonResult({
            status: "forbidden",
            error: `agentId is not allowed for sessions_spawn (allowed: ${allowedText})`,
          });
        }
      }
      const childSessionKey = `agent:${targetAgentId}:subagent:${crypto.randomUUID()}`;
      const spawnedByKey = requesterInternalKey;
      const targetAgentConfig = resolveAgentConfig(cfg, targetAgentId);
      const resolvedModel =
        normalizeModelSelection(modelOverride) ??
        normalizeModelSelection(targetAgentConfig?.subagents?.model) ??
        normalizeModelSelection(cfg.agents?.defaults?.subagents?.model);
      let thinkingOverride: string | undefined;
      if (thinkingOverrideRaw) {
        const normalized = normalizeThinkLevel(thinkingOverrideRaw);
        if (!normalized) {
          const { provider, model } = splitModelRef(resolvedModel);
          const hint = formatThinkingLevels(provider, model);
          return jsonResult({
            status: "error",
            error: `Invalid thinking level "${thinkingOverrideRaw}". Use one of: ${hint}.`,
          });
        }
        thinkingOverride = normalized;
      }
      if (resolvedModel) {
        try {
          const patchResult = (await callGateway({
            method: "sessions.patch",
            params: { key: childSessionKey, model: resolvedModel },
            timeoutMs: 10_000,
          })) as { entry?: unknown };
          modelApplied = true;

          // HARD FAIL semantics: assert provider/model match (prefer sessions.patch result; fallback to sessions.list).
          await verifySessionModelApplied({
            childSessionKey,
            spawnedBy: spawnedByKey,
            agentId: targetAgentId,
            expectedModelRef: resolvedModel,
            patchedEntry:
              patchResult && typeof patchResult === "object" && patchResult
                ? ((patchResult as { entry?: unknown }).entry as any)
                : undefined,
          });
          modelVerified = true;

          await emitSessionsSpawnModelOverrideEvent(
            `sessions_spawn: model override applied and verified (${childSessionKey} -> ${resolvedModel})`,
          );
        } catch (err) {
          const messageText =
            err instanceof Error ? err.message : typeof err === "string" ? err : "error";

          await emitSessionsSpawnModelOverrideEvent(
            `sessions_spawn: FAILED to apply/verify model override (${childSessionKey} -> ${resolvedModel}): ${messageText}`,
          );

          return jsonResult({
            status: "error",
            error: messageText,
            childSessionKey,
          });
        }
      }
      const childSystemPrompt = buildSubagentSystemPrompt({
        requesterSessionKey,
        requesterOrigin,
        childSessionKey,
        label: label || undefined,
        task,
      });

      const childIdem = crypto.randomUUID();
      let childRunId: string = childIdem;
      try {
        const response = (await callGateway({
          method: "agent",
          params: {
            message: task,
            sessionKey: childSessionKey,
            channel: requesterOrigin?.channel,
            idempotencyKey: childIdem,
            deliver: false,
            lane: AGENT_LANE_SUBAGENT,
            extraSystemPrompt: childSystemPrompt,
            thinking: thinkingOverride,
            timeout: runTimeoutSeconds > 0 ? runTimeoutSeconds : undefined,
            label: label || undefined,
            spawnedBy: spawnedByKey,
            groupId: opts?.agentGroupId ?? undefined,
            groupChannel: opts?.agentGroupChannel ?? undefined,
            groupSpace: opts?.agentGroupSpace ?? undefined,
          },
          timeoutMs: 10_000,
        })) as { runId?: string };
        if (typeof response?.runId === "string" && response.runId) {
          childRunId = response.runId;
        }
      } catch (err) {
        const messageText =
          err instanceof Error ? err.message : typeof err === "string" ? err : "error";
        return jsonResult({
          status: "error",
          error: messageText,
          childSessionKey,
          runId: childRunId,
        });
      }

      registerSubagentRun({
        runId: childRunId,
        childSessionKey,
        requesterSessionKey: requesterInternalKey,
        requesterOrigin,
        requesterDisplayKey,
        task,
        cleanup,
        label: label || undefined,
        runTimeoutSeconds,
      });

      return jsonResult({
        status: "accepted",
        childSessionKey,
        runId: childRunId,
        modelApplied: resolvedModel ? modelApplied : undefined,
        modelVerified: resolvedModel ? modelVerified : undefined,
      });
    },
  };
}
