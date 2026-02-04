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

function nowIso(): string {
  return new Date().toISOString();
}

const handler = async (event: HookEvent): Promise<void> => {
  if (event.type !== "agent") {
    return;
  }
  if (event.action !== "precompact" && event.action !== "compaction:end") {
    return;
  }

  const context = asObject(event.context) ?? {};
  const cfg = (context.cfg as OpenClawConfig | undefined) ?? undefined;
  const hookCfg = resolveHookConfig(cfg, "compaction");
  if (hookCfg?.enabled !== true) {
    return;
  }

  const sessionId = typeof context.sessionId === "string" ? context.sessionId : undefined;
  const sessionKey = typeof context.sessionKey === "string" ? context.sessionKey : event.sessionKey;
  const runId = typeof context.runId === "string" ? context.runId : undefined;

  const meridiaDir = resolveMeridiaDir(cfg, "compaction");
  const tracePath = resolveTraceJsonlPath({ meridiaDir, date: event.timestamp });
  const recordPath = resolveRecordsJsonlPath({ meridiaDir, date: event.timestamp });
  const ts = nowIso();

  if (event.action === "precompact") {
    const dateKey = dateKeyUtc(event.timestamp);
    const snapshotDir = path.join(meridiaDir, "snapshots", dateKey);
    const snapshotPath = path.join(
      snapshotDir,
      `${ts.replaceAll(":", "-")}-${sessionId ?? "unknown"}.json`,
    );
    const snapshot = {
      ts,
      sessionId,
      sessionKey,
      runId,
      assistantTextCount: context.assistantTextCount,
      assistantTextsTail: context.assistantTextsTail,
      toolMetaCount: context.toolMetaCount,
      toolMetasTail: context.toolMetasTail,
      lastToolError: context.lastToolError,
    };
    await writeJson(snapshotPath, snapshot);

    const recordId = crypto.randomUUID();
    const record: MeridiaExperienceRecordV2 = {
      v: 2,
      id: recordId,
      ts,
      kind: "precompact",
      session: { id: sessionId, key: sessionKey, runId },
      tool: { name: "precompact", callId: `precompact-${recordId.slice(0, 8)}`, isError: false },
      capture: {
        score: 1,
        evaluation: {
          kind: "heuristic",
          score: 1,
          reason: "precompact_snapshot",
        },
      },
      content: {
        summary: "Pre-compaction snapshot",
      },
      data: { snapshot },
    };

    try {
      const db = openMeridiaDb({ cfg, hookKey: "compaction" });
      insertExperienceRecord(db, record);
      insertTraceEvent(db, {
        v: 2,
        id: crypto.randomUUID(),
        ts,
        kind: "precompact_snapshot",
        session: { id: sessionId, key: sessionKey, runId },
        paths: { snapshotPath },
        decision: { decision: "capture", recordId },
      });
    } catch {
      // ignore
    }

    await appendJsonl(recordPath, record);

    const traceEvent: MeridiaTraceEventV2 = {
      v: 2,
      id: crypto.randomUUID(),
      ts,
      kind: "precompact_snapshot",
      session: { id: sessionId, key: sessionKey, runId },
      paths: { snapshotPath },
      decision: { decision: "capture", recordId },
    };
    await appendJsonl(tracePath, traceEvent);
    return;
  }

  const traceEvent: MeridiaTraceEventV2 = {
    v: 2,
    id: crypto.randomUUID(),
    ts,
    kind: "compaction_end",
    session: { id: sessionId, key: sessionKey, runId },
    decision: { decision: "skip" },
  };
  try {
    const db = openMeridiaDb({ cfg, hookKey: "compaction" });
    insertTraceEvent(db, traceEvent);
  } catch {
    // ignore
  }
  await appendJsonl(tracePath, traceEvent);
};

export default handler;
