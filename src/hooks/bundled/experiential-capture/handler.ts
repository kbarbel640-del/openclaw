import crypto from "node:crypto";
import path from "node:path";
import type { OpenClawConfig } from "../../../config/config.js";
import type { HookConfig } from "../../../config/types.js";
import type {
  MeridiaBuffer,
  MeridiaExperienceRecord,
  MeridiaToolResultContext,
  MeridiaTraceEvent,
} from "../../../meridia/types.js";
import type { HookHandler } from "../../hooks.js";
import { evaluateHeuristic, evaluateWithLlm } from "../../../meridia/evaluate.js";
import {
  appendExperientialRecord,
  appendTraceEvent,
  dateKeyUtc,
  readJsonIfExists,
  resolveMeridiaDir,
  writeJson,
} from "../../../meridia/storage.js";
import { resolveHookConfig } from "../../config.js";

type LimitedInfo = { reason: "min_interval" | "max_per_hour"; detail?: string };

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as Record<string, unknown>;
}

function readNumber(cfg: HookConfig | undefined, keys: string[], fallback: number): number {
  for (const key of keys) {
    const value = cfg?.[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  for (const key of keys) {
    const value = cfg?.[key];
    if (typeof value === "string") {
      const parsed = Number(value.trim());
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return fallback;
}

function readString(cfg: HookConfig | undefined, keys: string[]): string | undefined {
  for (const key of keys) {
    const raw = cfg?.[key];
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }
  return undefined;
}

function safeFileKey(raw: string): string {
  return raw.trim().replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function nowIso(): string {
  return new Date().toISOString();
}

function ensureBuffer(seed: Partial<MeridiaBuffer>): MeridiaBuffer {
  const now = nowIso();
  return {
    version: 1,
    sessionId: seed.sessionId,
    sessionKey: seed.sessionKey,
    createdAt: seed.createdAt ?? now,
    updatedAt: now,
    toolResultsSeen: seed.toolResultsSeen ?? 0,
    captured: seed.captured ?? 0,
    lastSeenAt: seed.lastSeenAt,
    lastCapturedAt: seed.lastCapturedAt,
    recentCaptures: seed.recentCaptures ?? [],
    recentEvaluations: seed.recentEvaluations ?? [],
    lastError: seed.lastError,
  };
}

function pruneOld(buffer: MeridiaBuffer, nowMs: number): MeridiaBuffer {
  const hourAgo = nowMs - 60 * 60 * 1000;
  const recentCaptures = buffer.recentCaptures.filter((c) => Date.parse(c.ts) >= hourAgo);
  const recentEvaluations = buffer.recentEvaluations.slice(-50);
  return {
    ...buffer,
    recentCaptures,
    recentEvaluations,
  };
}

// ─── Shared helpers ─────────────────────────────────────────────────

function resolveSessionContext(
  event: Parameters<HookHandler>[0],
  context: Record<string, unknown>,
) {
  const sessionId = typeof context.sessionId === "string" ? context.sessionId : undefined;
  const sessionKey = typeof context.sessionKey === "string" ? context.sessionKey : event.sessionKey;
  const runId = typeof context.runId === "string" ? context.runId : undefined;
  return { sessionId, sessionKey, runId };
}

function resolveBufferPath(
  meridiaDir: string,
  sessionId?: string,
  sessionKey?: string,
  eventSessionKey?: string,
) {
  const bufferKey = safeFileKey(sessionId ?? sessionKey ?? eventSessionKey ?? "unknown");
  return path.join(meridiaDir, "buffers", `${bufferKey}.json`);
}

async function loadBuffer(
  bufferPath: string,
  sessionId?: string,
  sessionKey?: string,
): Promise<MeridiaBuffer> {
  const existing = await readJsonIfExists<MeridiaBuffer>(bufferPath);
  return ensureBuffer(existing ?? { sessionId, sessionKey });
}

// ─── Tool Result handler (original) ─────────────────────────────────

async function handleToolResult(
  event: Parameters<HookHandler>[0],
  context: Record<string, unknown>,
  cfg: OpenClawConfig | undefined,
  hookCfg: HookConfig | undefined,
): Promise<void> {
  const toolName = typeof context.toolName === "string" ? context.toolName : "";
  const toolCallId = typeof context.toolCallId === "string" ? context.toolCallId : "";
  if (!toolName || !toolCallId) {
    return;
  }

  const { sessionId, sessionKey, runId } = resolveSessionContext(event, context);
  const meta = typeof context.meta === "string" ? context.meta : undefined;
  const isError = Boolean(context.isError);
  const args = context.args;
  const result = context.result;

  const meridiaDir = resolveMeridiaDir(cfg, "experiential-capture");
  const dateKey = dateKeyUtc(event.timestamp);
  const tracePath = path.join(meridiaDir, "trace", `${dateKey}.jsonl`);
  const recordPath = path.join(meridiaDir, "records", "experiential", `${dateKey}.jsonl`);
  const bufferPath = resolveBufferPath(meridiaDir, sessionId, sessionKey, event.sessionKey);
  const now = nowIso();
  const nowMs = Date.now();

  const minThreshold = readNumber(
    hookCfg,
    ["min_significance_threshold", "minSignificanceThreshold", "threshold"],
    0.6,
  );
  const maxPerHour = readNumber(hookCfg, ["max_captures_per_hour", "maxCapturesPerHour"], 10);
  const minIntervalMs = readNumber(hookCfg, ["min_interval_ms", "minIntervalMs"], 5 * 60 * 1000);
  const evaluationTimeoutMs = readNumber(
    hookCfg,
    ["evaluation_timeout_ms", "evaluationTimeoutMs"],
    3500,
  );
  const evaluationModel =
    readString(hookCfg, ["evaluation_model", "evaluationModel", "model"]) ?? "";

  const ctx: MeridiaToolResultContext = {
    cfg,
    runId,
    sessionId,
    sessionKey,
    toolName,
    toolCallId,
    meta,
    isError,
    args,
    result,
  };

  let buffer = await loadBuffer(bufferPath, sessionId, sessionKey);
  buffer = pruneOld(buffer, nowMs);
  buffer.toolResultsSeen += 1;
  buffer.lastSeenAt = now;
  buffer.updatedAt = now;

  const limited: LimitedInfo | undefined = (() => {
    if (buffer.lastCapturedAt) {
      const last = Date.parse(buffer.lastCapturedAt);
      if (Number.isFinite(last) && nowMs - last < minIntervalMs) {
        return { reason: "min_interval" };
      }
    }
    if (buffer.recentCaptures.length >= maxPerHour) {
      return { reason: "max_per_hour", detail: `${buffer.recentCaptures.length}/${maxPerHour}` };
    }
    return undefined;
  })();

  let evaluation = evaluateHeuristic(ctx);
  try {
    if (cfg && evaluationModel) {
      evaluation = await evaluateWithLlm({
        cfg,
        ctx,
        modelRef: evaluationModel,
        timeoutMs: evaluationTimeoutMs,
      });
    }
  } catch (err) {
    buffer.lastError = {
      ts: now,
      toolName,
      message: err instanceof Error ? err.message : String(err),
    };
    const traceEvent: MeridiaTraceEvent = {
      type: "tool_result",
      ts: now,
      sessionId,
      sessionKey,
      runId,
      toolName,
      toolCallId,
      meta,
      isError,
      decision: "error",
      error: buffer.lastError.message,
      threshold: minThreshold,
    };
    await appendTraceEvent(tracePath, traceEvent, cfg);
    await writeJson(bufferPath, buffer);
    return;
  }

  const shouldCapture =
    !limited && evaluation.score >= minThreshold && evaluation.recommendation === "capture";

  buffer.recentEvaluations.push({
    ts: now,
    toolName,
    score: evaluation.score,
    recommendation: evaluation.recommendation,
    reason: evaluation.reason,
  });
  if (buffer.recentEvaluations.length > 50) {
    buffer.recentEvaluations.splice(0, buffer.recentEvaluations.length - 50);
  }

  let recordId: string | undefined;
  if (shouldCapture) {
    recordId = crypto.randomUUID();
    const record: MeridiaExperienceRecord = {
      id: recordId,
      ts: now,
      kind: "tool_result",
      sessionKey,
      sessionId,
      runId,
      tool: { name: toolName, callId: toolCallId, meta, isError },
      data: { args, result },
      evaluation,
    };
    await appendExperientialRecord(recordPath, record, cfg);
    buffer.captured += 1;
    buffer.lastCapturedAt = now;
    buffer.recentCaptures.push({
      ts: now,
      toolName,
      score: evaluation.score,
      recordId,
    });
    buffer = pruneOld(buffer, nowMs);
  }

  const traceEvent: MeridiaTraceEvent = {
    type: "tool_result",
    ts: now,
    sessionId,
    sessionKey,
    runId,
    toolName,
    toolCallId,
    meta,
    isError,
    decision: shouldCapture ? "capture" : "skip",
    error: undefined,
    score: evaluation.score,
    threshold: minThreshold,
    limited,
    eval: {
      kind: evaluation.kind,
      model: evaluation.model,
      score: evaluation.score,
      reason: evaluation.reason,
      durationMs: evaluation.durationMs,
    },
    recordId,
  };
  await appendTraceEvent(tracePath, traceEvent, cfg);
  await writeJson(bufferPath, buffer);
}

// ─── PreCompact handler ─────────────────────────────────────────────
// CRITICAL priority — always capture, bypass rate limiting.
// This is the last chance to save experiential state before context loss.

async function handlePreCompact(
  event: Parameters<HookHandler>[0],
  context: Record<string, unknown>,
  cfg: OpenClawConfig | undefined,
): Promise<void> {
  const { sessionId, sessionKey, runId } = resolveSessionContext(event, context);

  const meridiaDir = resolveMeridiaDir(cfg, "experiential-capture");
  const dateKey = dateKeyUtc(event.timestamp);
  const tracePath = path.join(meridiaDir, "trace", `${dateKey}.jsonl`);
  const recordPath = path.join(meridiaDir, "records", "experiential", `${dateKey}.jsonl`);
  const bufferPath = resolveBufferPath(meridiaDir, sessionId, sessionKey, event.sessionKey);
  const now = nowIso();
  const nowMs = Date.now();

  // Load current buffer to include state in the checkpoint
  let buffer = await loadBuffer(bufferPath, sessionId, sessionKey);
  buffer = pruneOld(buffer, nowMs);

  const assistantTextCount =
    typeof context.assistantTextCount === "number" ? context.assistantTextCount : undefined;
  const toolMetaCount =
    typeof context.toolMetaCount === "number" ? context.toolMetaCount : undefined;
  const assistantTextsTail = context.assistantTextsTail;
  const toolMetasTail = context.toolMetasTail;

  // Always capture — PreCompact is CRITICAL, no significance evaluation needed
  const recordId = crypto.randomUUID();
  const record: MeridiaExperienceRecord = {
    id: recordId,
    ts: now,
    kind: "precompact",
    sessionKey,
    sessionId,
    runId,
    tool: { name: "precompact", callId: `precompact-${recordId}`, isError: false },
    data: {
      args: {
        trigger: "precompact",
        assistantTextCount,
        toolMetaCount,
      },
      result: {
        assistantTextsTail,
        toolMetasTail,
        bufferSnapshot: {
          toolResultsSeen: buffer.toolResultsSeen,
          captured: buffer.captured,
          recentCaptureCount: buffer.recentCaptures.length,
          recentCaptures: buffer.recentCaptures.slice(-5),
        },
      },
    },
    evaluation: {
      kind: "heuristic",
      score: 1.0,
      recommendation: "capture",
      reason: "precompact_checkpoint_always_capture",
    },
  };
  await appendExperientialRecord(recordPath, record, cfg);

  // Update buffer
  buffer.captured += 1;
  buffer.lastCapturedAt = now;
  buffer.updatedAt = now;
  buffer.recentCaptures.push({
    ts: now,
    toolName: "precompact",
    score: 1.0,
    recordId,
  });
  buffer = pruneOld(buffer, nowMs);
  await writeJson(bufferPath, buffer);

  // Trace event
  const traceEvent: MeridiaTraceEvent = {
    type: "experiential_precompact",
    ts: now,
    sessionId,
    sessionKey,
    runId,
    recordId,
    assistantTextCount,
    toolMetaCount,
    bufferSnapshot: {
      toolResultsSeen: buffer.toolResultsSeen,
      captured: buffer.captured,
      recentCaptureCount: buffer.recentCaptures.length,
    },
  };
  await appendTraceEvent(tracePath, traceEvent, cfg);
}

// ─── SessionEnd / command:new handler ───────────────────────────────
// HIGH priority — always capture, bypass rate limiting.
// Captures a session summary synthesis when the session ends or transitions.

function resolveSessionIdFromEntry(value: unknown): string | undefined {
  const obj = asObject(value);
  if (!obj) {
    return undefined;
  }
  const sessionId = obj.sessionId;
  return typeof sessionId === "string" && sessionId.trim() ? sessionId.trim() : undefined;
}

async function handleSessionEnd(
  event: Parameters<HookHandler>[0],
  context: Record<string, unknown>,
  cfg: OpenClawConfig | undefined,
): Promise<void> {
  const sessionKey = typeof context.sessionKey === "string" ? context.sessionKey : event.sessionKey;
  const sessionId =
    (typeof context.sessionId === "string" && context.sessionId.trim()
      ? context.sessionId.trim()
      : undefined) ??
    resolveSessionIdFromEntry(context.previousSessionEntry) ??
    resolveSessionIdFromEntry(context.sessionEntry);
  const runId = typeof context.runId === "string" ? context.runId : undefined;

  const meridiaDir = resolveMeridiaDir(cfg, "experiential-capture");
  const dateKey = dateKeyUtc(event.timestamp);
  const tracePath = path.join(meridiaDir, "trace", `${dateKey}.jsonl`);
  const recordPath = path.join(meridiaDir, "records", "experiential", `${dateKey}.jsonl`);
  const bufferPath = resolveBufferPath(meridiaDir, sessionId, sessionKey, event.sessionKey);
  const now = nowIso();
  const nowMs = Date.now();

  // Load buffer to capture accumulated session state
  let buffer = await loadBuffer(bufferPath, sessionId, sessionKey);
  buffer = pruneOld(buffer, nowMs);

  const action = event.action as "new" | "stop";
  const kind = action === "new" ? "session_transition" : "session_end";

  // Always capture — session boundaries are HIGH priority, no evaluation needed
  const recordId = crypto.randomUUID();
  const record: MeridiaExperienceRecord = {
    id: recordId,
    ts: now,
    kind,
    sessionKey,
    sessionId,
    runId,
    tool: {
      name: `command:${action}`,
      callId: `session-${action}-${recordId}`,
      isError: false,
    },
    data: {
      args: {
        action,
        trigger: kind,
      },
      result: {
        sessionSummary: {
          toolResultsSeen: buffer.toolResultsSeen,
          captured: buffer.captured,
          recentCaptureCount: buffer.recentCaptures.length,
          recentCaptures: buffer.recentCaptures.slice(-10),
          recentEvaluations: buffer.recentEvaluations.slice(-10),
          sessionCreatedAt: buffer.createdAt,
          lastSeenAt: buffer.lastSeenAt,
          lastCapturedAt: buffer.lastCapturedAt,
        },
      },
    },
    evaluation: {
      kind: "heuristic",
      score: 1.0,
      recommendation: "capture",
      reason: `${kind}_always_capture`,
    },
  };
  await appendExperientialRecord(recordPath, record, cfg);

  // Update buffer
  buffer.captured += 1;
  buffer.lastCapturedAt = now;
  buffer.updatedAt = now;
  buffer.recentCaptures.push({
    ts: now,
    toolName: `command:${action}`,
    score: 1.0,
    recordId,
  });
  buffer = pruneOld(buffer, nowMs);
  await writeJson(bufferPath, buffer);

  // Trace event — use appropriate type based on action
  const traceEvent: MeridiaTraceEvent =
    action === "new"
      ? {
          type: "experiential_session_transition",
          ts: now,
          sessionId,
          sessionKey,
          recordId,
        }
      : {
          type: "experiential_session_end",
          ts: now,
          action,
          sessionId,
          sessionKey,
          recordId,
          bufferSnapshot: {
            toolResultsSeen: buffer.toolResultsSeen,
            captured: buffer.captured,
            recentCaptureCount: buffer.recentCaptures.length,
          },
        };
  await appendTraceEvent(tracePath, traceEvent, cfg);
}

// ─── Main handler (dispatch) ────────────────────────────────────────

const experientialCapture: HookHandler = async (event) => {
  const context = asObject(event.context) ?? {};
  const cfg = (context.cfg as OpenClawConfig | undefined) ?? undefined;
  const hookCfg = resolveHookConfig(cfg, "experiential-capture");
  if (hookCfg?.enabled !== true) {
    return;
  }

  // Dispatch based on event type and action
  if (event.type === "agent" && event.action === "tool:result") {
    return handleToolResult(event, context, cfg, hookCfg);
  }

  if (event.type === "agent" && event.action === "precompact") {
    return handlePreCompact(event, context, cfg);
  }

  if (event.type === "command" && (event.action === "new" || event.action === "stop")) {
    return handleSessionEnd(event, context, cfg);
  }

  // Unknown event type — ignore silently
};

export default experientialCapture;
