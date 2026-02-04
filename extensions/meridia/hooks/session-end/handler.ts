import type { OpenClawConfig } from "openclaw/plugin-sdk";
import crypto from "node:crypto";
import path from "node:path";
import type { MeridiaExperienceRecordV2, MeridiaTraceEventV2 } from "../../src/meridia/types.js";
import {
  openMeridiaDb,
  insertExperienceRecord,
  insertTraceEvent,
} from "../../src/meridia/db/sqlite.js";
import { resolveMeridiaDir, dateKeyUtc } from "../../src/meridia/paths.js";
import {
  appendJsonl,
  readJsonIfExists,
  resolveRecordsJsonlPath,
  resolveTraceJsonlPath,
  writeJson,
} from "../../src/meridia/storage.js";

type HookEvent = {
  type: string;
  action: string;
  timestamp: Date;
  sessionKey?: string;
  context?: unknown;
};

type BufferV1 = {
  version: 1;
  sessionId?: string;
  sessionKey?: string;
  createdAt: string;
  updatedAt: string;
  toolResultsSeen: number;
  captured: number;
  lastSeenAt?: string;
  lastCapturedAt?: string;
  recentCaptures: Array<{ ts: string; toolName: string; score: number; recordId: string }>;
  recentEvaluations: Array<{
    ts: string;
    toolName: string;
    score: number;
    recommendation: "capture" | "skip";
    reason?: string;
  }>;
  lastError?: { ts: string; toolName: string; message: string };
};

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as Record<string, unknown>;
}

function resolveHookConfig(
  cfg: OpenClawConfig | undefined,
  hookKey: string,
): Record<string, unknown> | undefined {
  const entry = cfg?.hooks?.internal?.entries?.[hookKey] as Record<string, unknown> | undefined;
  return entry && typeof entry === "object" ? entry : undefined;
}

function safeFileKey(raw: string): string {
  return raw.trim().replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function nowIso(): string {
  return new Date().toISOString();
}

function resolveSessionIdFromEntry(value: unknown): string | undefined {
  const obj = asObject(value);
  if (!obj) {
    return undefined;
  }
  const sessionId = obj.sessionId;
  return typeof sessionId === "string" && sessionId.trim() ? sessionId.trim() : undefined;
}

const handler = async (event: HookEvent): Promise<void> => {
  if (event.type !== "command") {
    return;
  }
  if (event.action !== "new" && event.action !== "stop") {
    return;
  }

  const context = asObject(event.context) ?? {};
  const cfg = (context.cfg as OpenClawConfig | undefined) ?? undefined;
  const hookCfg = resolveHookConfig(cfg, "session-end");
  if (hookCfg?.enabled !== true) {
    return;
  }

  const sessionKey = typeof context.sessionKey === "string" ? context.sessionKey : event.sessionKey;
  const sessionId =
    (typeof context.sessionId === "string" && context.sessionId.trim()
      ? context.sessionId.trim()
      : undefined) ??
    resolveSessionIdFromEntry(context.previousSessionEntry) ??
    resolveSessionIdFromEntry(context.sessionEntry);
  const runId = typeof context.runId === "string" ? context.runId : undefined;

  const meridiaDir = resolveMeridiaDir(cfg, "session-end");
  const dateKey = dateKeyUtc(event.timestamp);
  const ts = nowIso();
  const tracePath = resolveTraceJsonlPath({ meridiaDir, date: event.timestamp });
  const recordPath = resolveRecordsJsonlPath({ meridiaDir, date: event.timestamp });

  const bufferKey = safeFileKey(sessionId ?? sessionKey ?? event.sessionKey ?? "unknown");
  const bufferPath = path.join(meridiaDir, "buffers", `${bufferKey}.json`);
  const buffer = await readJsonIfExists<BufferV1>(bufferPath);

  const summaryDir = path.join(meridiaDir, "sessions", dateKey);
  const summaryPath = path.join(
    summaryDir,
    `${ts.replaceAll(":", "-")}-${sessionId ?? "unknown"}.json`,
  );
  const summary = {
    ts,
    action: event.action,
    sessionId,
    sessionKey,
    buffer,
  };
  await writeJson(summaryPath, summary);

  const recordId = crypto.randomUUID();
  const record: MeridiaExperienceRecordV2 = {
    v: 2,
    id: recordId,
    ts,
    kind: "session_end",
    session: { id: sessionId, key: sessionKey, runId },
    tool: {
      name: `command:${event.action}`,
      callId: `session-${event.action}-${recordId.slice(0, 8)}`,
      isError: false,
    },
    capture: {
      score: 1,
      evaluation: {
        kind: "heuristic",
        score: 1,
        reason: "session_end_snapshot",
      },
    },
    content: {
      summary: `Session ${event.action} snapshot`,
    },
    data: { summary },
  };

  const traceEvent: MeridiaTraceEventV2 = {
    v: 2,
    id: crypto.randomUUID(),
    ts,
    kind: "session_end_snapshot",
    session: { id: sessionId, key: sessionKey, runId },
    paths: { summaryPath },
    decision: { decision: "capture", recordId },
  };

  try {
    const db = openMeridiaDb({ cfg, hookKey: "session-end" });
    insertExperienceRecord(db, record);
    insertTraceEvent(db, traceEvent);
  } catch {
    // ignore
  }

  await appendJsonl(recordPath, record);
  await appendJsonl(tracePath, traceEvent);
};

export default handler;
