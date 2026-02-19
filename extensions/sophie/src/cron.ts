/**
 * Sophie's Cron Integration
 *
 * Registers cron-aware tools that let Sophie schedule:
 * - Nightly catalog re-ingestion
 * - Weekly style DNA reports
 * - Periodic catalog monitoring
 */

import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "../../../src/agents/tools/common.js";
import { jsonResult } from "../../../src/agents/tools/common.js";
import type { OpenClawPluginApi } from "../../../src/plugins/types.js";

export function createSophieCronTools(): AnyAgentTool[] {
  return [createScheduleIngestionTool(), createScheduleReportTool(), createListScheduledJobsTool()];
}

function createScheduleIngestionTool(): AnyAgentTool {
  return {
    name: "sophie_schedule_ingestion",
    description:
      "Schedule automatic catalog re-ingestion. Sophie will periodically " +
      "re-scan the Lightroom catalog to pick up new edits and keep her " +
      "style profiles current. Default: nightly at 3 AM.",
    parameters: Type.Object({
      schedule: Type.Optional(
        Type.String({
          description:
            "Cron expression (e.g. '0 3 * * *' for 3 AM daily) or " +
            "interval (e.g. 'every 6h'). Defaults to '0 3 * * *'.",
        }),
      ),
      catalog_path: Type.Optional(
        Type.String({
          description: "Path to .lrcat file. Auto-discovers if not provided.",
        }),
      ),
      enabled: Type.Optional(
        Type.Boolean({
          description: "Whether the schedule is active. Defaults to true.",
        }),
      ),
    }),
    async execute(_id, params: Record<string, unknown>) {
      const schedule = (params.schedule as string) ?? "0 3 * * *";
      const catalogPath = params.catalog_path as string | undefined;
      const enabled = (params.enabled as boolean) ?? true;

      // Build the cron job definition for the cron tool
      const cronJob = {
        name: "sophie-catalog-ingestion",
        description: "Automatic catalog re-ingestion by Sophie",
        schedule: schedule.startsWith("every")
          ? { kind: "every" as const, everyMs: parseInterval(schedule) }
          : { kind: "cron" as const, expr: schedule },
        sessionTarget: "isolated" as const,
        enabled,
        payload: {
          kind: "agentTurn" as const,
          message: catalogPath
            ? `Re-ingest catalog at ${catalogPath}. Report any new scenarios or significant changes.`
            : "Re-ingest the active Lightroom catalog. Report any new scenarios or significant changes.",
        },
        delivery: {
          mode: "announce" as const,
        },
      };

      return jsonResult({
        scheduled: true,
        job: cronJob,
        note: "This job definition should be passed to the cron tool's 'add' action to activate it.",
      });
    },
  };
}

function createScheduleReportTool(): AnyAgentTool {
  return {
    name: "sophie_schedule_report",
    description:
      "Schedule automatic style DNA report generation. Sophie will " +
      "periodically generate a report showing the photographer's editing patterns. " +
      "Default: weekly on Sundays at 10 AM.",
    parameters: Type.Object({
      schedule: Type.Optional(
        Type.String({
          description: "Cron expression. Defaults to '0 10 * * 0' (Sunday 10 AM).",
        }),
      ),
      enabled: Type.Optional(
        Type.Boolean({
          description: "Whether the schedule is active. Defaults to true.",
        }),
      ),
    }),
    async execute(_id, params: Record<string, unknown>) {
      const schedule = (params.schedule as string) ?? "0 10 * * 0";
      const enabled = (params.enabled as boolean) ?? true;

      const cronJob = {
        name: "sophie-weekly-report",
        description: "Weekly editing DNA report by Sophie",
        schedule: { kind: "cron" as const, expr: schedule },
        sessionTarget: "isolated" as const,
        enabled,
        payload: {
          kind: "agentTurn" as const,
          message:
            "Generate the photographer's editing DNA report using sophie_generate_report. Summarize key findings.",
        },
        delivery: {
          mode: "announce" as const,
        },
      };

      return jsonResult({
        scheduled: true,
        job: cronJob,
        note: "This job definition should be passed to the cron tool's 'add' action to activate it.",
      });
    },
  };
}

function createListScheduledJobsTool(): AnyAgentTool {
  return {
    name: "sophie_list_schedules",
    description: "List Sophie's scheduled automation jobs (catalog ingestion, reports, etc.)",
    parameters: Type.Object({}),
    async execute() {
      return jsonResult({
        available_schedules: [
          {
            name: "sophie-catalog-ingestion",
            description: "Re-ingest Lightroom catalog to learn new edits",
            default_schedule: "0 3 * * * (3 AM daily)",
          },
          {
            name: "sophie-weekly-report",
            description: "Generate editing DNA report",
            default_schedule: "0 10 * * 0 (Sunday 10 AM)",
          },
        ],
        note: "Use sophie_schedule_ingestion or sophie_schedule_report to configure these, then pass the result to the cron tool to activate.",
      });
    },
  };
}

function parseInterval(input: string): number {
  const match = input.match(/every\s+(\d+)\s*(h|m|s|hr|min|sec|hour|minute|second)s?/i);
  if (!match) return 6 * 60 * 60 * 1000; // default 6h

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  if (unit.startsWith("h")) return value * 60 * 60 * 1000;
  if (unit.startsWith("m")) return value * 60 * 1000;
  if (unit.startsWith("s")) return value * 1000;
  return value * 60 * 60 * 1000;
}
