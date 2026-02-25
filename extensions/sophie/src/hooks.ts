/**
 * Sophie's OpenClaw Hooks
 *
 * Lifecycle hooks that keep Sophie's editing context alive across
 * compaction cycles, tool calls, and session boundaries.
 */

import fs from "node:fs";
import path from "node:path";
import type { OpenClawPluginApi } from "../../../src/plugins/types.js";
import { getSophieSession, closeSophieSession } from "./session-bridge.js";

export function registerSophieHooks(api: OpenClawPluginApi): void {
  // --- Compaction Hooks ---
  // Before compaction, write a summary of Sophie's current editing state
  // so the LLM retains critical context after context window pruning.
  api.on("before_compaction", async (event, ctx) => {
    const state = getSophieSession();
    const workspaceDir = ctx.workspaceDir ?? api.resolvePath(".");

    const editingContext: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      sessionKey: ctx.sessionKey,
      learningActive: state.learningActive,
      observing: state.observing,
    };

    // Capture active editing session state
    if (state.editingSession) {
      const progress = state.editingSession.getProgress();
      editingContext.editingSession = {
        total: progress.total,
        completed: progress.completed,
        remaining: progress.remaining,
        currentImage: progress.currentImage,
      };
    }

    // Capture learned scenario count and top scenarios
    try {
      const scenarios = state.styleDb.listScenarios();
      const editCount = state.styleDb.getEditCount();
      editingContext.knowledgeState = {
        totalEditsLearned: editCount,
        scenarioCount: scenarios.length,
        topScenarios: scenarios.slice(0, 5).map((s) => ({
          key: s.key,
          label: s.label,
          samples: s.sampleCount,
        })),
        readyToEdit: editCount >= 50 && scenarios.filter((s) => s.sampleCount >= 20).length >= 3,
      };
    } catch {
      // StyleDB may not be initialized yet
    }

    // Write to MEMORY.md so it survives compaction
    const memoryDir = path.join(workspaceDir, "memory");
    if (!fs.existsSync(memoryDir)) {
      fs.mkdirSync(memoryDir, { recursive: true });
    }

    const dateKey = new Date().toISOString().split("T")[0];
    const memoryPath = path.join(memoryDir, `${dateKey}.md`);
    const entry = [
      "",
      `## Sophie State Snapshot (${new Date().toISOString()})`,
      "",
      "```json",
      JSON.stringify(editingContext, null, 2),
      "```",
      "",
    ].join("\n");

    fs.appendFileSync(memoryPath, entry, "utf-8");
    api.logger.debug(`[sophie] Wrote pre-compaction state to ${memoryPath}`);
  });

  api.on("after_compaction", async (event, ctx) => {
    api.logger.info(
      `[sophie] Compaction complete: ${event.compactedCount} messages compacted, ${event.messageCount} remain`,
    );
  });

  // --- Tool Call Hooks ---
  // Track Sophie tool call metrics for observability
  api.on("after_tool_call", async (event, ctx) => {
    if (!event.toolName.startsWith("sophie_")) return;

    const logEntry = {
      tool: event.toolName,
      durationMs: event.durationMs,
      error: event.error ?? null,
      timestamp: Date.now(),
    };

    // Append to daily tool log
    const state = getSophieSession();
    const logDir = path.dirname(state.config.learning.styleDbPath);
    const logPath = path.join(logDir, "tool-metrics.jsonl");

    try {
      fs.appendFileSync(logPath, JSON.stringify(logEntry) + "\n", "utf-8");
    } catch {
      // Non-critical — swallow
    }
  });

  // --- Session Hooks ---
  api.on("session_start", async (event, ctx) => {
    api.logger.info(`[sophie] Session started: ${event.sessionId}`);
    // Trigger lazy initialization of StyleDB
    getSophieSession();
  });

  api.on("session_end", async (event, ctx) => {
    api.logger.info(
      `[sophie] Session ended: ${event.sessionId} (${event.messageCount} messages, ${event.durationMs ?? 0}ms)`,
    );
  });

  // --- Gateway Hooks ---
  api.on("gateway_start", async (event, ctx) => {
    api.logger.info(`[sophie] Gateway started on port ${event.port}`);
  });

  api.on("gateway_stop", async (event, ctx) => {
    api.logger.info(`[sophie] Gateway stopping: ${event.reason ?? "shutdown"}`);
    closeSophieSession();
  });
}
