/**
 * Proactive memory search and injection for agent runs.
 *
 * Searches memory before agent start and formats results for system prompt injection.
 */

import type { OpenClawConfig } from "../config/config.js";
import type { MemorySearchResult } from "../memory/index.js";
import { getMemorySearchManager } from "../memory/index.js";

/**
 * Memory snippet ready for injection into system prompt.
 */
export type MemorySnippet = {
  path: string;
  score: number;
  snippet: string;
  source: string;
};

/**
 * Proactive memory search options.
 */
export type ProactiveMemorySearchOptions = {
  /** User message to search for related memories. */
  query: string;
  /** OpenClaw configuration. */
  cfg: OpenClawConfig;
  /** Agent ID for memory scope. */
  agentId: string;
  /** Max results to return (default: 3). */
  maxResults?: number;
  /** Min score threshold (default: 0.3). */
  minScore?: number;
  /** Timeout in ms (default: 1000). */
  timeoutMs?: number;
};

/**
 * Search for memories relevant to the user's message.
 * Returns empty array on any error (graceful degradation).
 */
export async function searchProactiveMemory(
  options: ProactiveMemorySearchOptions,
): Promise<MemorySnippet[]> {
  const { query, cfg, agentId, maxResults = 3, minScore = 0.3, timeoutMs = 1000 } = options;

  // Check if proactive memory is enabled
  const proactiveEnabled = cfg.agents?.defaults?.memorySearch?.proactive?.enabled ?? false;
  if (!proactiveEnabled) {
    return [];
  }

  // Skip short queries
  if (!query || query.trim().length < 10) {
    return [];
  }

  try {
    // Race against timeout
    const searchPromise = performSearch({ query, cfg, agentId, maxResults, minScore });
    const timeoutPromise = new Promise<MemorySnippet[]>((resolve) =>
      setTimeout(() => resolve([]), timeoutMs),
    );

    return await Promise.race([searchPromise, timeoutPromise]);
  } catch (err) {
    console.error("[proactive-memory] Search failed:", err);
    return [];
  }
}

async function performSearch(params: {
  query: string;
  cfg: OpenClawConfig;
  agentId: string;
  maxResults: number;
  minScore: number;
}): Promise<MemorySnippet[]> {
  const { manager, error } = await getMemorySearchManager({
    cfg: params.cfg,
    agentId: params.agentId,
  });

  if (!manager || error) {
    return [];
  }

  const results = await manager.search(params.query, {
    maxResults: params.maxResults,
    minScore: params.minScore,
  });

  return results.map(toMemorySnippet);
}

function toMemorySnippet(result: MemorySearchResult): MemorySnippet {
  return {
    path: result.path,
    score: result.score,
    snippet: result.snippet,
    source: result.source,
  };
}

/**
 * Format memory snippets into a section for system prompt injection.
 * Returns empty string if no memories.
 */
export function formatProactiveMemorySection(memories: MemorySnippet[]): string {
  if (memories.length === 0) {
    return "";
  }

  const lines = ["<proactive-memory>", "Relevant memories from previous sessions:", ""];

  for (const mem of memories) {
    lines.push(`[${mem.source}] ${mem.path} (score: ${mem.score.toFixed(2)})`);
    lines.push(mem.snippet);
    lines.push("");
  }

  lines.push("</proactive-memory>");

  return lines.join("\n");
}

/**
 * Build the complete proactive context section including memories and reminders.
 * Always includes the banmal reminder when proactive is enabled.
 */
export function buildProactiveContextSection(params: {
  memories: MemorySnippet[];
  includeReminder: boolean;
}): string {
  const parts: string[] = [];

  // Memory section (if any)
  const memorySection = formatProactiveMemorySection(params.memories);
  if (memorySection) {
    parts.push(memorySection);
  }

  // Banmal reminder (always when enabled)
  if (params.includeReminder) {
    parts.push("<style-reminder>");
    parts.push('⚠️ REMINDER: 반말만 사용. "~요" 금지.');
    parts.push("</style-reminder>");
  }

  return parts.join("\n\n");
}
