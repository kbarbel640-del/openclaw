import type { AnyAgentTool, OpenClawConfig } from "openclaw/plugin-sdk";
import { Type } from "@sinclair/typebox";
import {
  jsonResult,
  optionalStringEnum,
  readNumberParam,
  readStringParam,
} from "openclaw/plugin-sdk";
import type { MeridiaExperienceRecordV2 } from "../meridia/types.js";
import { openMeridiaDb, getMeridiaDbStats } from "../meridia/db/sqlite.js";
import { getRecordsByDateRange, getRecordsBySession, getRecentRecords } from "../meridia/query.js";

const ExperienceReflectSchema = Type.Object({
  scope: optionalStringEnum(["recent", "session", "date_range"], {
    description:
      "Scope of experiences to reflect on. " +
      "'recent' — last N records (default). " +
      "'session' — all records from a specific session. " +
      "'date_range' — records within a date range.",
  }),
  session_key: Type.Optional(
    Type.String({
      description: "Session key to reflect on (when scope='session').",
    }),
  ),
  from: Type.Optional(
    Type.String({
      description: "Start date for date range scope. ISO string, e.g. '2025-02-01'.",
    }),
  ),
  to: Type.Optional(
    Type.String({
      description: "End date for date range scope. ISO string.",
    }),
  ),
  limit: Type.Optional(
    Type.Number({
      description: "Maximum number of records to include. Default: 30. Max: 100.",
    }),
  ),
  focus: Type.Optional(
    Type.String({
      description:
        "Optional focus area for the reflection. Example: 'errors', 'relationships', 'tool usage patterns'.",
    }),
  ),
});

function analyzeRecords(records: MeridiaExperienceRecordV2[]) {
  if (records.length === 0) {
    return {
      recordCount: 0,
      timeRange: null as { earliest: string; latest: string } | null,
      toolDistribution: {} as Record<string, number>,
      scoreDistribution: { high: 0, medium: 0, low: 0 },
      errorRate: 0,
      sessions: [] as string[],
      topRecords: [] as Array<{
        id: string;
        timestamp: string;
        kind: string;
        tool: string | null;
        score: number;
        reason: string | undefined;
        isError: boolean;
      }>,
      reflectionPrompts: [
        "No experiential records found for this scope. Consider what might be worth capturing.",
      ],
    };
  }

  const sorted = [...records].sort((a, b) => a.ts.localeCompare(b.ts));
  const earliest = sorted[0]?.ts ?? null;
  const latest = sorted[sorted.length - 1]?.ts ?? null;

  const toolDist: Record<string, number> = {};
  let high = 0;
  let medium = 0;
  let low = 0;
  let errorCount = 0;
  const sessions = new Set<string>();

  for (const r of records) {
    const tool = r.tool?.name ?? "(none)";
    toolDist[tool] = (toolDist[tool] ?? 0) + 1;

    const score = r.capture.score;
    if (score >= 0.8) {
      high++;
    } else if (score >= 0.6) {
      medium++;
    } else {
      low++;
    }

    if (r.tool?.isError) {
      errorCount++;
    }
    if (r.session?.key) {
      sessions.add(r.session.key);
    }
  }

  const topRecords = [...records]
    .sort((a, b) => b.capture.score - a.capture.score || b.ts.localeCompare(a.ts))
    .slice(0, 8)
    .map((r) => ({
      id: r.id,
      timestamp: r.ts,
      kind: r.kind,
      tool: r.tool?.name ?? null,
      score: r.capture.score,
      reason: r.capture.evaluation.reason,
      isError: r.tool?.isError ?? false,
    }));

  const reflectionPrompts: string[] = [];
  reflectionPrompts.push("What patterns do you notice across the top experiences?");
  if (errorCount > 0) {
    reflectionPrompts.push("Which errors were most meaningful, and what changed afterward?");
  }
  reflectionPrompts.push("What should you do differently next time based on these experiences?");
  reflectionPrompts.push("What anchors or phrases would best reconstitute the underlying state?");

  return {
    recordCount: records.length,
    timeRange: earliest && latest ? { earliest, latest } : null,
    toolDistribution: toolDist,
    scoreDistribution: { high, medium, low },
    errorRate: records.length > 0 ? errorCount / records.length : 0,
    sessions: Array.from(sessions),
    topRecords,
    reflectionPrompts,
  };
}

export function createExperienceReflectTool(opts?: {
  config?: OpenClawConfig;
  agentSessionKey?: string;
}): AnyAgentTool {
  return {
    label: "ExperienceReflect",
    name: "experience_reflect",
    description:
      "Reflect on recent experiential records from Meridia. Use this to synthesize patterns, insights, and reconstitution anchors.",
    parameters: ExperienceReflectSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const scope = readStringParam(params, "scope") ?? "recent";
      const sessionKey = readStringParam(params, "session_key") ?? opts?.agentSessionKey;
      const from = readStringParam(params, "from");
      const to = readStringParam(params, "to");
      const rawLimit = readNumberParam(params, "limit", { integer: true });
      const limit = Math.min(Math.max(rawLimit ?? 30, 1), 100);
      const focus = readStringParam(params, "focus");

      try {
        const db = openMeridiaDb({ cfg: opts?.config });

        let records: MeridiaExperienceRecordV2[] = [];
        if (scope === "session") {
          if (!sessionKey) {
            return jsonResult({ error: "session_key is required when scope='session'." });
          }
          records = getRecordsBySession(db, sessionKey, Math.max(limit, 50)).map((r) => r.record);
        } else if (scope === "date_range") {
          if (!from) {
            return jsonResult({ error: "from is required when scope='date_range'." });
          }
          records = getRecordsByDateRange(db, from, to ?? new Date().toISOString(), {
            limit: Math.max(limit, 50),
          }).map((r) => r.record);
        } else {
          records = getRecentRecords(db, Math.max(limit, 50)).map((r) => r.record);
        }

        if (focus) {
          const focusLower = focus.toLowerCase();
          records = records.filter((r) => {
            const haystack = [
              r.tool?.name ?? "",
              r.capture.evaluation.reason ?? "",
              r.content?.topic ?? "",
              r.content?.summary ?? "",
              r.content?.context ?? "",
              ...(r.content?.tags ?? []),
            ]
              .join(" ")
              .toLowerCase();
            return haystack.includes(focusLower);
          });
        }

        const analysis = analyzeRecords(records.slice(0, limit));
        const stats = getMeridiaDbStats(db);

        return jsonResult({
          scope,
          focus: focus ?? null,
          recordCount: analysis.recordCount,
          totalRecords: stats.recordCount,
          timeRange: analysis.timeRange,
          toolDistribution: analysis.toolDistribution,
          scoreDistribution: analysis.scoreDistribution,
          errorRate: analysis.errorRate,
          sessions: analysis.sessions,
          topRecords: analysis.topRecords,
          reflectionPrompts: analysis.reflectionPrompts,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return jsonResult({
          error: `Experience reflect failed: ${message}`,
        });
      }
    },
  };
}
