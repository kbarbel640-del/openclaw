/**
 * Sophie's Sub-Agent Tools
 *
 * Enables Sophie to parallelize heavy operations by spawning
 * sub-agents for concurrent work:
 * - Batch classification of large shoots
 * - Parallel culling across image groups
 * - Background catalog ingestion while chatting
 */

import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "../../../src/agents/tools/common.js";
import { jsonResult } from "../../../src/agents/tools/common.js";

export function createSophieSubagentTools(): AnyAgentTool[] {
  return [createBatchClassifyTool(), createBackgroundIngestTool()];
}

function createBatchClassifyTool(): AnyAgentTool {
  return {
    name: "sophie_batch_classify",
    description:
      "Classify a large batch of photos by spawning a sub-agent. " +
      "The sub-agent processes photos in parallel and reports back " +
      "with scenario distribution statistics. Use this for shoots " +
      "with 100+ photos where classification would be slow in the main session.",
    parameters: Type.Object({
      catalog_path: Type.Optional(
        Type.String({
          description: "Path to the .lrcat file containing the photos to classify.",
        }),
      ),
      limit: Type.Optional(
        Type.Number({
          description: "Maximum number of photos to classify. Defaults to all.",
        }),
      ),
    }),
    async execute(_id, params: Record<string, unknown>) {
      const catalogPath = params.catalog_path as string | undefined;
      const limit = params.limit as number | undefined;

      let task = "Classify all photos in the ";
      task += catalogPath ? `catalog at ${catalogPath}` : "active Lightroom catalog";
      task += " into editing scenarios using sophie_classify_scene.";
      if (limit) task += ` Process at most ${limit} photos.`;
      task += " Report back the distribution of scenarios found (count per scenario).";

      // Return the task definition for the sessions_spawn tool
      return jsonResult({
        spawn_task: {
          task,
          label: "sophie-batch-classify",
          cleanup: "keep",
        },
        note: "Pass this task definition to the sessions_spawn tool to execute in a sub-agent.",
      });
    },
  };
}

function createBackgroundIngestTool(): AnyAgentTool {
  return {
    name: "sophie_background_ingest",
    description:
      "Run catalog ingestion in the background via a sub-agent. " +
      "Sophie can continue chatting while the ingestion runs. " +
      "Results are announced when complete.",
    parameters: Type.Object({
      catalog_path: Type.Optional(
        Type.String({
          description: "Path to the .lrcat file. Auto-discovers if not provided.",
        }),
      ),
      limit: Type.Optional(
        Type.Number({
          description: "Maximum photos to process. Useful for testing.",
        }),
      ),
    }),
    async execute(_id, params: Record<string, unknown>) {
      const catalogPath = params.catalog_path as string | undefined;
      const limit = params.limit as number | undefined;

      let task = "Ingest the ";
      task += catalogPath ? `Lightroom catalog at ${catalogPath}` : "active Lightroom catalog";
      task += " using sophie_ingest_catalog.";
      if (limit) task += ` Limit to ${limit} photos.`;
      task +=
        " When complete, summarize: photos processed, scenarios discovered, and confidence levels.";

      return jsonResult({
        spawn_task: {
          task,
          label: "sophie-background-ingest",
          cleanup: "keep",
        },
        note: "Pass this task definition to the sessions_spawn tool to execute in a sub-agent.",
      });
    },
  };
}
