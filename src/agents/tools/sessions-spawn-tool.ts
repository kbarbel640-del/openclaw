import crypto from "node:crypto";
import os from "node:os";

import { Type } from "@sinclair/typebox";

import type { ClawdbotConfig } from "../../config/config.js";
import { loadConfig } from "../../config/config.js";
import { callGateway } from "../../gateway/call.js";
import { loadSessionEntry } from "../../gateway/session-utils.js";
import {
  isSubagentSessionKey,
  normalizeAgentId,
  parseAgentSessionKey,
} from "../../routing/session-key.js";
import type { GatewayMessageChannel } from "../../utils/message-channel.js";
import { resolveAgentConfig } from "../agent-scope.js";
import { AGENT_LANE_SUBAGENT } from "../lanes.js";
import { buildBootstrapContextFiles } from "../pi-embedded-helpers/bootstrap.js";
import type { EmbeddedContextFile } from "../pi-embedded-helpers.js";
import { optionalStringEnum } from "../schema/typebox.js";
import { buildSubagentSystemPrompt } from "../subagent-announce.js";
import { registerSubagentRun } from "../subagent-registry.js";
import {
  DEFAULT_AGENT_WORKSPACE_DIR,
  loadWorkspaceBootstrapFiles,
} from "../workspace.js";
import type { AnyAgentTool } from "./common.js";
import { jsonResult, readStringParam } from "./common.js";
import {
  resolveDisplaySessionKey,
  resolveInternalSessionKey,
  resolveMainSessionAlias,
} from "./sessions-helpers.js";

function resolveUserTimezone(configTimezone?: string): string {
  if (configTimezone?.trim()) return configTimezone.trim();
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

function resolveUserTime(timezone: string): string {
  try {
    return new Date().toLocaleString("en-US", { timeZone: timezone });
  } catch {
    return new Date().toISOString();
  }
}

function resolveBootstrapMaxChars(config?: ClawdbotConfig): number {
  const value = config?.agents?.defaults?.bootstrapMaxChars;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  return 50_000; // Default
}

function buildModelAliasLines(config?: ClawdbotConfig): string[] {
  const models = config?.agents?.defaults?.models ?? {};
  const entries: Array<{ alias: string; model: string }> = [];
  for (const [keyRaw, entryRaw] of Object.entries(models)) {
    const model = String(keyRaw ?? "").trim();
    if (!model) continue;
    const alias = String(
      (entryRaw as { alias?: string } | undefined)?.alias ?? "",
    ).trim();
    if (!alias) continue;
    entries.push({ alias, model });
  }
  return entries
    .sort((a, b) => a.alias.localeCompare(b.alias))
    .map((entry) => `- ${entry.alias}: ${entry.model}`);
}

const SessionsSpawnToolSchema = Type.Object({
  task: Type.String(),
  label: Type.Optional(Type.String()),
  agentId: Type.Optional(Type.String()),
  model: Type.Optional(Type.String()),
  runTimeoutSeconds: Type.Optional(Type.Number({ minimum: 0 })),
  // Back-compat alias. Prefer runTimeoutSeconds.
  timeoutSeconds: Type.Optional(Type.Number({ minimum: 0 })),
  cleanup: optionalStringEnum(["delete", "keep"] as const),
});

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

export function createSessionsSpawnTool(opts?: {
  agentSessionKey?: string;
  agentChannel?: GatewayMessageChannel;
  sandboxed?: boolean;
  /** Tool names available to subagents (for system prompt documentation) */
  toolNames?: string[];
  /** Tool summaries for custom tools */
  toolSummaries?: Record<string, string>;
  /** Config reference for context building */
  config?: ClawdbotConfig;
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
      const cleanup =
        params.cleanup === "keep" || params.cleanup === "delete"
          ? (params.cleanup as "keep" | "delete")
          : "keep";
      const runTimeoutSeconds = (() => {
        const explicit =
          typeof params.runTimeoutSeconds === "number" &&
          Number.isFinite(params.runTimeoutSeconds)
            ? Math.max(0, Math.floor(params.runTimeoutSeconds))
            : undefined;
        if (explicit !== undefined) return explicit;
        const legacy =
          typeof params.timeoutSeconds === "number" &&
          Number.isFinite(params.timeoutSeconds)
            ? Math.max(0, Math.floor(params.timeoutSeconds))
            : undefined;
        return legacy ?? 0;
      })();
      let modelWarning: string | undefined;
      let modelApplied = false;

      const cfg = loadConfig();
      const { mainKey, alias } = resolveMainSessionAlias(cfg);
      const requesterSessionKey = opts?.agentSessionKey;
      if (
        typeof requesterSessionKey === "string" &&
        isSubagentSessionKey(requesterSessionKey)
      ) {
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
      // Get lastTo from the parent session for announce routing
      const parentEntry = loadSessionEntry(requesterInternalKey).entry;
      const requesterTo = parentEntry?.lastTo;

      const requesterAgentId = normalizeAgentId(
        parseAgentSessionKey(requesterInternalKey)?.agentId,
      );
      const targetAgentId = requestedAgentId
        ? normalizeAgentId(requestedAgentId)
        : requesterAgentId;
      if (targetAgentId !== requesterAgentId) {
        const allowAgents =
          resolveAgentConfig(cfg, requesterAgentId)?.subagents?.allowAgents ??
          [];
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
      const shouldPatchSpawnedBy = opts?.sandboxed === true;
      const targetAgentConfig = resolveAgentConfig(cfg, targetAgentId);
      const resolvedModel =
        normalizeModelSelection(modelOverride) ??
        normalizeModelSelection(targetAgentConfig?.subagents?.model) ??
        normalizeModelSelection(cfg.agents?.defaults?.subagents?.model);
      if (resolvedModel) {
        try {
          await callGateway({
            method: "sessions.patch",
            params: { key: childSessionKey, model: resolvedModel },
            timeoutMs: 10_000,
          });
          modelApplied = true;
        } catch (err) {
          const messageText =
            err instanceof Error
              ? err.message
              : typeof err === "string"
                ? err
                : "error";
          const recoverable =
            messageText.includes("invalid model") ||
            messageText.includes("model not allowed");
          if (!recoverable) {
            return jsonResult({
              status: "error",
              error: messageText,
              childSessionKey,
            });
          }
          modelWarning = messageText;
        }
      }
      // Load workspace context files for subagent (all files, not filtered)
      const bootstrapFiles = await loadWorkspaceBootstrapFiles(
        DEFAULT_AGENT_WORKSPACE_DIR,
      );
      const contextFiles: EmbeddedContextFile[] = buildBootstrapContextFiles(
        bootstrapFiles,
        { maxChars: resolveBootstrapMaxChars(cfg) },
      );

      // Build runtime info
      const userTimezone = resolveUserTimezone(
        cfg.agents?.defaults?.userTimezone,
      );
      const userTime = resolveUserTime(userTimezone);
      const modelAliasLines = buildModelAliasLines(cfg);

      const runtimeInfo = {
        host: os.hostname(),
        os: os.platform(),
        arch: os.arch(),
        node: process.version,
        model: resolvedModel,
        channel: opts?.agentChannel,
      };

      const childSystemPrompt = buildSubagentSystemPrompt({
        requesterSessionKey,
        requesterChannel: opts?.agentChannel,
        childSessionKey,
        label: label || undefined,
        task,
        workspaceDir: DEFAULT_AGENT_WORKSPACE_DIR,
        // Extended context (like main agent)
        toolNames: opts?.toolNames,
        toolSummaries: opts?.toolSummaries,
        contextFiles,
        modelAliasLines,
        userTimezone,
        userTime,
        runtimeInfo,
      });

      const childIdem = crypto.randomUUID();
      let childRunId: string = childIdem;
      try {
        const response = (await callGateway({
          method: "agent",
          params: {
            message: task,
            sessionKey: childSessionKey,
            channel: opts?.agentChannel,
            idempotencyKey: childIdem,
            deliver: false,
            lane: AGENT_LANE_SUBAGENT,
            extraSystemPrompt: childSystemPrompt,
            timeout: runTimeoutSeconds > 0 ? runTimeoutSeconds : undefined,
            label: label || undefined,
            spawnedBy: shouldPatchSpawnedBy ? requesterInternalKey : undefined,
          },
          timeoutMs: 10_000,
        })) as { runId?: string };
        if (typeof response?.runId === "string" && response.runId) {
          childRunId = response.runId;
        }
      } catch (err) {
        const messageText =
          err instanceof Error
            ? err.message
            : typeof err === "string"
              ? err
              : "error";
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
        requesterChannel: opts?.agentChannel,
        requesterTo,
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
        warning: modelWarning,
      });
    },
  };
}
