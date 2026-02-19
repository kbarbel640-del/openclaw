/**
 * Sophie's Observability
 *
 * Tracks performance metrics for Sophie's operations:
 * - Ingestion speed (photos/second)
 * - Edit throughput (edits/minute)
 * - Tool call durations
 * - Error rates
 * - Classification accuracy tracking
 *
 * Metrics are stored in a simple JSONL file and can be queried
 * via the sophie_metrics tool.
 */

import fs from "node:fs";
import path from "node:path";
import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "../../../src/agents/tools/common.js";
import { jsonResult } from "../../../src/agents/tools/common.js";
import type { OpenClawPluginApi } from "../../../src/plugins/types.js";
import { getSophieSession } from "./session-bridge.js";

interface MetricEntry {
  timestamp: number;
  tool: string;
  durationMs: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
}

function getMetricsPath(): string {
  const state = getSophieSession();
  return path.join(path.dirname(state.config.learning.styleDbPath), "metrics.jsonl");
}

export function registerSophieObservability(api: OpenClawPluginApi): void {
  // Track all Sophie tool calls
  api.on("after_tool_call", async (event) => {
    if (!event.toolName.startsWith("sophie_")) return;

    const entry: MetricEntry = {
      timestamp: Date.now(),
      tool: event.toolName,
      durationMs: event.durationMs ?? 0,
      success: !event.error,
      error: event.error,
    };

    // Extract meaningful metadata from specific tools
    if (event.toolName === "sophie_ingest_catalog" && event.result) {
      const result = event.result as Record<string, unknown>;
      entry.metadata = {
        photosExtracted: result.photos_extracted,
        photosClassified: result.photos_classified,
        photosStored: result.photos_stored,
      };
    }

    if (event.toolName === "sophie_cull" && event.result) {
      const result = event.result as Record<string, unknown>;
      entry.metadata = {
        total: result.total,
        picks: result.picks,
        rejects: result.rejects,
      };
    }

    try {
      const metricsPath = getMetricsPath();
      const dir = path.dirname(metricsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.appendFileSync(metricsPath, JSON.stringify(entry) + "\n", "utf-8");
    } catch {
      // Non-critical
    }
  });
}

export function createSophieMetricsTool(): AnyAgentTool {
  return {
    name: "sophie_metrics",
    description:
      "Get Sophie's performance metrics — tool call counts, average durations, " +
      "error rates, and throughput statistics. Useful for understanding how " +
      "Sophie is performing and identifying bottlenecks.",
    parameters: Type.Object({
      hours: Type.Optional(
        Type.Number({
          description: "Look back N hours. Defaults to 24.",
        }),
      ),
      tool_filter: Type.Optional(
        Type.String({
          description: "Filter to a specific tool name (e.g. 'sophie_ingest_catalog').",
        }),
      ),
    }),
    async execute(_id, params: Record<string, unknown>) {
      const hours = (params.hours as number) ?? 24;
      const toolFilter = params.tool_filter as string | undefined;
      const cutoff = Date.now() - hours * 60 * 60 * 1000;

      let metricsPath: string;
      try {
        metricsPath = getMetricsPath();
      } catch {
        return jsonResult({
          error: "Metrics not available — no session initialized.",
        });
      }

      if (!fs.existsSync(metricsPath)) {
        return jsonResult({
          period_hours: hours,
          total_calls: 0,
          message: "No metrics recorded yet.",
        });
      }

      const lines = fs.readFileSync(metricsPath, "utf-8").trim().split("\n");
      const entries: MetricEntry[] = [];

      for (const line of lines) {
        if (!line) continue;
        try {
          const entry = JSON.parse(line) as MetricEntry;
          if (entry.timestamp >= cutoff) {
            if (!toolFilter || entry.tool === toolFilter) {
              entries.push(entry);
            }
          }
        } catch {
          continue;
        }
      }

      if (entries.length === 0) {
        return jsonResult({
          period_hours: hours,
          total_calls: 0,
          message: `No tool calls in the last ${hours} hours.`,
        });
      }

      // Aggregate by tool
      const byTool = new Map<
        string,
        {
          count: number;
          errors: number;
          totalMs: number;
          minMs: number;
          maxMs: number;
        }
      >();

      for (const entry of entries) {
        const existing = byTool.get(entry.tool) ?? {
          count: 0,
          errors: 0,
          totalMs: 0,
          minMs: Infinity,
          maxMs: 0,
        };

        existing.count++;
        if (!entry.success) existing.errors++;
        existing.totalMs += entry.durationMs;
        existing.minMs = Math.min(existing.minMs, entry.durationMs);
        existing.maxMs = Math.max(existing.maxMs, entry.durationMs);

        byTool.set(entry.tool, existing);
      }

      const toolStats = Array.from(byTool.entries()).map(([tool, stats]) => ({
        tool,
        calls: stats.count,
        errors: stats.errors,
        error_rate: Math.round((stats.errors / stats.count) * 100) + "%",
        avg_ms: Math.round(stats.totalMs / stats.count),
        min_ms: stats.minMs === Infinity ? 0 : stats.minMs,
        max_ms: stats.maxMs,
      }));

      toolStats.sort((a, b) => b.calls - a.calls);

      const totalCalls = entries.length;
      const totalErrors = entries.filter((e) => !e.success).length;
      const avgDuration = Math.round(
        entries.reduce((sum, e) => sum + e.durationMs, 0) / entries.length,
      );

      return jsonResult({
        period_hours: hours,
        total_calls: totalCalls,
        total_errors: totalErrors,
        overall_error_rate: Math.round((totalErrors / totalCalls) * 100) + "%",
        avg_duration_ms: avgDuration,
        by_tool: toolStats,
      });
    },
  };
}
