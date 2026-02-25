export type MemoryCategory = "preference" | "fact" | "decision" | "entity" | "other";

export type MemorySupabaseConfig = {
  supabase: {
    url: string;
    serviceKey: string;
    functions?: {
      search?: string;
      store?: string;
      get?: string;
      forget?: string;
      count?: string;
    };
  };
  embedding: {
    provider: "openai";
    apiKey: string;
    model?: string;
  };
  autoCapture?: boolean;
  autoRecall?: boolean;
  captureMaxChars?: number;
  maxRecallResults?: number;
  minScore?: number;
};

export const MEMORY_CATEGORIES: readonly MemoryCategory[] = [
  "preference",
  "fact",
  "decision",
  "entity",
  "other",
];

const DEFAULT_MODEL = "text-embedding-3-small";
export const DEFAULT_CAPTURE_MAX_CHARS = 500;
const DEFAULT_MAX_RECALL_RESULTS = 5;
const DEFAULT_MIN_SCORE = 0.3;
const DEFAULT_SUPABASE_URL = "https://YOUR-PROJECT.supabase.co";

const DEFAULT_FUNCTION_NAMES = {
  search: "openclaw_match_memories",
  store: "openclaw_store_memory",
  get: "openclaw_get_memory",
  forget: "openclaw_forget_memory",
  count: "openclaw_memory_count",
} as const;

const EMBEDDING_DIMENSIONS: Record<string, number> = {
  "text-embedding-3-small": 1536,
  "text-embedding-3-large": 3072,
};

function assertAllowedKeys(value: Record<string, unknown>, allowed: string[], label: string) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length === 0) {
    return;
  }
  throw new Error(`${label} has unknown keys: ${unknown.join(", ")}`);
}

function resolveEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_match, envVar: string) => {
    const envValue = process.env[envVar];
    if (!envValue) {
      throw new Error(`Environment variable ${envVar} is not set`);
    }
    return envValue;
  });
}

function normalizeFunctionName(value: string, fallback: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) {
    throw new Error(`Invalid function name: ${value}`);
  }
  return trimmed;
}

export function vectorDimsForModel(model: string): number {
  const dims = EMBEDDING_DIMENSIONS[model];
  if (!dims) {
    throw new Error(`Unsupported embedding model: ${model}`);
  }
  return dims;
}

export const memorySupabaseConfigSchema = {
  parse(value: unknown): MemorySupabaseConfig {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("memory-supabase config required");
    }
    const cfg = value as Record<string, unknown>;
    assertAllowedKeys(
      cfg,
      [
        "supabase",
        "embedding",
        "autoCapture",
        "autoRecall",
        "captureMaxChars",
        "maxRecallResults",
        "minScore",
      ],
      "memory-supabase config",
    );

    const supabase = cfg.supabase as Record<string, unknown> | undefined;
    if (!supabase || typeof supabase !== "object" || Array.isArray(supabase)) {
      throw new Error("supabase config is required");
    }
    assertAllowedKeys(supabase, ["url", "serviceKey", "functions"], "supabase config");
    if (typeof supabase.url !== "string" || !supabase.url.trim()) {
      throw new Error("supabase.url is required");
    }
    if (typeof supabase.serviceKey !== "string" || !supabase.serviceKey.trim()) {
      throw new Error("supabase.serviceKey is required");
    }

    const functions = supabase.functions as Record<string, unknown> | undefined;
    if (functions) {
      assertAllowedKeys(
        functions,
        ["search", "store", "get", "forget", "count"],
        "supabase.functions",
      );
    }

    const embedding = cfg.embedding as Record<string, unknown> | undefined;
    if (!embedding || typeof embedding !== "object" || Array.isArray(embedding)) {
      throw new Error("embedding config is required");
    }
    assertAllowedKeys(embedding, ["apiKey", "model"], "embedding config");
    if (typeof embedding.apiKey !== "string" || !embedding.apiKey.trim()) {
      throw new Error("embedding.apiKey is required");
    }
    const model = typeof embedding.model === "string" ? embedding.model : DEFAULT_MODEL;
    vectorDimsForModel(model);

    const captureMaxChars =
      typeof cfg.captureMaxChars === "number"
        ? Math.floor(cfg.captureMaxChars)
        : DEFAULT_CAPTURE_MAX_CHARS;
    if (captureMaxChars < 100 || captureMaxChars > 10_000) {
      throw new Error("captureMaxChars must be between 100 and 10000");
    }

    const maxRecallResults =
      typeof cfg.maxRecallResults === "number"
        ? Math.floor(cfg.maxRecallResults)
        : DEFAULT_MAX_RECALL_RESULTS;
    if (maxRecallResults < 1 || maxRecallResults > 20) {
      throw new Error("maxRecallResults must be between 1 and 20");
    }

    const minScore = typeof cfg.minScore === "number" ? cfg.minScore : DEFAULT_MIN_SCORE;
    if (!Number.isFinite(minScore) || minScore < 0 || minScore > 1) {
      throw new Error("minScore must be between 0 and 1");
    }

    return {
      supabase: {
        url: resolveEnvVars(supabase.url).trim().replace(/\/+$/, ""),
        serviceKey: resolveEnvVars(supabase.serviceKey).trim(),
        functions: {
          search: normalizeFunctionName(
            typeof functions?.search === "string" ? functions.search : "",
            DEFAULT_FUNCTION_NAMES.search,
          ),
          store: normalizeFunctionName(
            typeof functions?.store === "string" ? functions.store : "",
            DEFAULT_FUNCTION_NAMES.store,
          ),
          get: normalizeFunctionName(
            typeof functions?.get === "string" ? functions.get : "",
            DEFAULT_FUNCTION_NAMES.get,
          ),
          forget: normalizeFunctionName(
            typeof functions?.forget === "string" ? functions.forget : "",
            DEFAULT_FUNCTION_NAMES.forget,
          ),
          count: normalizeFunctionName(
            typeof functions?.count === "string" ? functions.count : "",
            DEFAULT_FUNCTION_NAMES.count,
          ),
        },
      },
      embedding: {
        provider: "openai",
        apiKey: resolveEnvVars(embedding.apiKey),
        model,
      },
      autoCapture: cfg.autoCapture === true,
      autoRecall: cfg.autoRecall !== false,
      captureMaxChars,
      maxRecallResults,
      minScore,
    };
  },
  uiHints: {
    "supabase.url": {
      label: "Supabase Project URL",
      placeholder: DEFAULT_SUPABASE_URL,
      help: "Project URL (for example https://xxxx.supabase.co)",
    },
    "supabase.serviceKey": {
      label: "Supabase Service Role Key",
      sensitive: true,
      placeholder: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      help: "Use the service-role key so RPC functions can query pgvector tables",
    },
    "supabase.functions.search": {
      label: "Search RPC Function",
      placeholder: DEFAULT_FUNCTION_NAMES.search,
      advanced: true,
      help: "Run SQL setup from extensions/memory-supabase/schema.sql or set your own RPC names",
    },
    "supabase.functions.store": {
      label: "Store RPC Function",
      placeholder: DEFAULT_FUNCTION_NAMES.store,
      advanced: true,
    },
    "supabase.functions.get": {
      label: "Get RPC Function",
      placeholder: DEFAULT_FUNCTION_NAMES.get,
      advanced: true,
    },
    "supabase.functions.forget": {
      label: "Forget RPC Function",
      placeholder: DEFAULT_FUNCTION_NAMES.forget,
      advanced: true,
    },
    "supabase.functions.count": {
      label: "Count RPC Function",
      placeholder: DEFAULT_FUNCTION_NAMES.count,
      advanced: true,
    },
    "embedding.apiKey": {
      label: "OpenAI API Key",
      sensitive: true,
      placeholder: "sk-proj-...",
      help: "Embedding API key (for OpenAI; use ${OPENCLAW_MEMORY_SUPABASE_EMBEDDING_API_KEY} or ${OPENAI_API_KEY})",
    },
    "embedding.model": {
      label: "Embedding Model",
      placeholder: DEFAULT_MODEL,
      help: "Must match your pgvector dimension in Supabase schema",
    },
    autoCapture: {
      label: "Auto-Capture",
      help: "Automatically capture important user facts after successful runs",
    },
    autoRecall: {
      label: "Auto-Recall",
      help: "Inject relevant memories before agent responses",
    },
    captureMaxChars: {
      label: "Capture Max Chars",
      advanced: true,
      placeholder: String(DEFAULT_CAPTURE_MAX_CHARS),
    },
    maxRecallResults: {
      label: "Max Recall Results",
      advanced: true,
      placeholder: String(DEFAULT_MAX_RECALL_RESULTS),
    },
    minScore: {
      label: "Minimum Similarity",
      advanced: true,
      placeholder: String(DEFAULT_MIN_SCORE),
    },
  },
};
