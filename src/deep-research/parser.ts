/**
 * Deep Research result parser
 * @see docs/sdd/deep-research/requirements.md#4.4
 */

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { getDefaultDeepResearchCliPath, loadConfig } from "../config/config.js";
import type { DeepResearchResult } from "./messages.js";

interface ResultJson {
  run_id: string;
  status: string;
  prompt: string;
  agent_summary?: {
    summary_bullets?: string[];
    short_answer_summary_2_initial_request?: string;
    opinion?: string;
  };
  publish?: {
    ok?: boolean;
    url?: string;
  };
}

/**
 * Parse result.json file and extract delivery data
 * @param resultJsonPath - Path to result.json (relative or absolute)
 * @param basePath - Base path for relative paths
 */
export async function parseResultJson(
  resultJsonPath: string,
  basePath?: string,
): Promise<DeepResearchResult | null> {
  try {
    const resolvedBasePath =
      basePath ??
      dirname(
        loadConfig().deepResearch?.cliPath ??
          getDefaultDeepResearchCliPath(),
      );

    // Resolve path
    const fullPath = resultJsonPath.startsWith("/")
      ? resultJsonPath
      : join(resolvedBasePath, resultJsonPath);

    const content = await readFile(fullPath, "utf-8");
    const result: ResultJson = JSON.parse(content);

    // Validate required fields
    if (!result.agent_summary) {
      console.error("[deep-research] Missing agent_summary in result.json");
      return null;
    }

    if (!result.publish?.url) {
      console.error("[deep-research] Missing publish.url in result.json");
      return null;
    }

    return {
      summaryBullets: result.agent_summary.summary_bullets || [],
      shortAnswer:
        result.agent_summary.short_answer_summary_2_initial_request || "",
      opinion: result.agent_summary.opinion || "",
      publishUrl: result.publish.url,
    };
  } catch (error) {
    console.error("[deep-research] Failed to parse result.json:", error);
    return null;
  }
}

/**
 * Build result.json path from run_id
 */
export function getResultJsonPath(runId: string): string {
  return `runs/${runId}/result.json`;
}
