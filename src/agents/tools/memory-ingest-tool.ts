import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "./common.js";
import { jsonResult } from "./common.js";

const MemoryIngestSchema = Type.Object({
  source: Type.Optional(Type.String({ description: "Source label for the ingestion request" })),
  sessionKey: Type.Optional(Type.String({ description: "Session key for attribution" })),
  traceId: Type.Optional(Type.String({ description: "Trace identifier for downstream systems" })),
  items: Type.Optional(
    Type.Array(
      Type.Object({
        id: Type.Optional(Type.String()),
        kind: Type.Optional(Type.String()),
        text: Type.Optional(Type.String()),
        metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
      }),
      { description: "Content items to ingest" },
    ),
  ),
});

export function createMemoryIngestTool(): AnyAgentTool {
  return {
    label: "Memory Ingest",
    name: "memory.ingest",
    description: "Ingest structured content into the memory pipeline.",
    parameters: MemoryIngestSchema,
    execute: async () =>
      jsonResult({
        ok: false,
        tool: "memory.ingest",
        error: {
          code: "not_configured",
          message: "Memory ingestion pipeline is not configured.",
          retryable: false,
        },
      }),
  };
}
