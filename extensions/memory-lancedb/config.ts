import fs from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  defaultMemoryEmbeddingApiKeyEnvVar,
  resolveMemoryEmbeddingModel,
  type MemoryEmbeddingProviderId,
} from "openclaw/plugin-sdk";

export type MemoryConfig = {
  embedding: {
    provider: MemoryEmbeddingProviderId;
    model: string;
    apiKey?: string;
    local?: {
      modelPath?: string;
      modelCacheDir?: string;
    };
  };
  dbPath?: string;
  autoCapture?: boolean;
  autoRecall?: boolean;
  captureMaxChars?: number;
};

export const MEMORY_CATEGORIES = ["preference", "fact", "decision", "entity", "other"] as const;
export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

const DEFAULT_PROVIDER: MemoryEmbeddingProviderId = "openai";
const DEFAULT_MODEL = resolveMemoryEmbeddingModel(DEFAULT_PROVIDER);
export const DEFAULT_CAPTURE_MAX_CHARS = 500;
const LEGACY_STATE_DIRS: string[] = [];
const SUPPORTED_EMBEDDING_PROVIDERS: MemoryEmbeddingProviderId[] = [
  "openai",
  "gemini",
  "voyage",
  "mistral",
  "local",
];

function resolveDefaultDbPath(): string {
  const home = homedir();
  const preferred = join(home, ".openclaw", "memory", "lancedb");
  try {
    if (fs.existsSync(preferred)) {
      return preferred;
    }
  } catch {
    // best-effort
  }

  for (const legacy of LEGACY_STATE_DIRS) {
    const candidate = join(home, legacy, "memory", "lancedb");
    try {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } catch {
      // best-effort
    }
  }

  return preferred;
}

const DEFAULT_DB_PATH = resolveDefaultDbPath();

function assertAllowedKeys(value: Record<string, unknown>, allowed: string[], label: string) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length === 0) {
    return;
  }
  throw new Error(`${label} has unknown keys: ${unknown.join(", ")}`);
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

function parseEmbeddingProvider(raw: unknown): MemoryEmbeddingProviderId {
  if (typeof raw !== "string") {
    return DEFAULT_PROVIDER;
  }
  const normalized = raw.trim().toLowerCase();
  if (SUPPORTED_EMBEDDING_PROVIDERS.includes(normalized as MemoryEmbeddingProviderId)) {
    return normalized as MemoryEmbeddingProviderId;
  }
  throw new Error(`Unsupported embedding provider: ${raw}`);
}

function resolveOptionalEnvVar(raw: unknown, field: string): string | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (typeof raw !== "string") {
    throw new Error(`${field} must be a string`);
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  return resolveEnvVars(trimmed);
}

export const memoryConfigSchema = {
  parse(value: unknown): MemoryConfig {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("memory config required");
    }
    const cfg = value as Record<string, unknown>;
    assertAllowedKeys(
      cfg,
      ["embedding", "dbPath", "autoCapture", "autoRecall", "captureMaxChars"],
      "memory config",
    );

    const embedding = cfg.embedding as Record<string, unknown> | undefined;
    if (!embedding || typeof embedding !== "object" || Array.isArray(embedding)) {
      throw new Error("embedding config is required");
    }
    assertAllowedKeys(embedding, ["provider", "apiKey", "model", "local"], "embedding config");
    const provider = parseEmbeddingProvider(embedding.provider);
    const model = resolveMemoryEmbeddingModel(
      provider,
      typeof embedding.model === "string" ? resolveEnvVars(embedding.model) : undefined,
    );
    const apiKey = resolveOptionalEnvVar(embedding.apiKey, "embedding.apiKey");

    const local = embedding.local as Record<string, unknown> | undefined;
    if (local && (typeof local !== "object" || Array.isArray(local))) {
      throw new Error("embedding.local must be an object");
    }
    if (local) {
      assertAllowedKeys(local, ["modelPath", "modelCacheDir"], "embedding.local");
    }

    const captureMaxChars =
      typeof cfg.captureMaxChars === "number" ? Math.floor(cfg.captureMaxChars) : undefined;
    if (
      typeof captureMaxChars === "number" &&
      (captureMaxChars < 100 || captureMaxChars > 10_000)
    ) {
      throw new Error("captureMaxChars must be between 100 and 10000");
    }

    return {
      embedding: {
        provider,
        model,
        apiKey,
        local: local
          ? {
              modelPath:
                typeof local.modelPath === "string"
                  ? resolveEnvVars(local.modelPath).trim() || undefined
                  : undefined,
              modelCacheDir:
                typeof local.modelCacheDir === "string"
                  ? resolveEnvVars(local.modelCacheDir).trim() || undefined
                  : undefined,
            }
          : undefined,
      },
      dbPath: typeof cfg.dbPath === "string" ? cfg.dbPath : DEFAULT_DB_PATH,
      autoCapture: cfg.autoCapture === true,
      autoRecall: cfg.autoRecall !== false,
      captureMaxChars: captureMaxChars ?? DEFAULT_CAPTURE_MAX_CHARS,
    };
  },
  uiHints: {
    "embedding.provider": {
      label: "Embedding Provider",
      placeholder: DEFAULT_PROVIDER,
      help: "Supported: openai, gemini, voyage, mistral, local",
    },
    "embedding.apiKey": {
      label: "Embedding API Key",
      sensitive: true,
      placeholder: "sk-...",
      help: `Optional override. Defaults to core auth/env resolution (for example ${defaultMemoryEmbeddingApiKeyEnvVar(
        "openai",
      )}, GEMINI_API_KEY, VOYAGE_API_KEY, MISTRAL_API_KEY).`,
    },
    "embedding.model": {
      label: "Embedding Model",
      placeholder: DEFAULT_MODEL,
      help: "Model id for the selected provider",
    },
    "embedding.local.modelPath": {
      label: "Local Model Path",
      advanced: true,
      placeholder:
        "hf:ggml-org/embeddinggemma-300m-qat-q8_0-GGUF/embeddinggemma-300m-qat-Q8_0.gguf",
      help: "Used when embedding.provider is local",
    },
    "embedding.local.modelCacheDir": {
      label: "Local Model Cache Dir",
      advanced: true,
      placeholder: "~/.cache/openclaw/models",
      help: "Optional cache directory for local embeddings",
    },
    dbPath: {
      label: "Database Path",
      placeholder: "~/.openclaw/memory/lancedb",
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
    captureMaxChars: {
      label: "Capture Max Chars",
      help: "Maximum message length eligible for auto-capture",
      advanced: true,
      placeholder: String(DEFAULT_CAPTURE_MAX_CHARS),
    },
  },
};
