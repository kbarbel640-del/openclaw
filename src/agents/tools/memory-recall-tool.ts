import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import { Type } from "@sinclair/typebox";

import { type AnyAgentTool, jsonResult, readStringParam } from "./common.js";

const MemoryRecallToolSchema = Type.Object({
  query: Type.String({
    description:
      "Search term or phrase to find in memories. Case-insensitive.",
  }),
  scope: Type.Optional(
    Type.Union([
      Type.Literal("all"),
      Type.Literal("persistent"),
      Type.Literal("daily"),
    ]),
  ),
  limit: Type.Optional(
    Type.Number({
      description: "Max results to return (default: 10)",
    }),
  ),
});

export type MemoryRecallToolContext = {
  /** Memory workspace path (default: ~/clawd) */
  memoryWorkspace?: string;
};

/**
 * Resolves the memory workspace path.
 */
function resolveMemoryWorkspace(explicit?: string): string {
  if (explicit) {
    return explicit.startsWith("~")
      ? path.join(os.homedir(), explicit.slice(1))
      : explicit;
  }
  return path.join(os.homedir(), "clawd");
}

interface MemoryMatch {
  source: string;
  line: string;
  context?: string;
}

/**
 * Searches a file for lines matching the query.
 */
async function searchFile(
  filePath: string,
  query: string,
  sourceName: string,
): Promise<MemoryMatch[]> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.split("\n");
    const matches: MemoryMatch[] = [];
    const lowerQuery = query.toLowerCase();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.toLowerCase().includes(lowerQuery)) {
        // Get context: one line before and after
        const before = i > 0 ? lines[i - 1] : undefined;
        const after = i < lines.length - 1 ? lines[i + 1] : undefined;
        const context = [before, after]
          .filter((l) => l && l.trim())
          .join("\n");

        matches.push({
          source: sourceName,
          line: line.trim(),
          context: context || undefined,
        });
      }
    }
    return matches;
  } catch {
    return [];
  }
}

/**
 * Gets list of daily log files (sorted newest first).
 */
async function getDailyLogFiles(memoryDir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(memoryDir);
    return entries
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

/**
 * Creates the memory recall tool for searching memories.
 *
 * This tool provides just-in-time memory queries without loading everything
 * into context upfront. Use it to search for specific facts, decisions,
 * or notes from past sessions.
 */
export function createMemoryRecallTool(
  context: MemoryRecallToolContext,
): AnyAgentTool {
  const memoryWorkspace = resolveMemoryWorkspace(context.memoryWorkspace);

  return {
    label: "Recall Memory",
    name: "memory_recall",
    description: `Search through stored memories for specific information. Use this for just-in-time recall of facts, decisions, tasks, or insights from past sessions.

Scopes:
- all: Search both persistent memory.md and daily logs
- persistent: Only search memory.md (long-term facts)
- daily: Only search recent daily logs

This is more efficient than loading all memories into context - use it when you need to look up specific information.`,
    parameters: MemoryRecallToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const query = readStringParam(params, "query", { required: true });
      const scope =
        (readStringParam(params, "scope") as "all" | "persistent" | "daily") ||
        "all";
      const limit =
        typeof params.limit === "number" ? Math.min(params.limit, 50) : 10;

      const memoryDir = path.join(memoryWorkspace, "memory");
      const memoryMdPath = path.join(memoryWorkspace, "memory.md");

      const allMatches: MemoryMatch[] = [];

      // Search persistent memory
      if (scope === "all" || scope === "persistent") {
        const persistentMatches = await searchFile(
          memoryMdPath,
          query,
          "memory.md",
        );
        allMatches.push(...persistentMatches);
      }

      // Search daily logs
      if (scope === "all" || scope === "daily") {
        const dailyFiles = await getDailyLogFiles(memoryDir);
        // Search last 7 days of logs
        for (const file of dailyFiles.slice(0, 7)) {
          const filePath = path.join(memoryDir, file);
          const matches = await searchFile(filePath, query, file);
          allMatches.push(...matches);
        }
      }

      if (allMatches.length === 0) {
        return jsonResult({
          success: true,
          message: `🔍 No memories found matching "${query}"`,
          matches: [],
          count: 0,
        });
      }

      // Limit results
      const limitedMatches = allMatches.slice(0, limit);

      // Format results
      const formattedResults = limitedMatches.map((m) => ({
        source: m.source,
        content: m.line,
        ...(m.context ? { context: m.context } : {}),
      }));

      const summary =
        allMatches.length > limit
          ? `🔍 Found ${allMatches.length} memories (showing ${limit})`
          : `🔍 Found ${allMatches.length} memories`;

      return jsonResult({
        success: true,
        message: summary,
        matches: formattedResults,
        count: allMatches.length,
        showing: limitedMatches.length,
      });
    },
  };
}
