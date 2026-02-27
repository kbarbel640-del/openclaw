import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { aomsMemoryConfigSchema } from "./config.js";

type AomsToolResult = {
  ok: boolean;
  status?: number;
  data?: unknown;
  error?: string;
};

function jsonResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

async function postJson(params: {
  baseUrl: string;
  path: string;
  timeoutMs: number;
  apiKey?: string;
  body: Record<string, unknown>;
}): Promise<AomsToolResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs);
  try {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (params.apiKey) {
      headers.authorization = `Bearer ${params.apiKey}`;
    }
    const response = await fetch(`${params.baseUrl}${params.path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(params.body),
      signal: controller.signal,
    });

    let parsed: unknown = null;
    const text = await response.text();
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { text };
      }
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        data: parsed,
        error: `AOMS request failed (${response.status})`,
      };
    }

    return {
      ok: true,
      status: response.status,
      data: parsed,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timeout);
  }
}

const MemorySearchSchema = Type.Object({
  query: Type.String({ description: "Query text to search" }),
  maxResults: Type.Optional(Type.Number({ description: "Optional max results" })),
  minScore: Type.Optional(Type.Number({ description: "Optional score threshold" })),
});

const MemoryWriteSchema = Type.Object({
  tier: Type.String({ description: "AOMS memory tier, used as /memory/{tier}" }),
  text: Type.String({ description: "Memory content to write" }),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

const MemoryWeightSchema = Type.Object({
  id: Type.String({ description: "Memory item id" }),
  weight: Type.Number({ description: "Target weight value" }),
  tier: Type.Optional(Type.String({ description: "Optional tier hint" })),
});

const memoryAomsPlugin = {
  id: "memory-aoms",
  name: "Memory (AOMS)",
  description: "AOMS HTTP-backed memory plugin",
  kind: "memory",
  configSchema: aomsMemoryConfigSchema,
  register(api: OpenClawPluginApi) {
    const cfg = aomsMemoryConfigSchema.parse(api.pluginConfig);
    api.logger.info(`memory-aoms: configured (${cfg.baseUrl})`);

    api.registerTool(
      {
        name: "memory_search",
        label: "Memory Search (AOMS)",
        description: "Search memory entries via AOMS /memory/search.",
        parameters: MemorySearchSchema,
        async execute(_toolCallId, params) {
          const body = params as Record<string, unknown>;
          const result = await postJson({
            baseUrl: cfg.baseUrl,
            path: "/memory/search",
            timeoutMs: cfg.timeoutMs,
            apiKey: cfg.apiKey,
            body,
          });
          return jsonResult(result);
        },
      },
      { name: "memory_search" },
    );

    api.registerTool(
      {
        name: "memory_write",
        label: "Memory Write (AOMS)",
        description: "Write memory entries via AOMS /memory/{tier}.",
        parameters: MemoryWriteSchema,
        async execute(_toolCallId, params) {
          const raw = params as Record<string, unknown>;
          const tier = typeof raw.tier === "string" ? raw.tier.trim() : "";
          if (!tier) {
            return jsonResult({ ok: false, error: "tier required" });
          }
          const { tier: _tier, ...body } = raw;
          const result = await postJson({
            baseUrl: cfg.baseUrl,
            path: `/memory/${encodeURIComponent(tier)}`,
            timeoutMs: cfg.timeoutMs,
            apiKey: cfg.apiKey,
            body,
          });
          return jsonResult(result);
        },
      },
      { name: "memory_write" },
    );

    api.registerTool(
      {
        name: "memory_weight",
        label: "Memory Weight (AOMS)",
        description: "Adjust memory weight via AOMS /memory/weight.",
        parameters: MemoryWeightSchema,
        async execute(_toolCallId, params) {
          const body = params as Record<string, unknown>;
          const result = await postJson({
            baseUrl: cfg.baseUrl,
            path: "/memory/weight",
            timeoutMs: cfg.timeoutMs,
            apiKey: cfg.apiKey,
            body,
          });
          return jsonResult(result);
        },
      },
      { name: "memory_weight" },
    );
  },
};

export default memoryAomsPlugin;
