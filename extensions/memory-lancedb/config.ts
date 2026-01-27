import { Type } from "@sinclair/typebox";
import { homedir } from "node:os";
import { join } from "node:path";

export type MemoryConfig = {
  embedding: {
    provider: "openai";
    model?: string;
    apiKey: string;
  };
  extraction?: {
    model?: string;
    apiKey?: string;
  };
  dbPath?: string;
  autoCapture?: boolean;
  autoRecall?: boolean;
};

export const MEMORY_CATEGORIES = ["preference", "fact", "decision", "event", "resource", "entity", "other"] as const;
export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

const DEFAULT_MODEL = "text-embedding-3-small";
const DEFAULT_EXTRACTION_MODEL = "gpt-4o-mini";
const DEFAULT_DB_PATH = join(homedir(), ".clawdbrain", "memory", "lancedb");

const EMBEDDING_DIMENSIONS: Record<string, number> = {
  "text-embedding-3-small": 1536,
  "text-embedding-3-large": 3072,
};

function assertAllowedKeys(
  value: Record<string, unknown>,
  allowed: string[],
  label: string,
) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length === 0) return;
  throw new Error(`${label} has unknown keys: ${unknown.join(", ")}`);
}

export function vectorDimsForModel(model: string): number {
  const dims = EMBEDDING_DIMENSIONS[model];
  if (!dims) {
    throw new Error(`Unsupported embedding model: ${model}`);
  }
  return dims;
}

function resolveEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, envVar) => {
    const envValue = process.env[envVar];
    if (!envValue) {
      throw new Error(`Environment variable ${envVar} is not set`);
    }
    return envValue;
  });
}

function resolveEmbeddingModel(embedding: Record<string, unknown>): string {
  const model = typeof embedding.model === "string" ? embedding.model : DEFAULT_MODEL;
  vectorDimsForModel(model);
  return model;
}

export const memoryConfigSchema = {
  parse(value: unknown): MemoryConfig {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("memory config required");
    }
    const cfg = value as Record<string, unknown>;
    assertAllowedKeys(cfg, ["embedding", "extraction", "dbPath", "autoCapture", "autoRecall"], "memory config");

    const embedding = cfg.embedding as Record<string, unknown> | undefined;
    if (!embedding || typeof embedding.apiKey !== "string") {
      throw new Error("embedding.apiKey is required");
    }
    assertAllowedKeys(embedding, ["apiKey", "model"], "embedding config");

    const extraction = cfg.extraction as Record<string, unknown> | undefined;
    if (extraction) {
      assertAllowedKeys(extraction, ["apiKey", "model"], "extraction config");
    }

    const model = resolveEmbeddingModel(embedding);

    return {
      embedding: {
        provider: "openai",
        model,
        apiKey: resolveEnvVars(embedding.apiKey),
      },
      extraction: extraction ? {
        model: typeof extraction.model === "string" ? extraction.model : DEFAULT_EXTRACTION_MODEL,
        apiKey: typeof extraction.apiKey === "string" ? resolveEnvVars(extraction.apiKey) : resolveEnvVars(embedding.apiKey),
      } : {
        model: DEFAULT_EXTRACTION_MODEL,
        apiKey: resolveEnvVars(embedding.apiKey),
      },
      dbPath: typeof cfg.dbPath === "string" ? cfg.dbPath : DEFAULT_DB_PATH,
      autoCapture: cfg.autoCapture !== false,
      autoRecall: cfg.autoRecall !== false,
    };
  },
  uiHints: {
    "embedding.apiKey": {
      label: "OpenAI API Key (Embeddings)",
      sensitive: true,
      placeholder: "sk-proj-...",
      help: "API key for OpenAI embeddings (or use ${OPENAI_API_KEY})",
    },
    "embedding.model": {
      label: "Embedding Model",
      placeholder: DEFAULT_MODEL,
      help: "OpenAI embedding model to use",
    },
    "extraction.model": {
      label: "Extraction Model",
      placeholder: DEFAULT_EXTRACTION_MODEL,
      help: "Model used for semantic memory extraction",
    },
    "extraction.apiKey": {
      label: "OpenAI API Key (Extraction)",
      sensitive: true,
      placeholder: "sk-proj-...",
      help: "Optional: separate API key for extraction",
    },
    dbPath: {
      label: "Database Path",
      placeholder: "~/.clawdbrain/memory/lancedb",
      advanced: true,
    },
    autoCapture: {
      label: "Auto-Capture",
      help: "Automatically capture important information from conversations",
    },
    autoRecall: {
      label: "Auto-Recall",
      help: "Automatically inject relevant memories into context",
    },
  },
};
