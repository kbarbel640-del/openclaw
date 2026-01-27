import { Type, type Static } from "@sinclair/typebox";
import { TypeCompiler } from "@sinclair/typebox/compiler";

/**
 * Memory categories for classification
 */
export const MEMORY_CATEGORIES = [
  "preference",
  "decision",
  "fact",
  "entity",
  "instruction",
  "context",
  "other",
] as const;

export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

/**
 * Configuration schema for Memvid memory plugin (local SDK)
 */
export const memvidConfigSchema = Type.Object({
  // Storage Configuration
  memoryPath: Type.Optional(
    Type.String({
      description: "Path to the .mv2 memory file (default: ~/.clawdbot/memories/moltbot.mv2)",
    }),
  ),

  // OpenAI Configuration (for embeddings and RAG)
  openaiApiKey: Type.Optional(
    Type.String({
      description: "OpenAI API key for embeddings (uses OPENAI_API_KEY env var if not set)",
    }),
  ),
  embeddingModel: Type.Optional(
    Type.String({
      description: "OpenAI embedding model",
      default: "text-embedding-3-small",
    }),
  ),

  // Behavior Configuration
  autoRecall: Type.Optional(
    Type.Boolean({
      description: "Auto-inject relevant memories before agent starts",
      default: true,
    }),
  ),
  autoCapture: Type.Optional(
    Type.Boolean({
      description: "Auto-capture important info after agent ends",
      default: true,
    }),
  ),

  // Search Configuration
  topK: Type.Optional(
    Type.Number({
      description: "Number of results to return from memory search",
      default: 5,
      minimum: 1,
      maximum: 50,
    }),
  ),
  snippetChars: Type.Optional(
    Type.Number({
      description: "Maximum characters per snippet",
      default: 500,
      minimum: 100,
      maximum: 2000,
    }),
  ),
  minScore: Type.Optional(
    Type.Number({
      description: "Minimum similarity score (0-1)",
      default: 0.3,
      minimum: 0,
      maximum: 1,
    }),
  ),

  // RAG Configuration
  ragModel: Type.Optional(
    Type.String({
      description: "Model for RAG answers (gpt-4o, gpt-4o-mini, etc.)",
      default: "gpt-4o-mini",
    }),
  ),

  // Security Configuration
  maskPii: Type.Optional(
    Type.Boolean({
      description: "Mask PII (emails, SSNs, phone numbers, credit cards, API keys) in recalled memories",
      default: true,
    }),
  ),
});

export type MemvidConfig = Static<typeof memvidConfigSchema>;

const configCompiler = TypeCompiler.Compile(memvidConfigSchema);

/**
 * Parse and validate config with defaults
 */
export function parseConfig(raw: unknown): MemvidConfig {
  // Handle undefined/null config
  const config = raw && typeof raw === "object" ? raw : {};

  if (!configCompiler.Check(config)) {
    const errors = [...configCompiler.Errors(config)];
    throw new Error(`Invalid config: ${errors.map((e) => `${e.path}: ${e.message}`).join(", ")}`);
  }
  return {
    embeddingModel: "text-embedding-3-small",
    autoRecall: true,
    autoCapture: true,
    topK: 5,
    snippetChars: 500,
    minScore: 0.3,
    ragModel: "gpt-4o-mini",
    maskPii: true, // Default: ON for security
    ...config,
  } as MemvidConfig;
}
